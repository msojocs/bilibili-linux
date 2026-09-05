const { copyFileSync, existsSync, mkdirSync, rmSync } = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

if (process.platform !== 'linux') process.exit(0)

const root = path.resolve(__dirname, '..')
const nativeDirectory = path.join(root, 'native/svp-shm')
const optional = process.argv.includes('--optional')
const command = 'node-gyp'
const fileName = `svp-shm-linux-${process.arch}.node`
const destinationDirectory = path.join(root, 'dist/extension')
const destination = path.join(destinationDirectory, fileName)
rmSync(destination, { force: true })
const build = spawnSync(command, ['rebuild'], {
  cwd: nativeDirectory,
  encoding: 'utf8',
  stdio: 'inherit',
})
if (build.error || build.status !== 0) {
  if (!optional) {
    if (build.error) throw build.error
    process.exit(build.status || 1)
  }
  console.warn('SVP shared-memory module was not built; raw and H.264 transports remain available')
  process.exit(0)
}

const source = path.join(nativeDirectory, 'build/Release/svp_shm.node')
if (!existsSync(source)) throw new Error(`Native build did not produce ${source}`)
mkdirSync(destinationDirectory, { recursive: true })
copyFileSync(source, destination)
