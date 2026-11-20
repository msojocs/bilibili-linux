import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _electron, type ElectronApplication } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const rootDirectory = fileURLToPath(new URL('../../', import.meta.url))
const appDirectory = path.join(rootDirectory, 'app/app')

let electronApp: ElectronApplication
let profileDirectory: string
let processOutput = ''

const findMainWindow = () => {
  const page = electronApp.windows().find(window => window.url().includes('/index.html'))
  if (!page) throw new Error('找不到哔哩哔哩主窗口')
  return page
}

const waitForMainWindow = async () => {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    const page = electronApp.windows().find(window => window.url().includes('/index.html'))
    if (page) return page
    await delay(250)
  }
  throw new Error('等待哔哩哔哩主窗口超时')
}

// 应用启动后会拉取线上播放器实验并下载真实 core.js。下载先写 core-dl.js 再改名，
// 这里等它落盘稳定，避免测试 fixture 与真实下载互相覆盖同一个文件。
const waitForPlayerDownloadsToSettle = async (playerDirectory: string) => {
  const downloadPath = path.join(playerDirectory, 'core-dl.js')
  const playerPath = path.join(playerDirectory, 'core.js')
  const deadline = Date.now() + 20_000
  let previous = ''
  let stableSince = Date.now()
  while (Date.now() < deadline) {
    let current = ''
    if (existsSync(playerPath)) {
      const stat = statSync(playerPath)
      current = `${stat.size}:${stat.mtimeMs}`
    }
    if (existsSync(downloadPath) || current !== previous) {
      previous = current
      stableSince = Date.now()
    } else if (Date.now() - stableSince >= 500) {
      return
    }
    await delay(100)
  }
}

const resolveElectronBinary = () => {
  if (process.env.E2E_ELECTRON_BINARY) return process.env.E2E_ELECTRON_BINARY

  const bundledBinary = path.join(rootDirectory, 'electron/electron')
  if (existsSync(bundledBinary)) return bundledBinary

  const result = spawnSync(process.execPath, ['-p', "require('electron')"], {
    cwd: rootDirectory,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error('找不到 Electron，请先运行 tools/setup-bilibili.sh，或设置 E2E_ELECTRON_BINARY')
  }
  return result.stdout.trim()
}

beforeAll(async () => {
  if (!existsSync(path.join(appDirectory, 'index.js'))) {
    throw new Error('找不到 app/app/index.js，请先运行 tools/setup-bilibili.sh 准备客户端')
  }

  profileDirectory = mkdtempSync(path.join(tmpdir(), 'bilibili-e2e-'))
  const noProxy = [
    'localhost',
    '127.0.0.1',
    'bilipc.bilibili.com',
    process.env.NO_PROXY,
    process.env.no_proxy,
  ].filter(Boolean).join(',')

  try {
    electronApp = await _electron.launch({
      executablePath: resolveElectronBinary(),
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--user-data-dir=${path.join(profileDirectory, 'user-data')}`,
        appDirectory,
      ],
      env: {
        ...process.env,
        ELECTRON_FORCE_IS_PACKAGED: 'true',
        HOME: path.join(profileDirectory, 'home'),
        NO_PROXY: noProxy,
        XDG_CONFIG_HOME: path.join(profileDirectory, 'config'),
        no_proxy: noProxy,
      },
      timeout: 60_000,
    })
    const collectOutput = (chunk: Buffer) => {
      processOutput = `${processOutput}${chunk.toString()}`.slice(-20_000)
    }
    electronApp.process().stdout?.on('data', collectOutput)
    electronApp.process().stderr?.on('data', collectOutput)

    await waitForMainWindow()
  } catch (error) {
    throw new Error(`Electron 启动失败：${error instanceof Error ? error.message : String(error)}\n${processOutput}`)
  }
})

afterAll(async () => {
  if (electronApp) {
    await electronApp.close().catch(() => electronApp.process().kill('SIGKILL'))
  }
  if (profileDirectory) rmSync(profileDirectory, { force: true, recursive: true })
})

describe('bilibili-linux E2E', () => {
  it('基础启动界面正常显示', async () => {
    const mainWindow = findMainWindow()
    await mainWindow.waitForLoadState('domcontentloaded')
    await mainWindow.locator('#app > *').first().waitFor({ state: 'visible', timeout: 45_000 })

    expect(mainWindow.url()).toContain('https://bilipc.bilibili.com/index.html')
    expect(await mainWindow.title()).toContain('哔哩哔哩')
    expect(await mainWindow.locator('body').innerText()).toContain('首页')

    const bodyBounds = await mainWindow.locator('body').boundingBox()
    expect(bodyBounds?.width).toBeGreaterThan(0)
    expect(bodyBounds?.height).toBeGreaterThan(0)

    const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(window =>
        window.webContents.getURL().includes('/index.html'),
      )
      return mainWindow?.isVisible() ?? false
    })
    expect(isVisible).toBe(true)
  })

  it('v1.20.0-2：实验播放器 core.js 使用有效 token', async () => {
    const experimentId = 120002
    const coreSource = 'globalThis.__BILIBILI_E2E_CORE__ = true;\n'
    const fixtureServer = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/javascript' })
      response.end(coreSource)
    })

    try {
      await new Promise<void>(resolve => fixtureServer.listen(0, '127.0.0.1', resolve))
      const address = fixtureServer.address()
      if (!address || typeof address === 'string') throw new Error('无法确定测试服务器端口')
      const fixture = { id: experimentId, src: `http://127.0.0.1:${address.port}/core.js` }

      // 应用启动时会用真实的播放器实验配置下载线上 core.js。先停掉这条链路，
      // 只保留本测试注入的 fixture，否则两者会抢写同一个文件导致断言偶发失败。
      await electronApp.evaluate(() => {
        const runtime = globalThis as unknown as {
          biliApp: {
            fetchService: { getPlayerConfig: () => Promise<unknown> }
            playerService: {
              fetchPlayerJs: (experiment: { id: number, src: string }) => Promise<void>
            }
          }
        }
        runtime.biliApp.fetchService.getPlayerConfig = async () => null
        const fetchFixture = runtime.biliApp.playerService.fetchPlayerJs.bind(runtime.biliApp.playerService)
        runtime.biliApp.playerService.fetchPlayerJs = experiment =>
          experiment?.src?.startsWith('http://127.0.0.1:') ? fetchFixture(experiment) : Promise.resolve()
      })

      const playerDirectory = path.join(profileDirectory, 'user-data', 'player')
      await waitForPlayerDownloadsToSettle(playerDirectory)
      rmSync(path.join(playerDirectory, 'core.js'), { force: true })

      const playerInfo = await electronApp.evaluate(async (_, fixture) => {
        const runtime = globalThis as unknown as {
          APP_HASH_CODE: string
          biliApp: {
            configService: { hashCode: string }
            playerService: {
              fetchPlayerJs: (experiment: { id: number, src: string }) => Promise<void>
              handleGetPlayerInfo: () => {
                playerExpInfo: { id?: number }
                playerSrc: string
              }
            }
            reportService: { reportPlayerPatch: () => void }
          }
        }

        // 不向远端上报测试播放器实验；其余下载、哈希和本地服务流程保持真实实现。
        runtime.biliApp.reportService.reportPlayerPatch = () => undefined
        await runtime.biliApp.playerService.fetchPlayerJs(fixture)
        return {
          ...runtime.biliApp.playerService.handleGetPlayerInfo(),
          configHash: runtime.biliApp.configService.hashCode,
          hash: runtime.APP_HASH_CODE,
        }
      }, fixture)

      expect(playerInfo.hash).toMatch(/^[0-9a-f]{32}$/)
      expect(playerInfo.configHash).toBe(playerInfo.hash)
      expect(playerInfo.playerExpInfo).toMatchObject({ id: experimentId })

      const coreUrl = new URL(playerInfo.playerSrc)
      expect(coreUrl.pathname).toBe('/player/core.js')
      expect(coreUrl.searchParams.get('id')).toBe(String(experimentId))
      expect(coreUrl.searchParams.get('token')).toBe(playerInfo.hash)
      expect(coreUrl.searchParams.get('token')).not.toBe('undefined')

      const validResponse = await fetch(coreUrl)
      expect(validResponse.status).toBe(200)
      expect(await validResponse.text()).toBe(coreSource)

      coreUrl.searchParams.set('token', 'undefined')
      const invalidResponse = await fetch(coreUrl)
      expect(invalidResponse.status).toBe(400)
      expect(await invalidResponse.json()).toEqual({ code: 400, message: 'invalid call!' })
    } finally {
      await new Promise<void>(resolve => {
        fixtureServer.close(() => resolve())
        fixtureServer.closeAllConnections()
      })
    }
  })
})
