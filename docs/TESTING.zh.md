# 验证方法

手机上没有可视化调试器，改 UI 必须用「可测量的证据」验收，不靠感觉。

## 1. 基本原则

1. **改动必须出证据**：截图、DOM 尺寸、像素采样，三者至少一种；
2. **回归要覆盖三种形态**：横屏 20:9、横屏其他比例、竖屏；
3. **能自动化的别手点**：Playwright 脚本可以重复跑几十次。

## 2. 本地起服务

```bash
cd packages/standalone/dist
python3 -m http.server 8899 &
```

> 这个服务偶尔会自己挂掉（端口占用/进程被杀），报错「拒绝连接」时先重启它。

## 3. 截图验收

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 792, "height": 445}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto("http://127.0.0.1:8899/hub.html")
    page.wait_for_timeout(2500)
    page.screenshot(path="shot.png")
```

- 视口用**真实比例**（20:9 用 1920×864，16:9 用 792×445）；
- 截图前等 2~3 秒让资源和字体加载完；
- 多张图拼成 contact sheet 一次看完。

## 4. DOM 尺寸验收（布局改动必做）

```python
page.evaluate("""() => {
  const el = document.querySelector('.hand-area');
  const r = el.getBoundingClientRect();
  return {top: r.top, bottom: r.bottom, w: r.width, h: r.height};
}""")
```

我们验收锚点布局时用的标准：

| 指标 | 目标 | 实测方法 |
|---|---|---|
| 牌堆右缘到界面左边 | 102.9px | `getBoundingClientRect().left` |
| 己方手牌到底边 | 37.2px | `window.innerHeight - rect.bottom` |
| 敌方手牌到顶边 | 44.8px | `rect.top` |
| 上下牌堆镜像误差 | ≤0.5px | 两者对称距离之差 |
| 角色行间距 | 48 单位 | 两个角色卡中心距离 / unitPx |

## 5. 像素采样（判断是否白屏 / 渲染对错）

```python
from PIL import Image
im = Image.open("shot.png").convert("RGB")
px = list(im.resize((8, 4)).getdata())
avg = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
# 全黑 (0,0,0) 或全白 (255,255,255) 基本就是白屏
```

## 6. 自动走一局（AI vs AI）

对局类改动用机机观战跑到行动阶段再验：

```python
page.evaluate("""() => {
  const sel = [...document.querySelectorAll('select')]
    .find(s => [...s.options].some(o => o.value === 'aiai'));
  if (sel) { sel.value = 'aiai'; sel.dispatchEvent(new Event('change', {bubbles: true})); }
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('开始'));
  btn && btn.click();
}""")
# 轮询 window.theGame.state.roundNumber 直到进入行动阶段
```

## 7. 真机验收清单

- [ ] 三种布局模式切换正常（20:9 只走经典）
- [ ] 横竖屏切换不闪黑、不跳变
- [ ] 牌组库筛选/排序/深链接正确
- [ ] 实验室开跑、进度、结果落库
- [ ] 组牌器合法性提示与置灰
- [ ] 摆盘器摆盘→开局→返回→再编辑
- [ ] 清除数据后重新初始化正常

## 8. 宣传片渲染

见 `promo/README.md`：Motion Canvas + Playwright 逐帧截图 + ffmpeg。
验证成片：抽 8 帧拼图看一眼，再 `ffprobe` 确认时长/分辨率/音轨。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md)
- [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md) · [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
