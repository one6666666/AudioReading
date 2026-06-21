# 网页朗读助手（Chrome 扩展）

一个强大的 Chrome 浏览器插件，支持多种自然语音朗读网页文字。

## 功能

### 多语音源
- **系统语音**：使用浏览器内置 Web Speech API，调用操作系统自带语音
- **Edge 自然语音**：通过 Microsoft Edge TTS 免费 API 提供 50+ 高质量自然语音，覆盖 11 种语言
  - 🇨🇳 中文普通话（晓晓、云希、云扬等 12 种音色，含东北话）
  - 🇭🇰 粤语（曉曼、雲龍）
  - 🇹🇼 台湾中文（曉臻、雲哲）
  - 🇺🇸 美式英语（Jenny、Guy、Aria 等 13 种）
  - 🇬🇧 英式英语（Libby、Ryan 等）
  - 🇦🇺 澳洲英语（Natasha、William）
  - 🇯🇵 日语（七海、慶太）
  - 🇰🇷 韩语（선히、인준）
  - 🇫🇷 法语、🇩🇪 德语、🇪🇸 西班牙语、🇧🇷 葡萄牙语、🇮🇹 意大利语、🇷🇺 俄语、🇸🇦 阿拉伯语
- **云端语音**：支持对接自建 TTS 服务（阿里云 CosyVoice / 腾讯云 TTS），通过 `tts-service` 后端

### 核心特性
- 🎵 **语音试听**：选择前可试听每个声音的朗读效果
- ⭐ **收藏功能**：收藏常用声音，快速切换
- 🔍 **语音搜索**：按名称或语言快速筛选
- 🎭 **朗读风格**：标准播报 / 故事感 / 对话感 / 新闻播报 / 舒缓助眠
- 🎚 **精细调节**：语速 (0.5-2.0)、音调 (0-2.0)、音量 (0-1.0)、情感强度 (0-1.0)
- 💾 **自动记忆**：所有设置自动保存
- ⏯ **完整播控**：开始、暂停/继续、停止

### 中文增强
- 情感女声、温柔女声、清甜女声、主播音、沉稳男声
- 按句子和语气词动态调整语速/音调/音量，减少机器人感

## 安装方式（开发者模式）

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目目录

## 使用

1. 打开任意网页
2. 点击工具栏中的"网页朗读助手"图标
3. 在「Edge 自然语音」标签页选择喜欢的音色，点击试听
4. 调节语速、音调、音量、情感强度
5. 点击"开始朗读"

> **提示**：Edge 自然语音音质远优于系统语音，推荐优先使用。首次使用需要网络连接。

## 云端 TTS 服务（可选）

如需使用自建 TTS 后端：

1. 进入 `tts-service/` 目录配置 `.env` 文件
2. 启动服务：`docker-compose up -d` 或直接运行 FastAPI
3. 在插件「云端语音」标签页填写服务地址和 API Key
4. 点击"测试连接"确认可用

## 项目结构

```
AudioReading/
├── manifest.json          # 扩展配置 (Manifest V3)
├── popup.html             # 弹窗 UI
├── popup.css              # 弹窗样式
├── popup.js               # 弹窗交互逻辑 & 语音管理
├── content.js             # 网页文本提取 & 多后端 TTS 引擎
├── README.md
└── tts-service/           # 可选：Python TTS 后端服务
    ├── app/
    │   ├── main.py
    │   ├── config.py
    │   ├── providers/      # 阿里云 / 腾讯云 TTS
    │   └── routers/        # API 路由
    ├── docker-compose.yml
    └── requirements.txt
```

## 技术说明

- **系统语音**：基于浏览器 `speechSynthesis` API，可用声音由操作系统决定
- **Edge 自然语音**：调用 Microsoft Edge TTS 免费 API（`speech.platform.bing.com`），使用 SSML 格式合成，返回 MP3 音频
- **云端语音**：对接 FastAPI 后端，支持阿里云 CosyVoice 和腾讯云 TTS，带 Redis 缓存和 OSS 存储
- **试听功能**：发送短文本到对应 TTS 引擎，通过 Web Audio API 即时播放

## 开源中文情感语音方案（可配合使用）

如需更高品质的中文语音，可本地部署以下开源模型：

- [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) - 中文克隆与情感迁移
- [CosyVoice](https://github.com/FunAudioLLM/CosyVoice) - 阿里开源，高自然度
- [Fish-Speech](https://github.com/fishaudio/fish-speech) - 高拟真中文 TTS
- [OpenVoice](https://github.com/myshell-ai/OpenVoice) - 音色转换
- [Bert-VITS2](https://github.com/fishaudio/Bert-VITS2) - 中文生态完善

建议：本地部署后通过系统虚拟声卡回放，或接入本插件的云端 TTS 接口。
