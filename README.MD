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

本项目完全开源，且没有任何代码加密操作，如有疑虑请自行审查代码或停止使用相关文件。

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

### 额外补充

如果阁下不喜欢电脑多装一个 Electron，可以自行提取发布版的 `app.asar` 并使用已安装 Electron 启动，建议的 Electron 版本是：`33.0.2`

## Flag参数配置

支持的参数列表：
https://www.electronjs.org/docs/latest/api/command-line-switches

1. 创建 `flags` 文件

   在 `~/.config/bilibili` 目录下创建 `bilibili-flags.conf` 文件

2. 填写配置

   ```
   --disable-gpu
   --key=value
   ```

## Wayland 窗口置顶操作

从 v1.15.2-3 开始支持。

参考规则设置：https://github.com/msojocs/bilibili-linux/issues/136#issuecomment-2480558792

## 开发者工具

现已支持自行打开开发者工具，方法如下：

尝试按下<kbd>F12</kbd>，如果没有反应就是没开；

登录界面有两层，内层右键打开，外层<kbd>F12</kbd>打开。

## 关于龙芯

https://areweloongyet.com/docs/loong-or-loongarch

|发行版|架构标识符|
|------|----------|
|AOSC OS|`loongarch64`|
|Debian|<ul><li>旧世界：`loongarch64`</li><li>新世界：`loong64`</li></ul>|
|Gentoo|`loong`|
|Loong Arch Linux|`loong64`|
|RPM 系|`loongarch64`|
|Slackware|`loong64`|

## 预览

![推荐](res/screenshots/1.png)

![直播](res/screenshots/live.png)

![检查更新](res/screenshots/update.png)

![退出](res/screenshots/exit.png)

![漫游](res/screenshots/roaming.png)

## 感谢以下项目

1. [BiliRoaming](https://github.com/yujincheng08/BiliRoaming)
2. [解除B站区域限制](https://github.com/ipcjs/bilibili-helper)

## 免责声明

哔哩哔哩客户端版权归上海宽娱数码科技有限公司所有；

对于使用本项目产生的额外问题，如账户封禁被盗等，维护者不对此负责，请谨慎使用；

如有不当之处，请联系本人，邮箱：jiyecafe@gmail.com
