# 构建打包速查（七圣召唤工具）

## 目录
- 源码 monorepo：/root/workspace/gi-tcg（上游 piovium/genius-invokation，AGPL-3.0）
- 安卓壳：/root/workspace/gitcg-lab（WebView + 内置资源，无联网）

## 构建顺序（改了哪个包就重建哪个，顺序不能乱）
```
cd /root/workspace/gi-tcg
pnpm --filter @gi-tcg/assets-manager build   # 资源管理
pnpm --filter @gi-tcg/web-ui-core build      # 棋盘 UI
pnpm --filter @gi-tcg/deck-builder build     # 组牌器组件
pnpm --filter @gi-tcg/standalone build       # 独立网页（最后）
cp packages/standalone/dist/index.html packages/standalone/dist/app.html
cp packages/standalone/public/{editor,about}.html packages/standalone/dist/
cp packages/standalone/public/responsive.css packages/standalone/dist/
```

## 打 APK
```
cd /root/workspace/gitcg-lab
rm -rf dist-lab && cp -r /root/workspace/gi-tcg/packages/standalone/dist dist-lab
mv dist-lab/index.html dist-lab/app.html
mv dist-lab/hub.html dist-lab/index.html
./build.sh
```
- 环境：Node 24、pnpm（--config.package-import-method=copy）、PUPPETEER_SKIP_DOWNLOAD=1
- 安卓工具链：/usr/lib/android-sdk（android-23.jar）+ /opt/android/bt/android-14/d8 + aapt/zipalign/apksigner
- 版本号三处：hub.html 的 buildNo、AndroidManifest.xml 的 versionCode/versionName、关于页的构建号

## 关键坑
1. WebView 必须 clearCache(true) + 资源响应 Cache-Control: no-store，否则旧 HTML 引用旧 JS 白屏
2. localStorage 按 origin 存（http://127.0.0.1:8765），改 origin 会丢用户数据
3. 卡牌资源在 assets/web/assets-local/，datum 缺失=说明空白，cardFace 缺失=历史空白
4. 布局：20:9 专用回滚 0.11.121 坐标（__GI_CLASSIC_20X9__）；其他比例锚点偏移
5. 方向：工具页跟随「主体方向」设置，模拟器 app.html 永远横屏
6. 构建时 web-ui-core 改了必须重建 standalone 才会带上

## 验收清单
- 首页可开局、横屏、全屏、返回首页
- 卡牌 ~229px、上下两排不重叠、手牌可覆盖
- 历史记录/卡牌说明无空白图
- 摆盘器开局、日志回放与配置页开局布局一致
- 实验室搜索结果点进去是牌组库原条目
- aapt dump badging 版本号正确、apksigner verify 通过
