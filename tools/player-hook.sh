#!/bin/bash

# 暴露弹幕管理接口
sed -i 's#this.initDanmaku(),this#this.initDanmaku(),window.danmakuManage = this,this#' app/render/assets/lib/core.js