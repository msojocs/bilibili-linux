import { createRoot } from "react-dom/client";
import SkipNoticeWrap from "../setting/sponsor-block/SkipNoticeWrap";

export const registerSponsorBlock = () => {
  const rootStore = window.danmakuManage.rootStore
  const noticePanel = document.createElement('div')
  noticePanel.classList.add('bpx-player-sponsor-panel-wrap')
  createRoot(noticePanel).render(SkipNoticeWrap())
  rootStore.nodes.videoArea.appendChild(noticePanel)
  
};