# 安卓壳

把 `packages/standalone` 的 Web 产物装进 WebView，做成可离线安装的 APK。

## 关键点

- **零权限**：`AndroidManifest.xml` 里没有 `<uses-permission>`；
- **资源拦截**：`MainActivity.WebViewClient.shouldInterceptRequest` 把
  `http://127.0.0.1:8765/*` 映射到 `assets/*`，不需要真正的网络栈；
- **origin 固定** `http://127.0.0.1:8765`，让 localStorage 有稳定域；
- `minSdk 29`（安卓 10+），`targetSdk 34`；
- `usesCleartextTraffic="true"` 必须保留，否则拦截的 http origin 会被系统拦。

## 打包

```bash
# 先构建 Web（见 ../docs/BUILD.zh.md）
rm -rf dist-lab.new && cp -r ../packages/standalone/dist dist-lab.new
mv dist-lab.new/index.html dist-lab.new/app.html
mv dist-lab.new/hub.html   dist-lab.new/index.html
rm -rf dist-lab && mv dist-lab.new dist-lab
./build.sh
```

产物：`build/gitcg.apk`

## 文件

| 文件 | 作用 |
|---|---|
| `src/MainActivity.java` | WebView 初始化、资源拦截、返回键处理 |
| `src/SettingsActivity.java` | 设置页（布局模式、方向、导入 AI 数据） |
| `src/AndroidManifest.xml` | 版本号、屏幕方向、零权限声明 |
| `build.sh` | aapt + d8 + zipalign + apksigner 一键打包 |
| `dev-docs/` | 构建、数据更新、交接文档 |

## 版本号

改版本要**同时**改两处，否则安装不覆盖或关于页显示旧号：

1. `../packages/standalone/hub.html` 的 `<b id="buildNo">`
2. `src/AndroidManifest.xml` 的 `versionCode` / `versionName`
