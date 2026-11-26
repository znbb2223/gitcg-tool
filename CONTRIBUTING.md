# 参与贡献

感谢愿意一起完善这个工具。下面是动手前需要知道的事。

## 先读

- [README.md](./README.md)：项目定位与功能
- [docs/ARCHITECTURE.zh.md](./docs/ARCHITECTURE.zh.md)：代码结构与数据流
- [docs/BUILD.zh.md](./docs/BUILD.zh.md)：怎么把项目跑起来
- [docs/PITFALLS.zh.md](./docs/PITFALLS.zh.md)：那些坑，先看一眼能省半天

## 提 Issue

请带上：

1. **版本号**（工具「关于」页可见，例如 `0.11.156`）；
2. **设备与系统**（安卓版本、屏幕比例、WebView 版本）；
3. **复现步骤**：从首页开始点哪几个入口、点了什么；
4. **期望 vs 实际**（有截图更好）；
5. 如果是布局问题，注明是**横屏还是竖屏**、什么比例。

不要贴账号、密钥、个人信息。

## 提 PR

- 一个 PR 只做一件事，标题写清「模块: 做了什么」，例如
  `deck-builder: 修复窄屏按钮被裁`；
- 改了 UI 请附前后截图；改了逻辑请说明验证方式；
- 不要提交 `node_modules`、`dist`、美术素材、大体积数据文件；
- 构建必须能过（见 BUILD 文档的顺序）。

## 代码风格

- TypeScript / TSX，缩进 2 空格；
- 提交前跑 `pnpm lint`（如果可用）和一次 `standalone build`；
- 中文注释可以，函数名用英文。

## 许可

提交即表示同意以 **AGPL-3.0** 分发你的贡献（与本项目一致）。
