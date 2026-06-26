# 网页翻译助手（Chrome 扩展）

这是一个独立的 Chrome 扩展示例仓库，提供“翻译当前网页主要内容”的能力。

## 功能

- 一键翻译当前网页正文（优先 `article/main`，回退 `body`）。
- 支持源语言自动检测。
- 支持常见目标语言切换。
- 自动保存上次语言配置。

## 开发安装

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择 `chrome-translate-extension` 目录

## 文件结构

- `manifest.json`：扩展配置。
- `popup.*`：弹窗 UI 和交互。
- `content.js`：提取网页文本并替换翻译结果。
- `background.js`：调用翻译接口。

## 注意事项

当前示例使用 `translate.googleapis.com` 的公开接口形式，仅用于学习与原型验证。若用于生产场景，建议接入正式翻译 API 并完善鉴权、配额与错误重试。
