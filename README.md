# ChatGPT Deep Research Width

一个用于 Chrome 的 Manifest V3 扩展，用来放宽 ChatGPT Deep Research 报告查看页的显示宽度，提供 `1.5x` 和 `2x` 两档。

## 设计依据

你提供的页面快照里，主内容区使用了下面这组变量：

- `--thread-content-max-width: 40rem`
- `@w-lg/main:[--thread-content-max-width:48rem]`

也就是说在大屏下主报告容器最大宽度约为 `48rem = 768px`。再扣除左右 margin / padding，实际可读宽度会进一步缩小，所以表格会显得非常拥挤。

这个扩展的策略是：

- 检测页面中是否存在 `iframe[title="internal://deep-research"]`
- 若存在，则把外层 thread 容器和 deep research 的 fixed shell 一并放宽
- 若不存在，则不改动普通聊天页面

## 文件说明

- `manifest.json`: 扩展配置
- `popup.html`: 弹出面板
- `popup.css`: 弹出面板样式
- `popup.js`: 保存用户选择并通知当前标签页
- `content.js`: 动态检测并调整报告宽度

## 安装方式

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择目录 `/mnt/d/aitool/chatgptdr/chatgpt-deep-research-width`

Windows 资源管理器里对应路径通常是：

- `D:\aitool\chatgptdr\chatgpt-deep-research-width`

## 使用方式

1. 打开 ChatGPT Deep Research 报告页面
2. 点击扩展图标
3. 选择 `默认`、`1.5 倍` 或 `2 倍`
4. 当前页会立即应用

## 已知限制

- ChatGPT 前端 DOM 结构如果后续改版，选择器可能需要跟着调整
- 这个原型优先兼容你提供的页面结构，以及同类的 Deep Research 查看页
- 由于 deep research 内容运行在内部 iframe 中，扩展无法直接改 iframe 内部排版，所以方案采用“放大外层承载宽度”的方式
