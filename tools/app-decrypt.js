#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const biliKey = "7b305469a2c01ef020b0a624ffcd9f19"
const biliIv = "64853c1f595ca897db82273d40a73c31"
const authTagHex = "a51de0b99340166df727511c0fb87331"
const args = process.argv.slice(2)

const src = args[0]
const dist = args[1]

const sourceCode = fs.readFileSync(src).toString()

const authTagBuf = Buffer.from(authTagHex, 'hex');
const sourceBuf = Buffer.from(sourceCode,'hex');
const decipher = crypto.createDecipheriv('aes-256-gcm', biliKey, biliIv)
// console.log(decipher)
decipher.setAuthTag(authTagBuf);
const dotBiliappContentDecrypted=Buffer.concat([decipher.update(sourceBuf),decipher.final()]);

fs.writeFileSync(dist, dotBiliappContentDecrypted.toString())