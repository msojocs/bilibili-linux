#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const biliKey = "3fd28eac7aac3f38eca83206e27638fd"
const biliIv = "d2a57dc1d883fd21fb9951699df71cc7"
const args = process.argv.slice(2)

const src = args[0]
const dist = args[1]

// 注入 app/app/node_modules/bytenode/lib/index.js
const orgiCDI = crypto.createDecipheriv
crypto.createDecipheriv = function(){
  // console.log(arguments)
  const retFun = orgiCDI.apply(this, arguments)
  const orgiSAT = retFun.setAuthTag
  retFun.setAuthTag = function(){
    // console.log('setAuthTag: ', arguments)
    return orgiSAT.apply(this, arguments)
  }
  const orgiupdate = retFun.update
  retFun.update = function(){
    // console.log('update:', arguments)
    return orgiupdate.apply(this, arguments)
  }
  return retFun
}

let sourceCode = fs.readFileSync(src).toString()

// get AuthTag
const authTagHex = sourceCode.substring(sourceCode.length - 32);
sourceCode = sourceCode.substring(0, sourceCode.length - 32);

// console.log('get authTagHex: ', authTagHex)
const authTagBuf = Buffer.from(authTagHex, 'hex');
// console.log('test: ', authTagBuf.toString('hex'))
const sourceBuf = Buffer.from(sourceCode, 'hex');
const decipher = crypto.createDecipheriv('aes-256-gcm', biliKey, biliIv)

decipher.setAuthTag(authTagBuf);
const dotBiliappContentDecrypted=Buffer.concat([decipher.update(sourceBuf), decipher.final()]);

fs.writeFileSync(dist, dotBiliappContentDecrypted.toString())