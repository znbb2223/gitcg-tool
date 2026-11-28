# 踩坑清单

按主题整理，格式：**现象 → 根因 → 解法**。

---

## 一、布局与屏幕比例

### 1. 元素贴边被裁 / 木框缺一角
- 现象：非 20:9 屏幕下，棋盘四边木框缺失，元素贴边。
- 根因：棋盘内部是绝对 px 定位，`TransformWrapper` 用 contain 缩放后留边。
- 解法：20:9 走 `classic`；其他比例走锚点模式（`board-layout.ts`），
  以 916×412 为基准按十字中心偏移。

### 2. 上下牌堆不对称
- 现象：镜像锚点算出来上牌堆总是偏一点。
- 根因：渲染链存在 0.8 投影系数，视觉位置 ≠ 布局位置。
- 解法：按「视觉块 = 0.8 × 扁平块」反解上牌堆锚点公式（实测标定）。

### 3. 手牌条位置随比例漂移
- 现象：手牌离屏幕边缘的距离每个比例都不一样。
- 根因：手牌按单位缩放，没做像素约束。
- 解法：手牌改成**固定像素**（己方 37.2px / 敌方 44.8px，20:9 实测），
  锚点按 `unitPx` 反算。

### 4. 20:9 上设置三选项无效
- 现象：用户在 20:9 手机上切换布局模式没反应。
- 根因：20:9 有专用回滚布局（0.11.121）。
- 解法：20:9 强制 `classic` + `__GI_CLASSIC_20X9__`，UI 上说明。

### 5. `100dvh !important` 与 inline 高度冲突
- 现象：锚点模式下内容高度被压回旧值。
- 根因：CSS 的 `100dvh !important` 覆盖了 `autoHeight` 的内联高度。
- 解法：`spread` 模式跳过 `autoHeight`。

---

## 二、安卓 WebView

### 6. 「网页不能打开」
- 现象：APK 里所有页面打不开。
- 根因：装了两个 `WebViewClient`（一个拦截、一个 onPageFinished），后者覆盖前者。
- 解法：合并成一个 client，拦截与回调都在里面。

### 7. 去掉网络权限后页面打不开
- 现象：删了 `INTERNET` 权限后请求全失败。
- 根因：早期用 `ServerSocket` 起本地 HTTP 服务。
- 解法：改成 `shouldInterceptRequest` 直接从 `assets/` 出内容；保留
  `usesCleartextTraffic="true"`（否则拦截的 http origin 被拦）。

### 8. 设置/进度不保存
- 现象：重启应用后设置、牌组缓存丢失。
- 根因：`file://` origin 下 localStorage 行为不稳定。
- 解法：固定 origin `http://127.0.0.1:8765` 走拦截，localStorage 有稳定域。

### 9. 安装覆盖失败
- 现象：`INSTALL_FAILED_UPDATE_INCOMPATIBLE`。
- 根因：换了签名（debug keystore 不一致）。
- 解法：卸载旧版再装，或长期使用同一 keystore。

---

## 三、牌组与数据

### 10. 同一套牌显示成「实验室新发现」
- 根因：牌组码对卡牌顺序敏感，实验室规范化后的码 ≠ 库里的原始码。
- 解法：跨页传参用牌组库条目 `id`（`?id=`），不用牌组码。

### 11. 社区牌组被本地条目覆盖
- 根因：索引未加载完时把社区牌组误判为新发现写入本地，本地又覆盖社区。
- 解法：索引就绪前不写新发现；`libraryByFp` 里社区优先。

### 12. 对局详情 `seed is not defined`
- 根因：详情生成时遗漏 `const seed`。
- 解法：`const seed = (Math.random()*1e9)>>>0`。

---

## 四、交互与缓存

### 13. 快照局不记缓存
- 现象：摆盘器打完一局，返回后缓存里没有。
- 根因：记录写在 `onCleanup`，但历史后退走 bfcache 不卸载组件，回调不触发。
- 解法：改挂 `pagehide`；门槛降到 >1 帧；结束帧（`canResume=false`）立即记录。

### 14. 返回后卡死
- 现象：从日志回放返回对局卡死。
- 根因：`showLogIndex(0)` 把切片长度变成 0。
- 解法：恢复为正确索引，不要用 0 当「退出」。

### 15. 闪屏（竖屏→横屏）
- 根因：实验室/牌组库脚本里写死 `setOrientation("portrait")`。
- 解法：跟随「主体方向」设置；入口跳转前先转屏。

### 16. 筛选弹层空白
- 两处坑：① 选中态选择器 `grid-area` 与 `FM:grid-area` 不一致；
  ② ✕ 的 CSS 用兄弟选择器，但元素是后代。
- 解法：统一选择器；✕ 改为 `:checked ~ div[class*="FM:grid-area"] .filter-menu-close`。

### 17. 组牌器右侧按钮点不到
- 根因：操作行不换行，超出可视宽度。
- 解法：`flex-wrap` + 按钮文案缩短（入库 / 合法性：开）。

---

## 五、构建

### 18. `pnpm build` 报 `Unexpected token`
- 根因：手改括号（删 `if (false)` 块）导致大括号错位，`const` 被挤出函数。
- 解法：恢复括号；用 vite 构建报错的行号定位。

### 19. `known is not defined` / 日志停更
- 根因：多余的 `}` 把 `const titleLine` 挤出了 `for` 循环。
- 解法：删掉多余括号。

### 20. pnpm 安装后原生模块不可用
- 根因：pnpm 默认 hardlink 在某些文件系统上失败。
- 解法：`pnpm install --config.package-import-method=copy`。

---

## 六、训练器

### 21. Windows 下训练卡在第一批
- 根因：`child_process.spawn` 的退出事件在某些环境不触发。
- 解法：改用 `worker_threads`，进度用 `postMessage` 回报。

### 22. 训练跑完进程不退出
- 现象：退出码 124（超时）。
- 根因：stdin 保持打开。
- 解法：结束前 `process.stdin.pause(); process.exit(0);`。

### 23. `both` 模式下 AI 局数为 0
- 根因：AI 份额计算在 worker 里重复取整为 0。
- 解法：主进程预先算好 `half` / `shares` 传给 worker。

### 24. `.bat` 中文乱码导致 cmd 解析失败
- 根因：批处理文件用 UTF-8 中文。
- 解法：纯 ASCII + 存在性检查 + `pause`。


## 七、构建、打包与发布（2026-11-28 补）

### 25. 干净 clone 构建报 `Cannot find module '@gi-tcg/typings'`
- 根因：只跑 `assets-manager → web-ui-core → deck-builder → standalone`，漏了底层包。
- 解法：`pnpm --filter "@gi-tcg/standalone..." build`（拓扑构建）。

### 26. `android/res` 不存在导致 aapt 失败
- 根因：launcher 图标没入库（`AndroidManifest` 引用了 `@mipmap/ic_launcher`）。
- 解法：仓库补 `android/res/mipmap-hdpi-v4/ic_launcher.png`；或从旧 APK 的 `res/mipmap-hdpi-v4/ic_launcher.png` 提取。

### 27. arm64/手机装依赖时 puppeteer postinstall 失败
- 根因：puppeteer 安装脚本尝试下载 Chromium，arm64 无对应包。
- 解法：设 `PUPPETEER_SKIP_DOWNLOAD=1`、`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`；失败再 `--ignore-scripts`。

### 28. Termux `pkg install` 一个包不存在，整条失败
- 根因：Termux 仓库没有 `zipalign`，apt/pkg 遇到未知包直接退出。
- 解法：逐包安装并容错；缺 zipalign 时用复制 shim（APK 可安装，但非官方对齐），或改用 proot Ubuntu。

### 29. 素材抓了但 APK 缺卡面
- 根因：`download-assets` 只抓 icon/unspecified/UI；卡面与全尺寸图分别由 `download-cardface`、`download-full` 提供。
- 解法：四个脚本都跑，并按「总文件 ≥14000、`cardFace/full.webp` ≥800、UI ≥100、datum ≥4000」校验。

### 30. Release 资产中文名被截断
- 根因：GitHub Release 资产文件名不接受中文，会丢字符。
- 解法：用 ASCII 文件名（`gitcg-tool-0.11.158-7.2.0.apk`），同页附 `SHA256SUMS.txt`，README 用直链。

### 31. 体积口径混用（149 vs 202MB）
- 根因：解包字节与 `du` 磁盘占用不是一回事。
- 解法：统一写「解包 X MB / du Y MB」；卡图 149/202，完整 Web 189/240。

---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md)
- [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
