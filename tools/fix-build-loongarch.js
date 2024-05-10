#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

console.log('fixing builder for loongarch......')

const fixBuildUtil = () => {
  {
    const archJsPath = path.resolve(__dirname, '../node_modules/builder-util/out/arch.js')
    let archJs = fs.readFileSync(archJsPath).toString()
    archJs = archJs.replace(
      'Arch[Arch["arm64"] = 3] = "arm64";\n',
      'Arch[Arch["arm64"] = 3] = "arm64";// loongarch64\nArch[Arch["loong64"] = 5] = "loong64";Arch[Arch["loongarch64"] = 6] = "loongarch64";\n'
    )
    archJs = archJs.replace(
      '"aarch64" : "arm64";\n',
      `"aarch64" : "arm64";// loongarch64\ncase Arch.loong64:
      return targetName === "pacman" || targetName === "rpm" || targetName === "flatpak" ? "loong64" : "loong64";
      case Arch.loongarch64:
      return targetName === "pacman" || targetName === "rpm" || targetName === "flatpak" ? "loongarch64" : "loongarch64";
      `
    )
    archJs = archJs.replace(
      ' Arch[Arch.arm64]];\n',
      ' Arch[Arch.arm64], Arch[Arch.loongarch64], Arch[Arch.loong64]];// loongarch64\n'
    )
    archJs = archJs.replace(
      'return Arch.arm64;\n',
      'return Arch.arm64;// loongarch64\ncase "loongarch64":\nreturn Arch.loongarch64;case "loong64":\nreturn Arch.loong64;\n'
    )
    fs.writeFileSync(archJsPath, archJs)
  }
}

const fixElectronBuilder = () => {
  
  const builderJsPath = path.resolve(__dirname, '../node_modules/electron-builder/out/builder.js')
  let builderJs = fs.readFileSync(builderJsPath).toString()
  // 
  builderJs = builderJs.replace(
    'if (args.ia32) {\n',
    `if (args.loong64) {result.push(builder_util_1.Arch.loong64);}
    if (args.loongarch64) {result.push(builder_util_1.Arch.loongarch64);}
    if (args.ia32) {// loongarch64\n`
  )
  builderJs = builderJs.replace('delete result.arm64;\n', 'delete result.arm64; // loongarch64\ndelete result.loong64;\ndelete result.loongarch64;\n')
  builderJs = builderJs.replace('.option("universal", {\n', `.option("loong64", {
    group: buildGroup,
    description: "Build for loong64",
    type: "boolean",
}).option("loongarch64", {
  group: buildGroup,
  description: "Build for loongarch64",
  type: "boolean",
}).option("universal", {// loongarch64\n`)
  fs.writeFileSync(builderJsPath, builderJs)
}

console.log('fixing builder-util...')
fixBuildUtil()
console.log('fixing electron-builder...')
fixElectronBuilder()

console.log('fix builder for loongarch done.')