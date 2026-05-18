# ChatGPT 问题导航

一个基于 Tampermonkey 的 ChatGPT 对话目录脚本。它会在 ChatGPT 对话页右侧显示你问过的问题，点击列表项即可滚动定位到对应提问。

## 功能

- 自动收集当前对话中的用户提问
- 右侧浮窗展示问题目录
- 支持搜索提问内容
- 点击问题后平滑滚动并短暂高亮
- 支持刷新、折叠和上下拖动浮窗
- 新聊天页自动清空旧问题列表
- 不请求网络，不存储聊天内容

## 安装

1. 安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开脚本文件：
   [chatgpt-question-navigator.user.js](https://github.com/carrrrotttt/chatgpt-question-navigator/raw/main/chatgpt-question-navigator.user.js)
3. Tampermonkey 弹出安装页后点击安装。
4. 打开或刷新 ChatGPT 对话页。

## 使用

进入 ChatGPT 对话页后，右侧会出现标题为“探赜索隐”的浮窗。

- 点击问题：滚动到对应提问位置
- 搜索框：筛选问题内容
- 刷新按钮：重新扫描当前对话
- 折叠按钮：收起或展开浮窗
- 拖动标题栏：调整浮窗上下位置

## 适配范围

脚本当前匹配：

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

## 说明

ChatGPT 页面可能会更新 DOM 结构。如果未来出现无法收集问题或定位不准，可以更新脚本中的消息选择器和滚动定位逻辑。

当前版本：`1.3.1`
