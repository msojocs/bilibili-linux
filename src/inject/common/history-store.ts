import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { createLogger } from "../../common/log";

const log = createLogger("HistoryStore");
const HISTORY_FILE_NAME = "history-backup.json";

interface ServerOldestBoundary {
  business: string;
  epid: string;
  oid: string;
  syncedAt: string;
  viewAt: number;
}

interface AccountHistory {
  entries: unknown[];
  serverOldest: ServerOldestBoundary | null;
}

interface HistoryFile {
  accounts: Record<string, AccountHistory>;
  version: 3;
}

interface Version2Entry {
  item: unknown;
  itemKey: string;
  viewAt: number;
}

interface Version2HistoryFile {
  accounts: Record<string, {
    entries: Version2Entry[];
    serverOldest: { itemKey: string; syncedAt: string; viewAt: number } | null;
  }>;
  version: 2;
}

const emptyHistoryFile = (): HistoryFile => ({
  accounts: {},
  version: 3,
});

const historyFilePath = () => path.join(app.getPath("userData"), HISTORY_FILE_NAME);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const toBoundary = (entry: Version2Entry, syncedAt: string): ServerOldestBoundary => {
  const item = isObject(entry.item) ? entry.item : {};
  const history = isObject(item.history) ? item.history : {};
  return {
    business: String(history.business || ""),
    epid: String(history.epid ?? ""),
    oid: String(history.oid ?? ""),
    syncedAt,
    viewAt: entry.viewAt,
  };
};

const migrateVersion2 = (legacy: Version2HistoryFile): HistoryFile => ({
  accounts: Object.fromEntries(Object.entries(legacy.accounts).map(([accountId, account]) => {
    const boundary = account.serverOldest;
    const boundaryEntry = boundary
      ? account.entries.find(entry => entry.itemKey === boundary.itemKey)
      : undefined;
    return [accountId, {
      entries: account.entries.map(entry => entry.item),
      serverOldest: boundary && boundaryEntry
        ? toBoundary(boundaryEntry, boundary.syncedAt)
        : null,
    }];
  })),
  version: 3,
});

const readHistoryFile = async (): Promise<HistoryFile> => {
  try {
    const contents = await fs.promises.readFile(historyFilePath(), "utf8");
    const parsed = JSON.parse(contents) as Partial<HistoryFile | Version2HistoryFile>;
    if (!parsed.accounts || typeof parsed.accounts !== "object") {
      throw new Error("unsupported history backup format");
    }
    if (parsed.version === 3) return parsed as HistoryFile;
    if (parsed.version === 2) return migrateVersion2(parsed as Version2HistoryFile);
    throw new Error("unsupported history backup format");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyHistoryFile();
    throw error;
  }
};

const writeHistoryFile = async (data: HistoryFile) => {
  const target = historyFilePath();
  const temporary = `${target}.tmp`;
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporary, target);
};

let mutationQueue: Promise<void> = Promise.resolve();

const queueMutation = <T>(operation: () => Promise<T>) => {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
};

const validateAccountId = (accountId: unknown): accountId is string =>
  typeof accountId === "string" && /^\d+$/.test(accountId);

const validateBoundary = (boundary: unknown): boundary is ServerOldestBoundary | null => {
  if (boundary === null) return true;
  if (!isObject(boundary)) return false;
  return typeof boundary.business === "string" &&
    typeof boundary.epid === "string" &&
    typeof boundary.oid === "string" &&
    typeof boundary.syncedAt === "string" &&
    typeof boundary.viewAt === "number";
};

export const registerHistoryStoreIpc = () => {
  ipcMain.handle("history/write", async (_, accountId: unknown, entries: unknown, boundary: unknown) => {
    if (!validateAccountId(accountId) || !Array.isArray(entries) || !validateBoundary(boundary)) {
      throw new Error("invalid history write request");
    }

    return queueMutation(async () => {
      const data = await readHistoryFile();
      data.accounts[accountId] = {
        entries,
        serverOldest: boundary,
      };
      await writeHistoryFile(data);
      log.info(`Wrote ${entries.length} history entries for account ${accountId}`);
      return entries.length;
    });
  });

  ipcMain.handle("history/list", async (_, accountId: unknown) => {
    if (!validateAccountId(accountId)) throw new Error("invalid history account");
    await mutationQueue;
    const data = await readHistoryFile();
    return data.accounts[accountId] || { entries: [], serverOldest: null };
  });

  ipcMain.handle("history/path", () => historyFilePath());
};
