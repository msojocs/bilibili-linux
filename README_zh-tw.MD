**[简体中文](README.MD) | 繁體中文**

<div align="center">

  <img src="./res/icons/bilibili.svg" height="100px" width="100px"/>

<h3>嗶哩嗶哩 Linux版</h3>
<br>

----

[![aur](https://img.shields.io/aur/version/bilibili-bin)](https://aur.archlinux.org/packages/bilibili-bin)

  這是嗶哩嗶哩 Linux版

  SVG圖標來自 [@Peternal](https://github.com/Peternal)

  <br>
</div>

## 介紹

本項目用到了：

1. 反混淆
2. 調試
3. 腦子

本項目完全開源，且沒有任何代碼加密操作，如有疑慮請自行審查代碼或停止使用相關文件。

## 特點

1. 沒有討厭的標題欄
2. 支持小分辨率屏幕全屏
3. 檢查更新支持
4. 有能夠關閉程序的菜單
5. 支持漫遊
6. 外區搜索
7. [彈幕共享](docs/help/弹幕共享_zh-tw.MD)

## 使用方法

### 自動化構建

請到 Release 頁面下載：

https://github.com/msojocs/bilibili-linux/releases

即時構建版本：

https://github.com/msojocs/bilibili-linux/releases/tag/continuous

### 手動構建

1. 拉取代碼
   ```
   git clone https://github.com/msojocs/bilibili-linux.git
   cd bilibili-linux
   ```
2. 安裝
   ```
   tools/setup-bilibili
   ```
3. 啟動
   ```
   bin/bilibili
   ```
### AppImage 安裝

請使用 [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher)

### 額外補充

如果閣下不喜歡電腦多裝一個 Electron，可以自行提取發布版的 `app.asar` 並使用已安裝 Electron 啟動，建議的 Electron 版本是：`33.0.2`

## Flag參數配置

支持的參數列表：
https://www.electronjs.org/docs/latest/api/command-line-switches

1. 創建 `flags` 文件

   在 `~/.config/bilibili` 目錄下創建 `bilibili-flags.conf` 文件

2. 填寫配置

   ```
   --disable-gpu
   --key=value
   ```

## Wayland 窗口置頂操作

從 v1.15.2-3 開始支持。

參考設置：https://github.com/msojocs/bilibili-linux/issues/136#issuecomment-2480558792

## 開發者工具

現已支持自行打開開發者工具，方法如下：

嘗試按下<kbd>F12</kbd>，如果沒有反應就是沒有開啟；

登錄界面有兩層，內層右鍵打開，外層<kbd>F12</kbd>打開。

## 關於龍芯

https://areweloongyet.com/docs/loong-or-loongarch

|發行版|架構標識符|
|------|----------|
|AOSC OS|`loongarch64`|
|Debian|<ul><li>舊世界：`loongarch64`</li><li>新世界：`loong64`</li></ul>|
|Gentoo|`loong`|
|Loong Arch Linux|`loong64`|
|RPM 系|`loongarch64`|
|Slackware|`loong64`|

## 預覽

![推薦](res/screenshots/1.png)

![直播](res/screenshots/live.png)

![檢查更新](res/screenshots/update.png)

![退出](res/screenshots/exit.png)

![漫遊](res/screenshots/roaming.png)

## 感謝以下項目

1. [BiliRoaming](https://github.com/yujincheng08/BiliRoaming)
2. [解除B站區域限制](https://github.com/ipcjs/bilibili-helper)

## 免責聲明

嗶哩嗶哩客戶端版權歸上海寬娛數碼科技有限公司所有；

對於使用本項目產生的額外問題，如賬戶封禁被盜等，維護者不對此負責，請謹慎使用；

如有不當之處，請聯繫本人，郵箱：jiyecafe@gmail.com