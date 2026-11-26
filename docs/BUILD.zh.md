# 构建与打包

## 0. 环境

| 工具 | 版本/说明 |
|---|---|
| Node | 20+（本项目在 Node 24 上验证） |
| pnpm | 10+，`engine-strict=false` |
| Python 3 | 起本地静态服务/截图验证用 |
| Android SDK | 只需 `platforms/android-23/android.jar` |
| d8 / aapt / zipalign / apksigner | 安卓打包链路 |

`pnpm install` 务必带 `--config.package-import-method=copy`（pnpm 默认的 hardlink
在某些容器/手机上会失败）。

## 1. 网页构建（必须先按顺序）

```bash
cd gi-tcg

# 1) 资源清单（改过卡牌数据才需要）
pnpm --filter @gi-tcg/assets-manager build

# 2) 对局界面组件
pnpm --filter @gi-tcg/web-ui-core build

# 3) 组牌器组件
pnpm --filter @gi-tcg/deck-builder build

# 4) 独立应用（最后）
pnpm --filter @gi-tcg/standalone build
```

> 顺序错了会出现 `Cannot find module '@gi-tcg/web-ui-core'` 或类型文件缺失。

### 产物整理（关键：改名）

Vite 出来的 `index.html` 是**模拟器**，而安卓壳的入口要**首页**，所以要对调：

```bash
cd packages/standalone/dist
cp index.html app.html
cp ../public/editor.html .
cp ../public/about.html .
cp ../public/responsive.css .
```

## 2. 安卓 APK

```bash
cd android

# 1) 拷贝 Web 产物（目录名必须是 dist-lab）
rm -rf dist-lab.new
cp -r ../gi-tcg/packages/standalone/dist dist-lab.new

# 2) 对调入口
mv dist-lab.new/index.html dist-lab.new/app.html
mv dist-lab.new/hub.html   dist-lab.new/index.html

rm -rf dist-lab && mv dist-lab.new dist-lab

# 3) 打包
./build.sh
# 产物 build/gitcg.apk
```

`build.sh` 做的事：`aapt package` 资源 → `d8` 编译 dex → 打包 zip →
`zipalign` → `apksigner sign`（自带 debug keystore）。

### 版本号（两处必须同时改）

1. `packages/standalone/hub.html` → `<b id="buildNo">0.11.xxx</b>`
2. `android/src/AndroidManifest.xml` → `android:versionCode` / `android:versionName`

只改一处的后果：关于页显示旧版本 / 安装不覆盖。

## 3. 本地测试

```bash
cd packages/standalone/dist && python3 -m http.server 8899 &
```

| 页面 | 地址 | 备注 |
|---|---|---|
| 首页 | `http://127.0.0.1:8899/hub.html` | |
| 模拟器 | `http://127.0.0.1:8899/app.html` | 横屏视口 |
| 摆盘器 | `http://127.0.0.1:8899/state-editor.html` | |
| 牌组库 | `http://127.0.0.1:8899/deck-library.html` | |
| 实验室 | `http://127.0.0.1:8899/lab.html` | |

调试参数：

- `?debugLayout=1` 画舞台框与十字线；
- `?dumpLayout=1` 录制锚点（`dumpAllAnchors()`）；
- `?debugSearch=1` 实验室搜索过程输出。

## 4. 常见构建失败

| 现象 | 原因 | 处理 |
|---|---|---|
| `Cannot find module '@gi-tcg/assets-manager'` | 先构建被依赖包 | 按第 1 节顺序 |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm 拒绝运行原生构建脚本 | 忽略即可，或用 `pnpm approve-builds` |
| `Unexpected token` in `lab.ts` | 手改括号导致语法错 | 用 `node --check` 前先跑一次 vite 构建看行号 |
| 页面白屏（安卓） | `dist-lab/index.html` 没换成 hub | 检查第 2 节第 2 步 |
| 设置/进度不保存 | origin 变了 | 确认拦截 origin 是 `http://127.0.0.1:8765` |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 签名变了 | 卸载旧版再装，或统一 keystore |
