<div align="center">

# 安卓壳（APK 打包）

**WebView + 资源拦截 + 零权限**

[首页](../README.md) · [构建文档](../docs/BUILD.zh.md) · [文档中心](../docs/README.md) · [项目总总结](../artifacts/项目总总结-2026-11-28.md)

</div>

把 `packages/standalone` 的 Web 产物装进 WebView，做成可离线安装的 APK。

## 关键点

- **零权限**：`AndroidManifest.xml` 里没有 `<uses-permission>`；
- **资源拦截**：`MainActivity.WebViewClient.shouldInterceptRequest` 把
  `http://127.0.0.1:8765/*` 映射到 `assets/*`，不需要真正的网络栈；
- **origin 固定** `http://127.0.0.1:8765`，让 localStorage 有稳定域；
- `minSdk 29`（安卓 10+），`targetSdk 34`；
- `usesCleartextTraffic="true"` 必须保留，否则拦截的 http origin 会被系统拦。

## APK 内置开发资料（assets/dev-docs/）

打包时会把 `android/dev-docs/` 下的 `.md` / `.txt` 全部拷进 APK 的 **`assets/dev-docs/`**。
把 APK 后缀改成 `.zip` 解包，就能在 `assets/dev-docs/` 里看到：

- `README.md`：当前状态、已知 BUG、牌组码工具、免责声明与致谢；
- `MAINTENANCE.md`：7.2.0 → 7.3.0 数据合并（两条路线）；
- `KNOWN-ISSUES.md`：已知问题与规避方式；
- `build.md`、`guide.md`、`handoff.md`、`decklib-update.md` 等历史资料。

> 这些资料随 APK 一起分发，方便其他开发者或 AI 接手；
> 修改后重新跑 `android/build.sh` 才会进入新的 APK。

## 从零构建 APK

### 0. 工具链

```bash
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk aapt zipalign apksigner zip
# Android SDK：只需要 platforms/android-23/android.jar
# build-tools：拿 d8（示例路径 /opt/android/bt/android-14/d8）
```

- Node 20+、pnpm 10+；本机在 Node 24 + pnpm 10 上验证。
- 所有路径都能用环境变量覆盖：`ANDROID_SDK`、`ANDROID_PLATFORM`（默认 23）、
  `BUILD_TOOLS`、`WEB`、`OUT`、`KEYSTORE`、`KS_PASS`。换机器不用改脚本。

### 1. 素材与依赖（仓库不含美术素材）

游戏美术与社区牌组数据不入库（版权 + 体积），按 `docs/ASSETS.zh.md` 抓取，产物落在
`packages/standalone/public/assets-local/`。

```bash
pnpm install --config.package-import-method=copy
```

### 2. 构建 Web（顺序不能错）

```bash
pnpm --filter @gi-tcg/assets-manager build
pnpm --filter @gi-tcg/web-ui-core build
pnpm --filter @gi-tcg/deck-builder build
pnpm --filter @gi-tcg/standalone build     # 产物：packages/standalone/dist
```

顺序错了会报 `Cannot find module '@gi-tcg/web-ui-core'` 或类型文件缺失。

### 3. 整理入口（关键：必须对调）

Vite 产出的 `index.html` 是**模拟器**，而安卓壳的入口要**首页**，所以对调：

```bash
cd packages/standalone/dist
mv index.html app.html     # 模拟器 → app.html（editor.html 的 iframe、首页跳转都指向它）
mv hub.html   index.html   # 首页 → index.html（壳加载的就是它）
```

### 4. 打 APK

```bash
cd android
rm -rf dist-lab && cp -r ../packages/standalone/dist dist-lab
./build.sh                 # 产物：build/gitcg.apk
```

`build.sh` 的六步：拷贝 Web 产物 → `aapt package` 资源 → `javac` → `d8` 编译 dex →
zip + `zipalign` → `apksigner sign`。

### 5. 校验（建议每次都跑）

```bash
cd android/build
aapt dump badging gitcg.apk | head -3          # 包名 / versionCode / versionName
unzip -l gitcg.apk | grep -E "assets/web/(index|app)\.html"
apksigner verify --print-certs gitcg.apk | head -2

# AI 搜索配置自检：worker 里应能看到真实隐藏信息开关
W=$(unzip -l gitcg.apk | grep -o "assets/web/assets/search.worker-[^\"]*\.js" | head -1)
unzip -p gitcg.apk "$W" | grep -c realisticHidden    # 期望 1
```

AI 的搜索预算与组件开关在 `packages/standalone/src/ai-flags.ts`（默认 `search.budgetMs = 2500`
+ 跳过推演预览 + 真实隐藏信息）。

### 6. 签名与覆盖安装

- 首次构建会在 `android/gitcg.jks` 自动生成 keystore（密码 `gitcgapk`，可用 `KS_PASS` 覆盖）。
  **务必备份**：keystore 丢了或换了，签名就变了，只能卸载重装，本地存档也会一起没。
- 升级安装：`versionCode` 必须比旧版**大**，否则系统拒绝覆盖（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`）。
- 本仓库不附带签名后的 APK，发布产物请自行构建。

### 7. 版本号（两处必须同时改）

1. `packages/standalone/hub.html` → `<b id="buildNo">0.11.xxx</b>`
2. `src/AndroidManifest.xml` → `android:versionCode` / `android:versionName`

只改一处的后果：关于页显示旧版本 / 安装不覆盖。

## 本地调试

Web 侧直接起静态服务更省事，见 `../docs/BUILD.zh.md` 第 3 节（首页 `hub.html`、模拟器 `app.html`、
`?debugLayout=1`、`?debugSearch=1` 等）。

## 常见失败

| 现象 | 原因 | 处理 |
|---|---|---|
| `缺少依赖: …`（build.sh 第一行就退出） | Web 产物或 Android SDK 路径不对 | 用 `WEB` / `ANDROID_SDK` / `BUILD_TOOLS` 指到实际路径 |
| 页面白屏（安卓） | `dist-lab/index.html` 没换成首页 | 按第 3 节对调后再打 |
| 设置/进度不保存 | origin 变了 | 确认拦截 origin 是 `http://127.0.0.1:8765` |
| 安装报 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 签名变了或版本号没加 | 统一 keystore，或卸载重装 |
| `Cannot find module '@gi-tcg/…'` | 依赖包没先构建 | 按第 2 节顺序 |
| 本机图片/音频 404 | 素材没抓全 | 重新跑 `docs/ASSETS.zh.md` 的脚本 |

## 文件

| 文件 | 作用 |
|---|---|
| `src/MainActivity.java` | WebView 初始化、资源拦截、返回键处理 |
| `src/SettingsActivity.java` | 设置页（布局模式、方向、导入 AI 数据） |
| `src/AndroidManifest.xml` | 版本号、屏幕方向、零权限声明 |
| `build.sh` | aapt + d8 + zipalign + apksigner 一键打包（路径可用环境变量覆盖） |
| `dev-docs/` | 构建、数据更新、交接文档；打包进 APK 的 `assets/dev-docs/` |


---

## 相关文档

- [构建文档](../docs/BUILD.zh.md) · [架构](../docs/ARCHITECTURE.zh.md) · [数据格式](../docs/DATA.zh.md)
- [用户指南](../docs/USER-GUIDE.zh.md) · [文档中心](../docs/README.md) · [项目总总结](../artifacts/项目总总结-2026-11-28.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
