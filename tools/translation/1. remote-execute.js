const CDP = require("chrome-remote-interface");
const { readFileSync, writeFileSync } = require("fs");
const path = require("path");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * 
 * @param {any[]} target 
 * @param {any[]} b 
 */
const mergeTranslation = (target, b) => {
  for (const item of b) {
    if (!target.find(e => e.text === item.text)) {
      target.push(item);
    }
  }
}
class PageSession {
  /**
   *
   * @param {string} pageId
   */
  constructor(pageId) {
    this.pageId = pageId;
  }
  async connect() {
    this.client = await CDP({
      target: this.pageId,
    });
  }
  async close() {
    return await this.client?.close();
  }
  async closePage() {
    return await this.client?.Page.close();
  }
  async queryTranslation() {
    const script = readFileSync(
      path.resolve(__dirname, "./gen-translation.js")
    ).toString();
    const result = await this.client.Runtime.evaluate({
      expression: script,
    });
    return JSON.parse(result.result.value);
  }
  async click(selector) {
    await this.client.Runtime.evaluate({
      expression: `document.querySelector('${selector}').click()`,
    });
  }
  async evaluate(script) {
    await this.client.Runtime.evaluate({
      expression: script,
    });
  }
  /**
   * 
   * @param {string[]} selectList 
   */
  async queryTranslationRange(selectList) {
    const result = []
    for (const select of selectList) {
      // 1. 点击
      await this.click(select);
      // 2. 等待
      await sleep(1000);
      // 3. 查询
      const translation = await this.queryTranslation();
      // 4. 合并结果
      mergeTranslation(result, translation);
    }
    return result;
  }
  
}
;
(async () => {
  let client;
  try {
    // 连接到Chrome实例
    client = await CDP({ port: 9222 });
    console.log("Connected to Chrome DevTools");

    const targets = await client.Target.getTargets();
    console.info("targets:", targets);
    const indexTarget = targets.targetInfos.find(
      (target) => target.type === "page" && target.url.includes("index.html")
    );
    console.info("indexTarget:", indexTarget);
    if (indexTarget == undefined) throw new Error("未找到index.html页面");
    const pageSession = new PageSession(indexTarget.targetId);
    await pageSession.connect();
    const result = await pageSession.queryTranslation();
    // console.info("result:", result);
    {
      // 重置，进入首页
      await pageSession.click("#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--sidebar.u_select_none > div > div > ul > li:nth-child(1) > a > p")
      await sleep(1000);
    }
    {
      // 头部5个按钮
      const headerList = Array.from({ length: 5 }, (_, i) => i + 1)
      .map(e => `#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--content.flex_col > div > div.app_home.i_page_wrapper > div.header_slot.flex_start.drag > div > div > nav > ul > li:nth-child(${e}) > span.vui_tabs--nav-link > span`)
      console.info('header length:', headerList.length)
      const list = await pageSession.queryTranslationRange(headerList);
      mergeTranslation(result, list);
    }
    {
      // 左上4个文字按钮
      const headerList = Array.from({ length: 4 }, (_, i) => i + 1)
      .map(e => `#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--sidebar.u_select_none > div > div > ul > li:nth-child(${e}) > a > p`)
      console.info('header length:', headerList.length)
      const list = await pageSession.queryTranslationRange(headerList);
      mergeTranslation(result, list);
    }
    {
      // 左下4个图标按钮
      const headerList = Array.from({ length: 4 }, (_, i) => i + 1)
      .map(e => `#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--sidebar.u_select_none > div > ul > li:nth-child(${e})`)
      console.info('header length:', headerList.length)
      const list = await pageSession.queryTranslationRange(headerList);
      mergeTranslation(result, list);
    }
    {
      // 设置
      await pageSession.click("#app > div > div.app_layout.ov_hidden.flex_start.bg_bg1.gpu-enabled > div.app_layout--sidebar.u_select_none > div > ul > li:nth-child(5) > a")
      await sleep(1000);
      const list = await pageSession.queryTranslation();
      mergeTranslation(result, list);
    }
    {
      // 上传页面
      const targetList = await client.Target.getTargets()
      const uploadPage = targetList.targetInfos.find(e => e.url.includes('videoup'))
      if (uploadPage) {
        console.info('获取上传页面数据...')
        const uploadSession = new PageSession(uploadPage.targetId);
        await uploadSession.connect();
        await sleep(1000)
        const uploadList = []
        const steps = [
          'document.querySelector("#video-up-app").__vue__.$store.state.step = 1',
          'document.querySelector("#video-up-app").__vue__.$store.state.step = 2',
          'document.querySelector("#video-up-app").__vue__.$store.state.step = 3',
        ]
        for (const step of steps) {
          await uploadSession.evaluate(step)
          await sleep(1000)
          const list = await uploadSession.queryTranslation();
          // console.info('list:', list)
          mergeTranslation(uploadList, list)
        }
        await uploadSession.closePage();
        await uploadSession.close();
        mergeTranslation(result, uploadList);
      }
    }
    writeFileSync(path.resolve(__dirname, "./result/translation.json"), JSON.stringify(result, null, 2));
    // 关闭连接
    pageSession.close();
  } catch (err) {
    console.error(err);
  } finally {
    client.close();
  }
})();
