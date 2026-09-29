// 从 conf/config.json 读取 Electron 的版本与下载地址，是这些值的唯一读取入口。
// 消费者：tools/update-electron.sh（下载）、package.json 的 pkg-* 脚本（electron-builder）、
// tools/build-loongarch.js（require 本模块的导出）。
//
// 架构解析优先级：--arch > 环境变量 BUILD_ARCH（空串视为未设置）> process.arch > x64。
// 注意 BUILD_ARCH 是环境输入，因此同一条命令在不同环境下可能得到不同结果（非幂等）；CI 正是靠它
// 区分架构，见 .github/workflows/release.yml。这也是 pkg-* 脚本必须显式传 --arch x64 的原因。
// 另注意龙芯新旧世界的 process.arch 都是 loong64，龙芯用户必须显式设置 BUILD_ARCH。
const { exit } = require('process')

const config = require('../conf/config.json')

// dpkg 的架构名与 electron 的架构名不同：deb 用 amd64，electron 用 x64
const ARCH_ALIASES = {
  amd64: 'x64',
}

const electronUrls = config.electron.urls

const isKnownArch = (arch) => Object.prototype.hasOwnProperty.call(electronUrls, arch)

/**
 * 解析目标架构，未知架构返回 null
 * @param {string} [explicit] --arch 的取值
 * @returns {string|null}
 */
const resolveArch = (explicit) => {
  if (explicit) {
    const arch = ARCH_ALIASES[explicit] || explicit
    return isKnownArch(arch) ? arch : null
  }
  if (process.env.BUILD_ARCH) {
    const arch = ARCH_ALIASES[process.env.BUILD_ARCH] || process.env.BUILD_ARCH
    if (isKnownArch(arch)) {
      return arch
    }
  }
  if (isKnownArch(process.arch)) {
    return process.arch
  }
  return 'x64'
}

/**
 * 取某个架构的 electron 配置
 * @param {string} arch
 * @returns {{version: string, url: string, mirror: string|undefined, isVerifyChecksum: boolean}}
 */
const getElectronEntry = (arch) => {
  const entry = electronUrls[arch]
  if (entry == null) {
    throw new Error(`conf/config.json 中没有架构 ${arch} 的 electron 配置`)
  }
  return {
    version: entry.version,
    url: entry.template.replace(/\${version}/g, entry.version),
    mirror: entry.mirror,
    isVerifyChecksum: entry.isVerifyChecksum !== false,
  }
}

const options = {
  '--arch': { type: 'string' },
  '--get-arch': { type: 'boolean' },
  '--get-electron-url': { type: 'boolean' },
  '--get-electron-version': { type: 'boolean' },
}

const fail = (message) => {
  console.error(message)
  exit(1)
}

const parseArgs = (args) => {
  const parsed = {}
  for (let i = 0; i < args.length; i++) {
    const option = options[args[i]]
    if (option == null) {
      fail(`未知选项: ${args[i]}`)
    }
    const name = args[i].substring(2)
    if (option.type === 'string') {
      if (i + 1 >= args.length) {
        fail(`选项缺少参数: ${args[i]}`)
      }
      parsed[name] = args[++i]
    } else {
      parsed[name] = true
    }
  }
  return parsed
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2))
  const arch = resolveArch(args.arch)
  if (arch == null) {
    fail(`未知架构: ${args.arch}（可用: ${Object.keys(electronUrls).join(', ')}）`)
  }

  if (args['get-arch']) {
    console.log(arch)
    exit(0)
  }

  const entry = getElectronEntry(arch)
  if (args['get-electron-version']) {
    console.log(entry.version)
    exit(0)
  }
  if (args['get-electron-url']) {
    console.log(entry.url)
    exit(0)
  }

  // 不能静默退出：一处拼写错误（如 --get-electron-verison）会产出空的 -c.electronVersion=，
  // 从而构建出版本错误的包
  fail(`未指定动作，可用: ${Object.keys(options).join(', ')}`)
}

module.exports = { ARCH_ALIASES, resolveArch, getElectronEntry }
