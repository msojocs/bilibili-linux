#!/usr/bin/env node

const fs = require('fs')

const appPath = process.argv[2]
if (!appPath) {
  throw new Error('Usage: patch-app.js <app.js>')
}

let source = fs.readFileSync(appPath, 'utf8')

const disableGuardBefore = (marker) => {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Unable to find app guard marker: ${marker}`)
  }
  if (source.indexOf(marker, markerIndex + marker.length) >= 0) {
    throw new Error(`App guard marker is ambiguous: ${marker}`)
  }

  const guardIndex = source.lastIndexOf('if (!', markerIndex)
  if (guardIndex < 0 || markerIndex - guardIndex > 1024) {
    throw new Error(`Unable to find the guard preceding: ${marker}`)
  }

  const guard = source.slice(guardIndex).match(/^if \(!([A-Za-z_$][A-Za-z0-9_$]*)\)/)
  if (!guard) {
    throw new Error(`Unexpected guard syntax preceding: ${marker}`)
  }

  const replacement = `if (false&&!${guard[1]})`
  source = source.slice(0, guardIndex) + replacement + source.slice(guardIndex + guard[0].length)
}

disableGuardBefore('Start error, code: 011')
disableGuardBefore('Start error, code: 021')

fs.writeFileSync(appPath, source)
