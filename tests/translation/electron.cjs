const { app, BrowserWindow } = require('electron');
const { readFileSync } = require('node:fs');
const path = require('node:path');

app.setPath('userData', process.env.TRANSLATION_TEST_PROFILE);
app.disableHardwareAcceleration();
// Keep the process alive between isolated browser fixtures.
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const bundle = readFileSync(process.env.TRANSLATION_TEST_BUNDLE, 'utf8');
  const expressions = [
    'translationTests.runTranslationTests()',
    'translationTests.runBootstrapTests("en", "en")',
    'translationTests.runBootstrapTests("zhCn", "zh-CN")',
    'translationTests.runBootstrapTests("fr", "zh-CN")',
    'translationTests.runBootstrapTests("en", "zh-CN", false, true)',
    'translationTests.runBootstrapTests(null, "zh-CN", true)',
  ];
  for (const expression of expressions) {
    const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
    // The fixture uses a local document with no access to client sessions or Bilibili services.
    await window.loadFile(path.join(__dirname, 'fixture.html'));
    console.log(await window.webContents.executeJavaScript(bundle + '\n' + expression));
    window.destroy();
  }
  console.log('[TranslationTests] COMPLETE');
  app.exit(0);
}).catch(error => {
  console.error(error);
  app.exit(1);
});
