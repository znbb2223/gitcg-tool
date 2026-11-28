# 隐私与安全

## 一句话

**不联网、不采集、不上传。** APK 里连 `INTERNET` 权限都没有。

## 权限

`AndroidManifest.xml` 中没有任何 `<uses-permission>`。
没有网络权限，应用在系统层面就不可能发起网络请求。

## 数据存在哪

所有数据都在**本机**，浏览器 localStorage（origin 固定 `http://127.0.0.1:8765`）：

| key | 内容 |
|---|---|
| `gitcg.mainOrientation` | 主体横竖屏（`portrait` / `landscape`） |
| `gitcg.gameLayout` | 对局界面布局（`classic` / `stretch` / `anchor`） |
| `gitcg.shareQuality` | 牌组图画质（`compact` / `lossless`） |
| `gi-tcg-user-decks-v1` | 组牌器 / 实验室自建牌组 |
| `gi-tcg-deckbuilder-legal-check-v1` | 组牌器合法性检查开关 |
| `gi-tcg-ai-learning-v1` | AI 经验（胜率 / 偏好 / 局数） |
| `gi-tcg-ai-memory-v1` | AI 决策记忆 |
| `gi-tcg-ai-game-log-v1` | 对局日志 |
| `gi-tcg-ai-settings-v2:sim/lab/train` | 三处 AI 设置 |
| `gi-tcg-lab-state-v1` | 实验室参数与结果 |
| `gitcg.ai.flags` | AI 组件开关 |

完整清单与逐项说明见 [docs/SETTINGS.zh.md](docs/SETTINGS.zh.md) 与 [docs/DATA.zh.md](docs/DATA.zh.md)。

清除方式：系统设置 → 应用 → 七圣召唤工具 → 存储 → 清除数据。
（会一并清掉设置、收藏与导入的经验。）

## 资源加载

安卓壳用 `WebViewClient.shouldInterceptRequest` 把
`http://127.0.0.1:8765/*` 映射到 APK 内 `assets/*`，
**不开本地服务器、不占用端口、不监听 socket**。

## 报告安全问题

发现越权、数据外泄、注入等问题，请在 GitHub Issue 里**只描述现象**，
不要公开利用细节；维护者会私信你跟进。
