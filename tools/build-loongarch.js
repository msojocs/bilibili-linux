"use strict"
require('./fix-build-loongarch')
const path = require('path')

const builder = require("electron-builder")
const { execSync } = require('child_process')
const { existsSync, mkdirSync, rmSync } = require('fs')
const { getElectronEntry } = require('./parse-config')
const Platform = builder.Platform

const rootDir = path.resolve(__dirname, '..')
const appimageToolVersion = '1.0.3'
const appimageToolsDir = path.resolve(rootDir, 'tmp/appimage-tools-loong64')

// electron-builder >= 26 在 JS 里构建 AppImage，并从 APPIMAGE_TOOLS_PATH 读取 mksquashfs 与 runtime。
// 官方静态 toolset 不含 loong64，且会把 loong64 映射成 runtime-x64，
// 所以这里准备一份本地 toolset：直接复用官方静态 toolset，只把 runtime-x64 换成 loong64 的静态 runtime。
const prepareAppImageTools = () => {
  const marker = path.resolve(appimageToolsDir, '.loong64-ready')
  if (existsSync(marker)) {
    return
  }
  mkdirSync(appimageToolsDir, { recursive: true })
  const archive = path.resolve(appimageToolsDir, 'appimage-tools.tar.gz')
  execSync(`wget -c "https://github.com/electron-userland/electron-builder-binaries/releases/download/appimage%40${appimageToolVersion}/appimage-tools-runtime-20251108.tar.gz" -O "${archive}"`, {
    stdio: 'inherit'
  })
  execSync(`tar -xzf "${archive}" -C "${appimageToolsDir}"`, { stdio: 'inherit' })
  // electron-builder 会把 loong64 映射到 runtime-x64，因此用 loong64 runtime 覆盖它
  execSync(`wget "https://github.com/msojocs/type2-runtime-loongarch/releases/download/continuous/runtime-loong64" -O "${path.resolve(appimageToolsDir, 'runtimes/runtime-x64')}"`, {
    stdio: 'inherit'
  })
  // loong64 不使用 x64 的 appindicator 库，清空后留空目录以满足存在性检查
  const libDir = path.resolve(appimageToolsDir, 'lib/x64')
  rmSync(libDir, { recursive: true, force: true })
  mkdirSync(libDir, { recursive: true })
  execSync(`touch "${marker}"`)
}

prepareAppImageTools()
process.env.APPIMAGE_TOOLS_PATH = appimageToolsDir

// 龙芯分两个世界，预编译 Electron 的来源与版本都不一样，因此分两次构建：
//
// - loong64（新世界）：darkyzhou/electron-loong64 提供 Electron 32+ 的 loong64 预编译包，
//   与其它架构（x64/arm64）保持同一大版本。该仓库带 SHASUMS256.txt，保留校验。
// - loongarch64（旧世界）：只有 msojocs/electron-loongarch 的 Electron 22.3.27 可用，
//   该仓库没有 SHASUMS256.txt，必须关闭校验，否则 @electron/get 会因取不到校验文件而失败。
//
// 版本、镜像与校验策略都来自 conf/config.json 的 electron 节点（选型理由见该文件的 "//" 字段）。
const loongTargets = {
  loong64: ["AppImage", "rpm", "deb"],
  loongarch64: ["rpm", "deb"]
}
const builds = Object.keys(loongTargets).map((arch) => {
  const { version, mirror, isVerifyChecksum } = getElectronEntry(arch)
  return {
    arch,
    electronVersion: version,
    electronDownload: {
      "mirror": mirror,
      "isVerifyChecksum": isVerifyChecksum
    },
    targets: loongTargets[arch]
  }
})

// Let's get that intellisense working
/**
* @type {import('electron-builder').Configuration}
* @see https://www.electron.build/configuration/configuration
*/
const createOptions = ({ arch, electronVersion, electronDownload, targets }) => ({
  buildVersion: "1",
  "toolsets": {
    "appimage": appimageToolVersion
  },
  directories: {
    "output": "tmp/build",
    "app": "app/app"
  },
  "asar": true,
  "files": [
    "**/*",
    {
      "from": "node_modules",
      "to": "node_modules"
    }
  ],
  "extraResources": [
    "extensions",
    "app/app-update.yml"
  ],
  "electronVersion": electronVersion,
  "electronDownload": electronDownload,
  "appId": "com.bilibili.app",
  "mac": {
    "target": [
      "dmg",
      "zip"
    ],
    "icon": "res/icons/bilibili.icns"
  },
  "win": {
    "target": [
      "nsis"
    ],
    "icon": "res/icons/bilibili.ico"
  },
  "nsis": {
    "oneClick": false,
    "installerIcon": "res/icons/bilibili.ico",
    "uninstallerIcon": "res/icons/bilibili.ico",
    "installerHeaderIcon": "res/icons/bilibili.ico",
    "allowToChangeInstallationDirectory": true
  },
  "linux": {
    "target": targets.map((target) => ({ target, "arch": [arch] })),
    "maintainer": "msojocs <jiyecafe@gmail.com> (https://www.jysafe.cn)",
    "icon": "res/icons",
    "synopsis": "BiliBili client for Linux.",
    "description": "BiliBili client for Linux with roaming.",
    "category": "AudioVideo"
  }
})

// Promise is returned
(async () => {
  for (const build of builds) {
    await builder.build({
      // 架构与目标列表由 config.linux.target 决定（每个 config 只含一个架构）
      targets: Platform.LINUX.createTarget(),
      config: createOptions(build),
      publish: "never"
    })
      .then((result) => {
        console.log(JSON.stringify(result))
      })
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
