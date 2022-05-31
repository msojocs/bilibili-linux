<div align="center">

  <img src="./res/icons/bilibili.svg" height="100px" width="100px"/>

  <h3>哔哩哔哩 Linux版</h3>
  <br>

----


[![aur](https://img.shields.io/aur/version/bilibili-bin)](https://aur.archlinux.org/packages/bilibili-bin)

  这是哔哩哔哩 Linux版
  
  SVG图标来自 [@Peternal](https://github.com/Peternal)

  <br>
</div>

## 介绍

本项目用到了：

1. 反混淆
2. 调试
3. 脑子

## 特点：

1. 没有讨厌的标题栏
2. 支持小分辨率屏幕全屏
3. 检查更新支持
4. 有能够关闭程序的菜单
5. 支持漫游
6. 外区搜索
7. [弹幕共享](docs/help/弹幕共享.MD)

## 使用方法

### 自动化构建

请到 Release 页面下载：

https://github.com/msojocs/bilibili-linux/releases

即时构建版本：

https://github.com/msojocs/bilibili-linux/releases/tag/continuous

### 手动构建

1. 拉取代码
   ```
   git clone https://github.com/msojocs/bilibili-linux.git
   cd bilibili-linux
   ```
2. 安装
   ```
   tools/setup-bilibili
   ```
3. 启动
   ```
   bin/bilibili
   ```
### AppImage 安装

请使用 [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher)

## 预览

![推荐](res/screenshots/1.png)

![直播](res/screenshots/live.png)

![检查更新](res/screenshots/update.png)

![退出](res/screenshots/exit.png)

![漫游](res/screenshots/roaming.png)

## 感谢以下项目

1. [BiliRoaming](https://github.com/yujincheng08/BiliRoaming)
2. [解除B站区域限制](https://github.com/ipcjs/bilibili-helper)
