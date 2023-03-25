#!/usr/bin/env node

const fs = require('fs')

const args = process.argv.slice(2)
const target = args[0]

let file = fs.readFileSync(target).toString();
let i = 0
file = file.replaceAll("'警告'", (str) => {
  return `'警告${i++}'`
})
fs.writeFileSync(target, file)