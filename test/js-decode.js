#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function parseSubFunc (str) {
  return str.replace(
    /(\w+|\S)\['([a-zA-Z_]*?)'\]/g,
    function ($0, $1, $2) {
      if($2.length===0)return $0
      let result = $0
      switch ($1) {
        case '{':
          result = `{${$2}`
          break
        case '}':
          result = `}${$2}`
          break
        case ']':
          result = `].${$2}`
          break
        case '.':
        case ':':
          result = `${$1}${$2}`
          break
        case 'async':
        case 'get':
          result = `${$1} ${$2}`
          break
        default:
          // console.log("---", $0, $1, $2)
          result = `${$1}.${$2}`
          break
      }
      // if($2 === "toString"){
      //     console.log("---", $0, $1, $2 , "   result:", result)
      // }
      return result
    }
  )
}

function encodeUnicode (s) {
  return s.replace(
    /'(\\u([\da-f]{4})){1,}'/g,
    function ($0, $1, $2) {
      const result = eval('"' + $0 + '"')
      // console.log('---', $0, $1, $2)
      return result
    }
  )
}
const sourceCode = fs.readFileSync(path.resolve(__dirname, '../app/app/main/index.orgi.js'))

let resultCode = sourceCode.toString()
let i = 0;
resultCode = resultCode.replace(
  /'(([\\xa-z0-9]{2,2})+)'/g,
  function ($0, $1, $2) {
    i++;
    // 二分法查找异常点
    // 763 ok
    // 764 error
    // if(i >= 4925){
    //     if(i === 763){
    //         console.log("---", $0, $1, $2)
    //         let result = eval('"' + $1 + '"')
    //         console.log("---", result)
    //     }
    //     return $0
    // }

    let result = eval('"' + $1 + '"')
    if (result.includes('*')) {
      // 不做处理
      return $0
    }
    if (result.includes("\\")) {
      result = result.replace(/\\/g, "\\\\")
    }
    if (result.includes("'")) {
      result = result.replace(/'/g, "\\'")
    }
    if (result.includes("\n")) {
      result = result.replace(/\n/g, "\\n")
    }
    return `'${result}'`
  }
)
resultCode = encodeUnicode(resultCode)
// fs.writeFileSync(path.resolve(__dirname, '../app/app/main/index1.js'), resultCode)
resultCode = parseSubFunc(resultCode)
resultCode = parseSubFunc(resultCode)
fs.writeFileSync(path.resolve(__dirname, '../app/app/main/index1.js'), resultCode)
fs.writeFileSync(path.resolve(__dirname, '../app/app/main/index.js'), resultCode)
