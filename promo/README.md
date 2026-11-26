# 宣传片工程（Motion Canvas）

给 B 站用的 40 秒宣传片。用 [Motion Canvas](https://motioncanvas.io/) 写场景，
Playwright 逐帧截图，ffmpeg 合成，配原神《海祇岛》BGM。

## 结构

```
src/
  palette.ts        颜色与字体常量
  parts.tsx         公共组件：全幅背景、暗幕、章节标题、要点、标签、进度点
  s-intro.tsx       开场（标题 + 金色菱形 + 细线）
  s-sim.tsx         01 模拟器
  s-lib.tsx         02 牌组库
  s-lab.tsx         03 实验室（带穷举进度条）
  s-build.tsx       04 组牌器
  s-board.tsx       05 摆盘器
  s-end.tsx         结尾（slogan + 标签）
project.ts          场景注册与分辨率（1920×1080 @60fps）
render.html/ts      自建渲染页：用 Player + Stage 逐帧驱动
vite.config.ts      Motion Canvas vite 插件
```

## 渲染流程

```bash
pnpm install
npx vite --port 5199          # 起渲染服务

# 1) 逐帧截图（需要 Playwright）
python3 capture.py            # 输出 frames/%05d.png

# 2) 合成 + 配乐
ffmpeg -framerate 60 -i frames/%05d.png \
       -i bgm.wav -c:v libx264 -crf 18 -pix_fmt yuv420p \
       -c:a aac -b:a 192k -shortest out.mp4
```

## 注意

- 场景素材（`public/*-209.png`）是工具界面截图，**含游戏美术**，不入库；
  需要自己截：起本地服务后用 Playwright 按 1920×864 视口截图。
- Motion Canvas 的 Player 在 headless 下 rAF 循环会停，所以 `render.ts`
  直接用 `PlaybackManager` 的 `recalculate()` / `seek()` 驱动，不依赖播放循环。
