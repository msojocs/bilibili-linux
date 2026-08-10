import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import {
  clearChromiumDecoderTrial,
  getAppliedChromiumDecoder,
  getChromiumDecoderOptions,
  getSvpPathInfo,
  readSvpPathConfig,
  resolveConfiguredMpv,
  resolveSvpRuntimePaths,
  writeSvpPathConfig,
} from "./runtime";

interface RegisterSvpRuntimeIpcOptions {
  isTrustedSender: (event: Electron.IpcMainInvokeEvent) => boolean;
  stop: () => void;
}

export const registerSvpRuntimeIpc = ({ isTrustedSender, stop }: RegisterSvpRuntimeIpcOptions) => {
  ipcMain.handle('svp/paths', (event) => {
    if (!isTrustedSender(event)) return { configuredMpv: '', configuredRoot: '', effectiveMpv: '', effectiveRoot: '' };
    return getSvpPathInfo();
  });
  ipcMain.handle('svp/select-path', async (event, kind: unknown) => {
    if (!isTrustedSender(event) || (kind !== 'root' && kind !== 'mpv')) {
      return { ...getSvpPathInfo(), error: '补帧路径选择参数无效' };
    }
    const configured = readSvpPathConfig();
    const runtime = resolveSvpRuntimePaths(configured);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      defaultPath: kind === 'root'
        ? configured.root || runtime?.root
        : configured.mpv || (runtime?.mpv && path.isAbsolute(runtime.mpv) ? runtime.mpv : undefined),
      filters: kind === 'mpv' && process.platform === 'win32'
        ? [{ name: 'mpv', extensions: ['exe'] }]
        : undefined,
      properties: kind === 'root' ? ['openDirectory'] : ['openFile'],
      title: kind === 'root' ? '选择 SVP 安装目录' : '选择 mpv 可执行文件',
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return getSvpPathInfo();
    try {
      if (kind === 'root') {
        const selectedRoot = fs.realpathSync(result.filePaths[0]);
        const selectedRuntime = resolveSvpRuntimePaths({ root: selectedRoot });
        if (!selectedRuntime || selectedRuntime.root !== selectedRoot) {
          throw new Error('所选目录中未找到 SVPFlow 插件');
        }
        configured.root = selectedRoot;
      } else {
        configured.mpv = resolveConfiguredMpv(result.filePaths[0]);
      }
      writeSvpPathConfig(configured);
      stop();
      return getSvpPathInfo();
    } catch (error) {
      return { ...getSvpPathInfo(), error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('svp/reset-path', (event, kind: unknown) => {
    if (!isTrustedSender(event) || (kind !== 'root' && kind !== 'mpv')) return getSvpPathInfo();
    const configured = readSvpPathConfig();
    if (kind === 'root') delete configured.root;
    else delete configured.mpv;
    writeSvpPathConfig(configured);
    stop();
    return getSvpPathInfo();
  });
  ipcMain.handle('svp/set-chromium-decoder', (event, value: unknown) => {
    if (!isTrustedSender(event) || typeof value !== 'string') return { ...getSvpPathInfo(), error: 'Chromium 解码器参数无效' };
    const allowed = new Set(getChromiumDecoderOptions().map(option => option.value));
    if (!allowed.has(value)) return { ...getSvpPathInfo(), error: '所选 Chromium 解码设备不可用' };
    const configured = readSvpPathConfig();
    const previous = configured.chromiumDecoderLastKnownGood
      || (getAppliedChromiumDecoder() !== 'unavailable' ? getAppliedChromiumDecoder() : undefined)
      || configured.chromiumDecoder
      || 'auto';
    delete configured.chromiumDecoderRecoveryError;
    if (value === previous) {
      clearChromiumDecoderTrial(configured);
      writeSvpPathConfig(configured);
      return getSvpPathInfo();
    }
    configured.chromiumDecoderLastKnownGood = previous;
    configured.chromiumDecoder = value;
    configured.chromiumDecoderPending = value;
    configured.chromiumDecoderTrial = 'pending';
    writeSvpPathConfig(configured);
    return { ...getSvpPathInfo(), restartRequired: value !== getAppliedChromiumDecoder() };
  });
  ipcMain.handle('svp/relaunch', (event) => {
    if (!isTrustedSender(event)) return false;
    stop();
    app.relaunch();
    app.quit();
    return true;
  });
};
