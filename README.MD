**简体中文 | [繁體中文](README_zh-tw.MD) | [English](README_en.MD)**

<div align="center">

  <img src="./res/icons/bilibili.svg" height="100px" width="100px"/>

  <h3>哔哩哔哩 Linux版</h3>
  <br>

----

[![aur](https://img.shields.io/aur/version/bilibili-bin)](https://aur.archlinux.org/packages/bilibili-bin)

  这是哔哩哔哩 Linux版
  
  SVG图标来自 [@Peternal](https://github.com/Peternal)

  <br>
</div>

## 介绍

本项目用到了：

1. 反混淆
2. 调试
3. 脑子

本项目完全开源，且没有任何代码加密操作，如有疑虑请自行审查代码或停止使用相关文件。

## 特点

1. 没有讨厌的标题栏
2. 支持小分辨率屏幕全屏
3. 检查更新支持
4. 有能够关闭程序的菜单
5. 支持漫游
6. 外区搜索
7. [弹幕共享](docs/help/弹幕共享.MD)

## 技术栈

- TypeScript（严格模式）与 Vite 构建
- React 19、Redux Toolkit、Ant Design 和 Sass 构建注入式设置界面
- Electron 43 与 electron-builder 打包桌面客户端
- pnpm 10 管理依赖
- 浏览器端扩展负责页面注入、请求拦截和本地存储；Electron 侧补丁负责客户端集成

## 开发指南

### 环境准备

需要当前 Node.js LTS 和 pnpm 10。可使用 `corepack enable` 提供 pnpm，然后安装依赖：

```bash
pnpm install
```

NixOS 用户可直接使用仓库提供的开发环境：

```bash
nix develop
```

首次准备客户端源码和资源时运行：

```bash
tools/setup-bilibili.sh
```

该脚本会下载并解包上游客户端，构建扩展，并生成 `app/` 下的运行文件。

### 常用命令

```bash
pnpm dev       # 监听并重建注入脚本和扩展
pnpm build     # TypeScript 检查并生成生产构建
pnpm lint      # 运行 ESLint
bin/bilibili   # 启动已准备好的客户端
pnpm pkg-linux # 构建 Linux 安装包
```

源码主要位于 `src/extension/`（页面注入和设置 UI）与 `src/inject/`（Electron 侧补丁）。请修改 `src/`、`res/`、`tools/` 或 `conf/` 中的源文件，不要手动修改生成的 `app/`、`dist/`、`tmp/` 和 `cache/` 内容。提交前建议运行 `pnpm build`、`pnpm lint` 和 `git diff --check`。更完整的协作约定见 [AGENTS.md](AGENTS.md)。

## 使用方法

### 自动化构建

请到 Release 页面下载：

https://github.com/msojocs/bilibili-linux/releases

即时构建版本：

https://github.com/msojocs/bilibili-linux/releases/tag/continuous

### 手动构建

1. 拉取代码
   ```
   git clone https://github.com/msojocs/bilibili-linux.git
   cd bilibili-linux
   ```
2. 安装
   ```
   tools/setup-bilibili.sh
   ```
3. 启动
   ```
   bin/bilibili
   ```
### AppImage 安装

请使用 [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher)

## Gentoo Linux

Emerge from [gentoo-zh overlay](https://github.com/microcai/gentoo-zh/tree/master/media-video/bilibili).

### 额外补充

如果阁下不喜欢电脑多装一个 Electron，可以自行提取发布版的 `app.asar` 并使用已安装 Electron 启动，建议的 Electron 版本是：`43.1.1`（`VaapiOnNvidiaGPUs` 需要 Electron 43+ / Chromium 130+）

### 本地历史记录备份

历史记录以可直接阅读的 JSON 保存为 Electron `app.getPath("userData")` 目录中的 `history-backup.json`。使用默认 Linux 配置时，文件的确切位置为 `~/.config/bilibili/history-backup.json`；内容按账号隔离，并从新到旧排序。文件直接保存服务器返回的原始历史对象，分页键和时间戳在读取时推导，不会在每个条目中重复保存。刷新历史记录第一页后，会在后台限速扫描其余服务器页面；前台滚动请求始终优先，并直接使用原始服务器响应。完整扫描结束后，`serverOldest` 会记录服务器最旧条目：比该边界新的本地内容会由当前服务器快照替换，而更旧的本地内容保持不变。这些保留条目会在实时服务器历史记录之后继续显示在正常历史页面中。

## GPU 加速配置

Electron 43 (Chromium 150) 支持 Linux 下 VA-API 硬件视频解码。以下为推荐配置：

### NVIDIA GPU

1. 安装 VA-API → NVDEC 后端：
   ```bash
   # Arch Linux
   sudo pacman -S libva-nvidia-driver
   # Debian/Ubuntu
   sudo apt install libva-nvidia-driver
   ```

2. 设置环境变量（libva 需要此变量定位 NVIDIA 后端）：
   ```bash
   export LIBVA_DRIVER_NAME=nvidia
   ```

3. 在 `~/.config/bilibili/bilibili-flags.conf` 中配置：

   ```
   --ignore-gpu-blocklist
   --enable-features=AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL,VaapiOnNvidiaGPUs,VaapiIgnoreDriverChecks,PlatformHEVCDecoderSupport
   --enable-gpu-rasterization
   --enable-zero-copy
   --disable-gpu-sandbox
   ```

   > **说明**：
   > - `VaapiOnNvidiaGPUs` (Chromium 130+) 绕过 vaapi_wrapper 对 NVIDIA 设备的跳过检查
   > - `AcceleratedVideoDecodeLinuxGL` / `AcceleratedVideoDecodeLinuxZeroCopyGL` 为 Chromium 150 推荐的 GL 零拷贝解码路径
   > - Electron 28 不支持以上 feature，NVIDIA 视频硬解需要 Electron 43+

### Intel / AMD GPU

```
--ignore-gpu-blocklist
--enable-features=AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL,VaapiVideoDecoder,VaapiIgnoreDriverChecks,PlatformHEVCDecoderSupport
--enable-gpu-rasterization
--enable-zero-copy
--disable-gpu-sandbox
```

Intel 核显与 AMD 独显/核显使用 Mesa VA-API 后端，无需额外安装驱动或设置环境变量。

### 验证硬解

播放视频后检查 GPU 解码引擎是否工作：

```bash
cat /proc/$(pgrep -f "type=gpu-process.*bilibili")/fdinfo/* | grep drm-engine-video
```

非零数值表示 GPU 解码引擎正在工作。也可访问 `chrome://gpu` 查看 "Video Decode" 状态。

### 注意

- `--use-gl=angle --use-angle=gl` 在部分 Linux 桌面环境（尤其是 Wayland）下可能导致 VA-API 解码失效，建议使用 Electron 默认的 EGL/GLX 后端。
- 如果系统开启了代理（如 Clash），`bilipc.bilibili.com` 经代理可能无法解析导致白屏。Electron 43+ 版本已内置代理绕过处理。

## 开发者工具

### F12 开发者面板

现已支持自行打开开发者工具，方法如下：

现已支持自行打开开发者工具，方法如下：

尝试按下<kbd>F12</kbd>，如果没有反应就是没有开启；

登录界面有两层，内层右键打开，外层<kbd>F12</kbd>打开。

## 关于龙芯

https://areweloongyet.com/docs/loong-or-loongarch

|发行版|架构标识符|
|------|----------|
|AOSC OS|`loongarch64`|
|Debian|<ul><li>旧世界：`loongarch64`</li><li>新世界：`loong64`</li></ul>|
|Gentoo|`loong`|
|Loong Arch Linux|`loong64`|
|RPM 系|`loongarch64`|
|Slackware|`loong64`|

## 空降助手

自动帮助阁下空降至关键位置。

你需要提前安装`python3`软件包与`faster_whisper` `torch`模块。

参考文档：[AiTranscribe](docs/AiTranscribe.MD)

| 选项 | 说明 |
|------|-----|
| Whisper代理 | 模型下载需要代理, 形如：`http://127.0.0.1:1080` |
| LD_LIBRARY_PATH | 可能遇到 `cudnn` 库找不到，[参考此处](https://github.com/MahmoudAshraf97/whisper-diarization/issues/259) |
| AI识别TOKEN | https://www.bigmodel.cn/ 的Token，使用免费模型 `glm-4.5-flash` |

## 切换语言

1. 在主页点击右下角设定按钮
2. 进入“其它设定”
3. 在“语言设定”区域选择你想要的语言

## 更新日志

[CHANGELOG.md](CHANGELOG.md)

## 预览

![推荐](res/screenshots/1.png)

![直播](res/screenshots/live.png)

![检查更新](res/screenshots/update.png)

![退出](res/screenshots/exit.png)

![漫游](res/screenshots/roaming.png)

## 感谢以下项目

1. [BiliRoaming](https://github.com/yujincheng08/BiliRoaming)
2. [解除B站区域限制](https://github.com/ipcjs/bilibili-helper)
3. [小电视空降助手](https://github.com/hanydd/BilibiliSponsorBlock)

## 免责声明

License 仅对本项目生效，不针对其产物。

哔哩哔哩客户端版权归上海宽娱数码科技有限公司所有；

对于使用本项目产生的额外问题，如账户封禁被盗等，维护者不对此负责，请谨慎使用；

如有不当之处，请联系本人，邮箱：jiyecafe@gmail.com
