const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createPattern, generateCandidates } = require('../../tools/translation/2. gen-ts.js');

async function main() {
  for (const text of ['分辨率最大支持 3840*2160', '(2小时/15天)', '客户端缓存（已缓存：1.2 MB）', '版本 [1]+(2)?']) {
    const pattern = new RegExp(createPattern(text));
    assert.ok(pattern.test(text), text);
    assert.equal(pattern.test('prefix ' + text), false);
  }
  assert.equal(new RegExp(createPattern('分辨率最大支持 3840*2160')).test('分辨率最大支持 38402160'), false);
  const candidates = generateCandidates([{ text: '确定\n关闭' }, { text: '共1条回复' }, { text: '共2条回复' }]);
  assert.equal(candidates.simple['确定\n关闭'], '');
  assert.equal(candidates.rules.length, 1);

  const { build } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react-swc');
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [react()],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: false,
      lib: { entry: path.join(__dirname, 'browser.ts'), name: 'translationTests', formats: ['iife'] },
    },
  });
  const script = result[0].output.find(output => output.type === 'chunk').code;
  const directory = mkdtempSync(path.join(tmpdir(), 'bilibili-translation-test-'));
  const bundle = path.join(directory, 'tests.js');
  writeFileSync(bundle, script);
  const localElectron = path.resolve(__dirname, '../../electron/electron');
  const executable = process.env.TRANSLATION_ELECTRON_BINARY || (existsSync(localElectron) ? localElectron : require('electron'));
  try {
    const env = { ...process.env, TRANSLATION_TEST_BUNDLE: bundle, TRANSLATION_TEST_PROFILE: directory };
    delete env.ELECTRON_RUN_AS_NODE;
    let completed = false;
    const code = await new Promise((resolve, reject) => {
      const child = spawn(executable, ['--no-sandbox', path.join(__dirname, 'electron.cjs')], { env, stdio: ['inherit', 'pipe', 'inherit'] });
      let output = '';
      child.stdout.on('data', chunk => {
        process.stdout.write(chunk);
        output += chunk.toString();
        completed = output.includes('[TranslationTests] COMPLETE');
      });
      const timer = setTimeout(() => { child.kill(); reject(new Error('Translation tests timed out')); }, 90000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); resolve(signal || code); });
    });
    if (code !== 0) throw new Error(`Translation tests exited with ${code}`);
    if (!completed) throw new Error('Electron exited before all translation tests completed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
