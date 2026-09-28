#!/usr/bin/env node

// electron-builder / builder-util 上游不支持 loong64/loongarch64，这里在安装后对
// node_modules 做补丁以补充这两个架构。补丁全部带校验：一旦上游文件结构变化导致匹配
// 失败，会直接报错，而不是静默跳过（静默跳过会产出一个架构错误的包）。

const path = require('path')
const fs = require('fs')

console.log('fixing builder for loongarch......')

const nodeModules = path.resolve(__dirname, '../node_modules')

function patchFile(relPath, sentinel, rules) {
  const file = path.resolve(nodeModules, relPath)
  let content = fs.readFileSync(file, 'utf8')
  if (content.includes(sentinel)) {
    console.log(`[fix-build-loongarch] ${relPath} 已打过补丁，跳过`)
    return
  }
  for (const rule of rules) {
    if (!rule.pattern.test(content)) {
      throw new Error(
        `[fix-build-loongarch] 在 ${relPath} 中找不到匹配项: ${rule.label}\n` +
        `上游 electron-builder/builder-util 结构已变化，请更新 tools/fix-build-loongarch.js`
      )
    }
    content = content.replace(rule.pattern, rule.replacement)
  }
  fs.writeFileSync(file, content)
}

const fixBuilderUtil = () => {
  patchFile('builder-util/out/arch.js', 'Arch["loong64"]', [
    {
      label: 'Arch 枚举 arm64',
      pattern: /Arch\[Arch\["arm64"\] = \d+\] = "arm64";/,
      replacement: (m) => `${m}\nArch[Arch["loong64"] = 5] = "loong64";Arch[Arch["loongarch64"] = 6] = "loongarch64";`,
    },
    {
      label: 'toLinuxArchString arm64',
      pattern: /(case Arch\.arm64:\s*\n\s*return [^\n]*;\n)/,
      replacement: (m) =>
        `${m}        case Arch.loong64:\n            return targetName === "rpm" ? "loongarch64_abi1" : "loong64";\n` +
        `        case Arch.loongarch64:\n            return targetName === "rpm" ? "loongarch64_abi2" : "loongarch64";\n`,
    },
    {
      label: 'getArchCliNames',
      pattern: /return \[Arch\[Arch\.ia32\], Arch\[Arch\.x64\], Arch\[Arch\.armv7l\], Arch\[Arch\.arm64\]\];/,
      replacement: 'return [Arch[Arch.ia32], Arch[Arch.x64], Arch[Arch.armv7l], Arch[Arch.arm64], Arch[Arch.loong64], Arch[Arch.loongarch64]];',
    },
    {
      label: 'archFromString arm64',
      pattern: /(case "arm64":\s*\n\s*return Arch\.arm64;)/,
      replacement: (m) => `${m}\n        case "loong64":\n            return Arch.loong64;\n        case "loongarch64":\n            return Arch.loongarch64;`,
    },
    {
      label: 'getArtifactArchName arm64',
      pattern: /else if \(arch === Arch\.arm64\) \{/,
      replacement: (m) =>
        `else if (arch === Arch.loongarch64) {\n        if (ext === "rpm") {\n            archName = "loongarch64_abi1";\n        }\n    }\n` +
        `    else if (arch === Arch.loong64) {\n        if (ext === "rpm") {\n            archName = "loongarch64_abi2";\n        }\n    }\n    ${m}`,
    },
  ])
}

const fixElectronBuilder = () => {
  patchFile('electron-builder/out/builder.js', 'args.loong64', [
    {
      label: 'loong64 CLI flag',
      pattern: /if \(args\.ia32\) \{/,
      replacement: (m) =>
        `if (args.loong64) { result.push(builder_util_1.Arch.loong64); }\n    ` +
        `if (args.loongarch64) { result.push(builder_util_1.Arch.loongarch64); }\n    ${m}`,
    },
    {
      label: 'delete loong flags',
      pattern: /delete result\.arm64;/,
      replacement: (m) => `${m}\n    delete result.loong64;\n    delete result.loongarch64;`,
    },
    {
      label: 'loong64 CLI option',
      pattern: /\.option\("universal", \{/,
      replacement: (m) =>
        `.option("loong64", {\n    group: buildGroup,\n    description: "Build for loong64",\n    type: "boolean",\n    })\n    ` +
        `.option("loongarch64", {\n    group: buildGroup,\n    description: "Build for loongarch64",\n    type: "boolean",\n    })\n    ${m}`,
    },
  ])
}

// 直接把 loong64/loongarch64 注入到已安装的 scheme.json 中，
// 不再用 res/ 下那份固定版本的副本覆盖（会破坏新版本 schema）。
const fixScheme = () => {
  const file = path.resolve(nodeModules, 'app-builder-lib/scheme.json')
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'))

  let patched = 0
  let already = 0
  const visit = (node) => {
    if (Array.isArray(node)) {
      if (node.length > 0 && node.every((it) => typeof it === 'string') &&
        node.includes('x64') && node.includes('arm64')) {
        if (node.includes('loong64') || node.includes('loongarch64')) {
          already++
        } else {
          node.push('loong64', 'loongarch64')
          patched++
        }
      }
      node.forEach(visit)
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach(visit)
    }
  }
  visit(schema)

  if (patched === 0 && already === 0) {
    throw new Error('[fix-build-loongarch] scheme.json 中未找到需要补充 loong 架构的 arch 枚举，请检查 app-builder-lib 版本')
  }
  fs.writeFileSync(file, JSON.stringify(schema, null, 2))
}

console.log('fixing builder-util...')
fixBuilderUtil()
console.log('fixing electron-builder...')
fixElectronBuilder()
console.log('fixing scheme.json...')
fixScheme()

// 校验补丁确实生效
const arch = require(path.resolve(nodeModules, 'builder-util/out/arch.js'))
if (arch.archFromString('loong64') !== arch.Arch.loong64 || arch.archFromString('loongarch64') !== arch.Arch.loongarch64) {
  throw new Error('[fix-build-loongarch] builder-util 补丁校验失败')
}

console.log('fix builder for loongarch done.')
