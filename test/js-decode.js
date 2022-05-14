#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function decode(str){
    return str.replace(/\\x(\w{2})/g,function(_,$1){ return String.fromCharCode(parseInt($1,16)) });
}

function encodeUnicode(s) {
    return s.replace(
        /'(\\u([\da-f]{4})){1,}'/g,
        function ($0, $1, $2) {
            let result = eval('"' + $0 + '"')
            // console.log('---', $0, $1, $2)
            return result;
        }
    );
}
const sourceCode = fs.readFileSync(path.resolve(__dirname, '../app/app/main/index.orgi.js'))

let resultCode = sourceCode.toString()
// let i = 0;
resultCode = resultCode.replace(
    /'(([\\xa-z0-9]{2,2})+)'/g,
    function ($0, $1, $2) {
        // i++;
        // 二分法查找异常点
        // 763 ok
        // 764 error
        // if(i >= 763){
        //     if(i === 763){
        //         console.log("---", $0, $1, $2)
        //         let result = eval('"' + $1 + '"')
        //         console.log("---", result)
        //     }
        //     return $0
        // }

        let result = eval('"' + $1 + '"')
        if(result.includes("*")){
            // 不做处理
            return $0
        }
        if(result.includes("'"))
            return `'${result.replace(/'/g, "\\'")}'`
        return `'${result}'`;
    }
);
resultCode = encodeUnicode(resultCode)
fs.writeFileSync(path.resolve(__dirname, '../app/app/main/index.js'), resultCode)
resultCode = resultCode.replace(
    /[\{\}\.]?\['([a-zA-Z]*?)'\]\(?/g,
    function ($0, $1, $2) {
        // console.log("---", $0, $1, $2)
        let end = '', start=''
        if($0.endsWith('('))end = '('
        if(!$0.startsWith('['))start = $0[0]

        let result = $0
        if($0.startsWith('.'))
            result =  `.${$1}${end}`
        else if($0.startsWith('{') || $0.startsWith('}'))
            result =  `${start}${$1}${end}`
        // console.log('--- result:', result)
        return result
    }
);
fs.writeFileSync(path.resolve(__dirname, '../app/app/main/index2.js'), resultCode)

