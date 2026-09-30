import { net, shell } from "electron";
import EventEmitter from "events";
import { createLogger } from "../../common/log";
import { registerModuleLoadHook } from "./electron-tool";

/**
 * 「检查更新」的数据源。
 *
 * 客户端自带的更新走 electron-updater + resources/app-update.yml，那份配置来自官方安装包，
 * 指向 https://api.bilibili.com/x/elec-frontend/update/ ，其 latest.yml 描述的是 Windows
 * 安装包（bilibili-setup-vX.Y.Z.exe）。Linux 上照它下载必然装不上，而且官方 bundle 里写死的
 * APP_VERSION="1.19.0" 丢掉了表示第几次重打包的 "-N"，和 Release tag 根本比较不了。
 * 所以这里整体接管 electron-updater 的 autoUpdater，改为查询本项目的 GitHub Release。
 *
 * 只做「检查 + 打开 Release 页」：复用官方更新弹窗展示版本与更新说明，
 * 点「立即更新」时用系统浏览器打开对应 Release，由用户自己下载。
 * 覆盖全部包格式（AppImage/deb/rpm/tar.gz/exe），不做自动下载替换。
 */
const log = createLogger("update");

/** 本项目 GitHub 仓库，形如 "msojocs/bilibili-linux"，构建时注入 */
const REPO = __UPDATE_REPO__;
/** 当前程序版本，构建时注入（根 package.json 的 version，形如 "1.19.0-3"） */
const BUILD_VERSION = __APP_VERSION__;

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * 本项目版本形如 "1.19.0-3"："1.19.0" 是 B 站客户端版本，"-3" 是第几次重打包。
 *
 * 不能用 semver 比较：semver 里 "1.19.0-3" 是 1.19.0 的预发布版本，比 "1.19.0" 更小，
 * 与本项目 "-N 越大越新" 的语义完全相反。这里把两种形式都归一成
 * [主, 次, 修订, 构建号]，构建号缺省按 0 处理，于是 1.19.0-3 > 1.19.0-2 > 1.19.0。
 */
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/;
const parseVersion = (version: string): number[] | null => {
  const match = VERSION_RE.exec(version.trim());
  if (!match) return null;
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4] ?? 0),
  ];
};
const compareVersion = (a: number[], b: number[]): number => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};

/** 当前运行的版本。BILIBILI_UPDATE_VERSION 只用于本地验证「有新版本」分支。 */
const currentVersion = () =>
  (process.env["BILIBILI_UPDATE_VERSION"] || BUILD_VERSION).trim();

/** GitHub Release 里我们用到的字段 */
interface GithubRelease {
  body: string | null;
  draft: boolean;
  html_url: string;
  prerelease: boolean;
  tag_name: string;
}

interface VersionedRelease {
  release: GithubRelease;
  version: number[];
}

/**
 * 优先用 Electron 的 net（走系统代理，兼容 PAC / 漫游设置），
 * 拿不到时（例如 app 还没 ready）回退到 Node 的全局 fetch。
 */
const doFetch = async (url: string): Promise<Response> => {
  const headers = {
    // GitHub API 强制要求 User-Agent
    "user-agent": REPO,
    accept: "application/vnd.github+json",
  };
  const init: RequestInit = {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  try {
    return await net.fetch(url, init);
  } catch (err) {
    log.warn("net.fetch 不可用，回退到全局 fetch:", err);
    return await fetch(url, init);
  }
};

const requestJson = async <T>(url: string): Promise<T> => {
  const response = await doFetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  }
  return (await response.json()) as T;
};

/**
 * 读取仓库里某个 tag 下的文件。
 * 走 API 的 contents 接口而不是 raw.githubusercontent.com：后者在国内常年不可用，
 * 而 api.github.com 是版本检查本来就必须通的，同一个主机少一种失败方式。
 */
const requestFile = async (file: string, ref: string): Promise<string> => {
  const data = await requestJson<{ content?: string }>(
    `https://api.github.com/repos/${REPO}/contents/${file}?ref=${encodeURIComponent(ref)}`
  );
  // contents 接口返回 base64（内容超过 1MB 时 content 为空，本文件远小于此）
  return Buffer.from(data.content ?? "", "base64").toString("utf8");
};

/**
 * 取 CHANGELOG.MD 里最新的一段（到下一个顶级标题为止），
 * 并去掉行首的 # 记号 —— 弹窗是用 textContent 展示纯文本的。
 */
const firstChangelogSection = (markdown: string): string => {
  const section: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#[^#]/.test(line) && section.length > 0) break;
    section.push(line);
  }
  return section
    .join("\n")
    .replace(/^#{1,6}\s*/gm, "")
    .trim();
};

class GithubUpdater extends EventEmitter {
  /** 官方主代码会写入这些字段，见 UpdateService.initAppUpdateEvents / checkForUpdate */
  autoDownload = false;
  autoInstallOnAppQuit = true;
  installDirectory?: string;
  logger?: unknown;
  requestHeaders: Record<string, string> = {};

  /** 最近一次检查到的 Release 页面，downloadUpdate 用它 */
  private releaseUrl: string | null = null;

  checkForUpdates() {
    // 官方是 fire-and-forget 调用，异常只能通过 error 事件抛出
    this.check().catch((err) => this.emitError(err));
  }

  downloadUpdate() {
    const url = this.releaseUrl ?? `https://github.com/${REPO}/releases/latest`;
    log.info("跳转到 Release 页下载:", url);
    // 不发进度事件：渲染层弹窗会停在「发现新版本」，不会出现「下载成功」这类误导文案
    shell.openExternal(url).catch((err) => this.emitError(err));
  }

  /** 只有 update-downloaded 之后界面才会出现「立即安装」，当前流程到不了这里 */
  quitAndInstall() {
    log.info("quitAndInstall 被调用，当前更新方式不需要安装步骤");
  }

  private emitError(err: unknown) {
    log.error("检查更新失败", err);
    // EventEmitter 在没有 error 监听者时 emit("error") 会直接抛出，这里兜一下
    if (this.listenerCount("error") > 0) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async check() {
    this.emit("checking-for-update");
    // 官方 checkForUpdate(P) 里手动检查会设置此字段，自动检查会 delete 掉
    const manual = this.requestHeaders["manualcheck"] === "1";
    const current = parseVersion(currentVersion());
    if (!current) {
      throw new Error(`无法解析当前版本号: ${currentVersion()}`);
    }
    log.info(`检查更新（${manual ? "手动" : "自动"}），当前版本 ${currentVersion()}`);

    const { release, version } = await this.fetchLatestRelease();
    this.releaseUrl =
      release.html_url || `https://github.com/${REPO}/releases/tag/${release.tag_name}`;

    if (compareVersion(version, current) <= 0) {
      log.info("已是最新版本");
      this.emit("update-not-available", { isAvailable: false });
      return;
    }
    if (!manual) {
      // 官方 UpdateService 只在 !autocheck 时才把结果推给界面，这里也保持一致：
      // 启动时的自动检查不弹窗，避免每次启动都打扰用户
      log.info(`发现新版本 ${release.tag_name}，自动检查不打扰用户`);
      this.emit("update-not-available", { isAvailable: false });
      return;
    }
    log.info(`发现新版本 ${release.tag_name}:`, this.releaseUrl);
    this.emit("update-available", {
      version: release.tag_name.replace(/^v/, ""),
      news: await this.loadReleaseNotes(release),
      isAvailable: true,
      releaseUrl: this.releaseUrl,
    });
  }

  private async fetchLatestRelease(): Promise<VersionedRelease> {
    try {
      const latest = await requestJson<GithubRelease>(
        `https://api.github.com/repos/${REPO}/releases/latest`
      );
      const version = parseVersion(latest.tag_name ?? "");
      // /releases/latest 只按时间排序，仓库里还有 tools 这类非版本发布，tag 不是版本号时不能用
      if (version) return { release: latest, version };
      log.warn(`latest release 的 tag 不是版本号: ${latest.tag_name}`);
    } catch (err) {
      log.warn("releases/latest 不可用，改为扫描 releases 列表:", err);
    }
    const list = await requestJson<GithubRelease[]>(
      `https://api.github.com/repos/${REPO}/releases?per_page=20`
    );
    const candidates: VersionedRelease[] = [];
    for (const release of list) {
      const version = parseVersion(release.tag_name ?? "");
      // continuous 之类的滚动发布不要
      if (release.draft || release.prerelease || !version) continue;
      candidates.push({ release, version });
    }
    if (candidates.length === 0) {
      throw new Error(`没有在 ${REPO} 找到任何版本号形式的 Release`);
    }
    return candidates.reduce((max, item) =>
      compareVersion(item.version, max.version) > 0 ? item : max
    );
  }

  private async loadReleaseNotes(release: GithubRelease): Promise<string> {
    const body = (release.body ?? "").trim();
    if (body) return body;
    // 本项目的 Release 由 CI 用 softprops/action-gh-release 创建，没有填写说明，
    // 更新内容只能去该 tag 下的 CHANGELOG.MD 取
    try {
      const notes = firstChangelogSection(
        await requestFile("CHANGELOG.MD", release.tag_name)
      );
      if (notes) return notes;
    } catch (err) {
      log.warn("读取 CHANGELOG 失败，使用兜底文案:", err);
    }
    return `发现新版本 ${release.tag_name.replace(/^v/, "")}`;
  }
}

const updater = new GithubUpdater();

/**
 * 用 GitHub 版本检查替换 electron-updater 的 autoUpdater。
 * 必须在 module.require("./main/app.js") 之前调用。
 */
export const registerGithubUpdater = () => {
  registerModuleLoadHook("electron-updater", (module: { autoUpdater: unknown }) => {
    // electron-updater 的 autoUpdater 是不可重定义的 getter（configurable 为 false），
    // 没法直接 defineProperty 覆盖，只能返回一个以原模块为原型的代理对象。
    // 沿原型链取值不会触发 autoUpdater 的 getter，官方 AppImageUpdater 也就不会被实例化；
    // CancellationToken 等其它导出继续透传（官方主代码还在用 new E["CancellationToken"]()）。
    const wrapper = Object.create(module) as Record<string, unknown>;
    Object.defineProperty(wrapper, "autoUpdater", {
      configurable: true,
      enumerable: true,
      get: () => updater,
    });
    return wrapper;
  });
  log.info(`检查更新已接管: repo=${REPO} 当前版本=${BUILD_VERSION}`);
};
