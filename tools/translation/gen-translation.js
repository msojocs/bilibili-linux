{
  const defaultOptions = {
    ignoreId: false,
  };
  const isNodeAvailable = typeof Node !== "undefined";

  const NodeTypes = {
    ELEMENT_NODE: isNodeAvailable ? Node.ELEMENT_NODE : 1,
    TEXT_NODE: isNodeAvailable ? Node.TEXT_NODE : 3,
    DOCUMENT_TYPE_NODE: isNodeAvailable ? Node.DOCUMENT_TYPE_NODE : 10,
  };

  //获取xpath
  function getXPath(el, customOptions) {
    const options = { ...defaultOptions, ...customOptions };
    let nodeElem = el;
    if (nodeElem && nodeElem.id && !options.ignoreId) {
      return '//*[@id="' + nodeElem.id + '"]';
    }
    let parts = [];
    while (
      nodeElem &&
      (NodeTypes.ELEMENT_NODE === nodeElem.nodeType ||
        NodeTypes.TEXT_NODE === nodeElem.nodeType)
    ) {
      let numberOfPreviousSiblings = 0;
      let hasNextSiblings = false;
      let sibling = nodeElem.previousSibling;
      while (sibling) {
        if (
          sibling.nodeType !== NodeTypes.DOCUMENT_TYPE_NODE &&
          sibling.nodeName === nodeElem.nodeName
        ) {
          numberOfPreviousSiblings++;
        }
        sibling = sibling.previousSibling;
      }
      sibling = nodeElem.nextSibling;
      while (sibling) {
        if (sibling.nodeName === nodeElem.nodeName) {
          hasNextSiblings = true;
          break;
        }
        sibling = sibling.nextSibling;
      }
      let prefix = nodeElem.prefix ? nodeElem.prefix + ":" : "";
      let nth =
        numberOfPreviousSiblings || hasNextSiblings
          ? "[" + (numberOfPreviousSiblings + 1) + "]"
          : "";
      let piece =
        nodeElem.nodeType != NodeTypes.TEXT_NODE
          ? prefix + nodeElem.localName + nth
          : "text()" + (nth || "[1]");

      if (nodeElem && nodeElem.id && !options.ignoreId) {
        parts.push('/*[@id="' + nodeElem.id + '"]');
        break
      }
      else{
        parts.push(piece);
      }
      nodeElem = nodeElem.parentNode;
    }
    return parts.length ? "/" + parts.reverse().join("/") : "";
  }
  const getTranslation = () => {
    // element get
    const eles = [document.body];
    const result = [];
    while (eles.length > 0) {
      const ele = eles.pop();
      if (!ele) continue;
      if (ele.hasChildNodes()) {
        for (let i = 0; i < ele.childNodes.length; i++) {
          const child = ele.childNodes[i];
          // 忽略image
          if (child.nodeName === "IMG") continue;
          // 忽略path
          if (child.nodeName === "path") continue;
          // 忽略svg
          if (child.nodeName === "svg") continue;
          // 忽略br
          if (child.nodeName === "BR") continue;
          // 忽略source
          if (child.nodeName === "SOURCE") continue;
          // 忽略rect
          if (child.nodeName === "rect") continue;
          // 忽略circle
          if (child.nodeName === "circle") continue;
          // 忽略script
          if (child.nodeName === "SCRIPT") continue;
          if (
            child.nodeType === Node.ELEMENT_NODE && child instanceof HTMLElement &&
            (child.className.includes("bili-video-card__image") || // 视频
              child.className.includes("picture-ad-card") || // 广告
              child.className.includes("im-li-info") || // 消息
              child.className.includes("bui-progress-val") || // 百分比
              child.className.includes("bpx-player-ctrl-time-seek") ||
              child.className.includes("bili-bangumi-card__image") ||
              child.className.includes("dynamic_rich_text--content") ||
              child.className.includes("dynamic_card_archive--mask") ||
              child.className.includes("dynamic_card_module_author--info--name") ||
              child.className.includes("bpx-player-dm-mask-wrap") ||
              child.className.includes("home_live--users-wrap") ||
              child.className.includes("bili-live-card") ||
              child.className.includes("dynamic_live--ups") ||
              child.className.includes("custom-setting") ||
              child.className.includes("dynamic_card_live_rcmd--mask") ||
              child.className.includes("up-name ") ||
              child.className.includes("video-title") ||
              child.className.includes("dynamic_card_module_forward_author") ||
              child.className.includes("desc-info desc-v2") ||
              (child.className.includes("up_list--item--title") && child.textContent !== '全部动态') ||
              child.className === "info"
            )
          )
            continue;
          if (
            /^\d+:\d+$/.test(child.textContent)
            || /^\d+\.\d+\.\d+$/.test(child.textContent)
            || /^\d+ \/ \d+$/.test(child.textContent)
            || /^(\d+)$/.test(child.textContent)
          ) continue
          eles.push(child);
        }
        {
          const title = ele.attributes.getNamedItem("title");
          if (title && title.textContent.length > 0) {
            const p = getXPath(ele);
            result.push({
              type: "title",
              xpath: p,
              text: title.value,
              // ele
            });
          }
        }
        {
          const placeholder = ele.attributes.getNamedItem("placeholder");
          if (placeholder && placeholder.textContent.length > 0) {
            const p = getXPath(ele);
            result.push({
              type: "placeholder",
              xpath: p,
              text: placeholder.value,
              // ele
            });
          }
        }
        continue;
      }
      if (ele instanceof HTMLElement) {
        const placeholder = ele.attributes.getNamedItem("placeholder");
        if (placeholder && placeholder.textContent.length > 0) {
          const p = getXPath(ele);
          result.push({
            type: "placeholder",
            xpath: p,
            text: placeholder.value,
            // ele
          });
        }
      }
      // 单元素节点
      if (ele.textContent.length === 0) continue;
  
      if (!isNaN(Number(ele.textContent))) continue
      
      const p = getXPath(ele);
      result.push({
        type: "content",
        xpath: p,
        text: ele.textContent,
        // ele
      });
    }
    return result;
  };
  const result = getTranslation()
  for (const item of result) {
    item.text
  }
  JSON.stringify(result);
  getTranslation();
}
