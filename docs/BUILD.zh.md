# 构建与打包（从零到可运行）

> 目标：拿到仓库后按本文顺序，**15 分钟**内跑起网页版，或打出可安装的 APK。
> 三条铁律：**环境版本对、依赖装对、构建顺序对**。顺序错了会出现一堆"模块找不到"的假错误。

## 0. 环境要求与自检

| 工具 | 要求 / 已验证版本 | 用途 |
|---|---|---|
| Node.js | **22+**（验证 24.22） | 引擎用了 iterator helpers，20 及以下会报 `.entries().filter is not a function` |
| pnpm | 10+（验证 12.13） | monorepo 依赖与构建 |
| Python 3 | 3.10+ | 抓素材、本地静态服务、训练脚本 |
| JDK | 17+（验证 21） | APK 的 `javac` / `keytool` |
| Android SDK | `platforms/android-23/android.jar` | `aapt -I` 编译资源 |
| build-tools | 含 `d8`（示例 `/opt/android/bt/android-14`） | dex 编译 |
| aapt / zipalign / apksigner | 系统包（Debian 可用） | 资源打包 / 对齐 / 签名 |
| 磁盘 | ≥ 3GB 空闲 | Web 产物约 240MB、APK 约 150MB |

```bash
node -v && pnpm -v && python3 -V && java -version 2>&1 | head -1
which aapt zipalign apksigner
ls "$ANDROID_SDK/platforms/android-23/android.jar" 2>/dev/null || echo "缺 android.jar"
```

## 1. 获取代码与依赖

```bash
git clone <仓库地址> && cd gitcg-tool
pnpm install --config.package-import-method=copy
```

- `.npmrc` 里已经设置 `engine-strict=false`（Node 版本不完全匹配也能装）。
- 国内网络建议配镜像：`pnpm config set registry https://registry.npmmirror.com`。
- `ERR_PNPM_IGNORED_BUILDS` 可以忽略（只是原生构建脚本没跑）。
- 容器/手机上 pnpm 默认的 hardlink 可能失败，所以**必须**带 `--config.package-import-method=copy`。

## 2. 素材与数据（必读，仓库不含）

仓库**不包含**游戏美术素材与社区牌组库（版权 + 体积）。按
[ASSETS.zh.md](./ASSETS.zh.md) 执行抓取脚本，产物必须落在：

| 产物 | 位置 | 缺失表现 |
|---|---|---|
| 卡面 / 图标 / UI 素材 | `packages/standalone/public/assets-local/` | 白屏、卡面空白、图标缺失 |
| 牌组库 / 筛选元数据 | `packages/standalone/public/data/` | 牌组库 0 套、组牌器无卡可选 |

> 不抓素材也能构建成功，只是页面基本是空壳——**这不是构建失败**，先确认素材目录有没有东西。

## 3. 构建 Web（顺序不能乱）

```bash
pnpm --filter @gi-tcg/assets-manager build   # 1) 资源清单
pnpm --filter @gi-tcg/web-ui-core build      # 2) 对局界面组件
pnpm --filter @gi-tcg/deck-builder build     # 3) 组牌器组件
pnpm --filter @gi-tcg/standalone build       # 4) 独立应用（最后）
```

顺序错误的典型报错：`Cannot find module '@gi-tcg/web-ui-core'` 或类型文件缺失。
产物在 `packages/standalone/dist/`：

- `index.html` = **模拟器**（游戏页，壳里要改名成 `app.html`）
- `hub.html` = **首页**（壳里要改名成 `index.html`）
- 其余：`lab.html`、`deck-builder.html`、`deck-library.html`、`state-editor.html`、`ai-settings.html`

## 4. 本地运行 / 预览

```bash
cd packages/standalone/dist && python3 -m http.server 8899
```

| 页面 | 地址 |
|---|---|
| 首页 | `http://127.0.0.1:8899/hub.html` |
| 模拟器（横屏） | `http://127.0.0.1:8899/index.html` |
| 卡组实验室 | `http://127.0.0.1:8899/lab.html` |
| 组牌器 | `http://127.0.0.1:8899/deck-builder.html` |
| 牌组库 | `http://127.0.0.1:8899/deck-library.html` |
| 摆盘器 | `http://127.0.0.1:8899/state-editor.html` |

调试参数：`?debugLayout=1` 画布局框、`?dumpLayout=1` 录锚点、`?debugSearch=1` 输出实验室搜索过程。

## 5. 打包 APK

```bash
# 1) 把 Web 产物放进安卓壳工程（目录名必须是 dist-lab）
cd android
rm -rf dist-lab && cp -r ../packages/standalone/dist dist-lab

# 2) 对调入口（关键！）
mv dist-lab/index.html dist-lab/app.html      # 模拟器 → app.html
mv dist-lab/hub.html   dist-lab/index.html    # 首页 → index.html

# 3) 打包 + 签名
./build.sh
# 产物：android/build/gitcg.apk
```

**路径可覆盖**（换机器不用改脚本）：
`ANDROID_SDK`、`ANDROID_PLATFORM`（默认 23）、`BUILD_TOOLS`（含 d8）、`WEB`、`OUT`、`KEYSTORE`、`KS_PASS`。
缺依赖时脚本第一步就会报 `缺少依赖: …`。

`build.sh` 的六步：拷贝 Web 产物 → `aapt package` 资源 → `javac` → `d8` 编译 dex →
zip + `zipalign` → `apksigner sign`。

### 校验（每次都要）

```bash
cd android/build
aapt dump badging gitcg.apk | head -2                 # 包名 / versionCode / versionName
unzip -l gitcg.apk | grep -E "assets/web/(index|app)\.html"
apksigner verify --print-certs gitcg.apk | head -2
W=$(unzip -l gitcg.apk | grep -o "assets/web/assets/search.worker-[^\"]*\.js" | head -1)
unzip -p gitcg.apk "$W" | grep -c realisticHidden      # 期望 1
```

### 签名与升级

- 首次构建会在 `android/gitcg.jks` 生成 keystore（密码 `gitcgapk`，可用 `KS_PASS` 覆盖）。
  **务必备份**：换签名 = 只能卸载重装，本地存档一起清空。
- 升级安装：`versionCode` 必须比旧版大；同版本号可覆盖安装（系统允许，但不推荐）。
- 版本号要**同时**改两处：`packages/standalone/hub.html` 的 `<b id="buildNo">` 和
  `android/src/AndroidManifest.xml` 的 `versionCode` / `versionName`。

## 6. 常见失败（按现象查）

| 现象 | 原因 | 处理 |
|---|---|---|
| `.entries().filter is not a function` | Node < 22 | 升级 Node 到 22+ |
| `Cannot find module '@gi-tcg/web-ui-core'` | 被依赖包没先构建 | 按第 3 节顺序 |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm 拒绝跑原生构建脚本 | 忽略，或 `pnpm approve-builds` |
| 安装后白屏 | `dist-lab/index.html` 没换成 hub | 对调入口后重打（第 5 节） |
| 设置/进度不保存 | origin 变了 | 拦截 origin 必须是 `http://127.0.0.1:8765` |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 签名变了 / 版本号没加 | 统一 keystore，或先卸载 |
| 卡面空白、牌组库 0 套 | 素材/数据没抓 | 按第 2 节与 ASSETS.zh.md |
| `缺少依赖: …android.jar` | Android SDK 路径不对 | 设 `ANDROID_SDK` |
| `缺少依赖: …/d8` | build-tools 路径不对 | 设 `BUILD_TOOLS` |
| pnpm 安装卡住/失败（容器） | hardlink 受限 | `--config.package-import-method=copy` |
| 构建 OOM | Node 默认堆不够 | `NODE_OPTIONS=--max-old-space-size=4096` |
| Windows 下脚本报错 | 换行/路径 | 用 WSL，或 `git config core.autocrlf false` |

## 7. 最小验收清单

- [ ] `pnpm --filter @gi-tcg/standalone build` 成功，`dist/index.html` 与 `dist/hub.html` 都存在
- [ ] 本地 `8899/hub.html` 能打开，进模拟器能开局
- [ ] APK `aapt dump badging` 的包名/版本号正确
- [ ] APK 内 `assets/web/index.html` 标题是「七圣召唤工具」、`app.html` 是「七圣召唤模拟器」
- [ ] `search.worker-*.js` 里能搜到 `realisticHidden`（隐藏信息修复已包含）
- [ ] 装到手机能打一局到结算、退出重进存档还在

## 8. 牌组构筑规则（组牌器为什么说"不合规"）

牌组规则由引擎与组牌器共同校验，**改卡池或版本后旧牌组码可能失效**：

1. **3 个角色**，不能重复；
2. **30 张行动牌**；
3. **同名牌最多 2 张**；
4. **秘传 / 祝佑**（`GCG_TAG_LEGEND`、`GCG_TAG_CARD_BLESSING`）整副**最多 1 张**；
5. 带 `relatedCharacterId` 的牌（天赋）要求队伍里有该角色；
6. 带 `relatedCharacterTag` 的牌（元素共鸣）要求队里至少有 **2 个**该标签角色；
7. **环境 = 卡牌数据版本**：当前 data 版本见 `packages/data`（v6.x）。用新版本数据打开旧牌组码，
   可能因卡池变化出现"卡不存在/费用变化"的提示，这不是 bug，是版本差异。

用法：

- 组牌器里组好 → 点「合法性检查」，不合规会写清是哪一条；
- 「生成牌组码」可分享/导入；「导出牌组图」方便发群；
- 想快速验证一套别人的牌组：牌组库搜索 → 详情 → 复制牌组码 → 组牌器导入 → 合法性检查。

## 9. 产物与目录对照

| 位置 | 内容 |
|---|---|
| `packages/standalone/dist/` | Web 产物（240MB，含素材与牌组库） |
| `android/dist-lab/` | 安卓壳要打包的 Web 目录（对调过入口） |
| `android/build/gitcg.apk` | 最终签名安装包（约 150MB） |
| `android/gitcg.jks` | 签名密钥（**必须自己备份**） |
| `packages/standalone/public/` | 素材与数据的源目录（不入 git） |


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [DATA.zh.md](DATA.zh.md)
- [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
