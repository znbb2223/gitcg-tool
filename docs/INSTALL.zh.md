# 安装与运行

## 支持范围

| 平台 | 要求 |
|---|---|
| Android | **10 及以上**（API 29+），WebView 105+ 体验完整，80~104 基本可用 |
| 电脑浏览器 | Chrome / Edge 100+，本地起服务即可 |
| 屏幕 | 横屏 20:9 最佳；16:9 / 16:10 / 3:2 / 19.5:9 也支持 |

## 安卓安装

1. 拿到 `gitcg-0.11.xxx.apk`；
2. 手机上点开安装包，允许「安装未知应用」；
3. 安装完成后桌面出现「七圣召唤工具」；
4. 首次启动会初始化数据（几秒），之后可**飞行模式**使用。

> 覆盖安装失败（签名不一致）：先卸载旧版本再装。

## 第一次打开

1. 首页是六个入口：模拟器 / 组牌器 / 牌组库 / 卡组实验室 / 摆盘器 / 关于；
2. 右上角齿轮 → 设置：主体横竖屏、对局布局、AI 数据导入；
3. 直接点「七圣召唤模拟器」就能开一局。

## 从源码构建（非开发者）

只需要一个脚本文件 `build-gitcg-apk.sh`：

```bash
sh build-gitcg-apk.sh
```

脚本自动装工具链、拉最新源码、下数据、抓素材、出 APK。详细见
[BUILD.zh.md](./BUILD.zh.md) 0.4 节。

## 电脑 / 网页版

```bash
# 一键：抓素材 → 构建 → 打 APK（详见 docs/BUILD.zh.md 0.5 节）
sh build-oneclick.sh

# 或手动：
pnpm install --config.package-import-method=copy
pnpm --filter "@gi-tcg/standalone..." build
cd packages/standalone/dist && python3 -m http.server 8899
```

打开 `http://127.0.0.1:8899/hub.html`。

## 卸载与重置

- **卸载**：系统设置 → 应用 → 七圣召唤工具 → 卸载；
- **重置数据**（不清除安装）：设置 → 应用 → 存储 → 清除数据；
- 清除数据会丢掉设置、收藏、实验室结果、导入的 AI 经验，
  建议先「设置 → 导出 AI 数据」备份。

## 常见安装问题

| 现象 | 处理 |
|---|---|
| 解析包错误 | 下载不完整，重新拷贝 APK |
| 应用未安装 / 签名冲突 | 卸载旧版再装 |
| 打开白屏 | 更新 Android System WebView |
| 打开闪退 | 系统低于安卓 10，改用网页版 |


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
