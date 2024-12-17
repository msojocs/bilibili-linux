#!/usr/bin/env node

const fs = require('fs')

const args = process.argv.slice(2)
const src = args[0]
const dist = args[1]


const sourceCode = fs.readFileSync(src)

let resultCode = sourceCode.toString()
let i = 0;
// resultCode = resultCode.replace(
//   /'((\\x[a-z0-9]{2,2})+)'/g,
//   function ($0, $1, $2) {
//     i++;
//     let result = eval(`"${$1}"`)
//     // 查找异常点
//     if(i == 2613){
//       console.log($0, $1, $2)
//       console.log('result:', result)
//       return $0
//     }
//     if(i === 2632){
//       console.log($0, $1, $2)
//       console.log('result:', result)
//       return $0
//     }
//     if(i === 2645){
//       console.log($0, $1, $2)
//       console.log('result:', result)
//       return $0
//     }
//     if(i === 24265){
//       // console.log($0, $1, $2)
//       // console.log('result:', result)
//       return $0
//     }

//     if (result.includes('*')) {
//       // 不做处理
//       return $0
//     }
//     if (result.includes("\\")) {
//       result = result.replace(/\\/g, "\\\\")
//     }
//     if (result.includes("'")) {
//       result = result.replace(/'/g, "\\'")
//     }
//     if (result.includes("\n")) {
//       result = result.replace(/\n/g, "\\n")
//     }
//     if (result.includes("\r")) {
//       result = result.replace(/\r/g, "\\r")
//     }
//     return `'${result}'`
//   }
// )
const { parse, generate } = require("abstract-syntax-tree")
const tree = parse(resultCode)
// fs.writeFileSync('./ast.json', JSON.stringify(tree, null, 4))
// console.log(generate(tree)) // 'const answer = 42;'
resultCode = generate(tree, {
  indent: '',
  lineEnd: ''
})

// resultCode = encodeUnicode(resultCode)
// // fs.writeFileSync(path.resolve(__dirname, '../app/app/main/index1.js'), resultCode)
// resultCode = parseSubFunc(resultCode)
// resultCode = parseSubFunc(resultCode)
// resultCode = resultCode.replace(/'\+'/g, '')
i = 0;
resultCode = resultCode.replace(
  /警告/g,
  function ($0, $1, $2) {
    return $0 + i++
  }
)
fs.writeFileSync(dist, resultCode)
// fs.writeFileSync(path.resolve(__dirname, '../'), resultCode)
