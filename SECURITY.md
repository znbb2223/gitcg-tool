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
| `gitcg.mainOrientation` | 主体横竖屏偏好 |
| `gitcg.layoutMode` | 对局界面布局模式 |
| `gitcg.deckLibrary.*` | 牌组库缓存、收藏、本地训练样本 |
| `gitcg.deckbuilder.legalCheck` | 组牌器合法性检查开关 |
| `gitcg.lab.*` | 实验室参数与结果 |
| `gi-tcg-ai-experience` | 从训练器导入的 AI 经验 |

清除方式：系统设置 → 应用 → 七圣召唤工具 → 存储 → 清除数据。
（会一并清掉设置、收藏与导入的经验。）

## 资源加载

安卓壳用 `WebViewClient.shouldInterceptRequest` 把
`http://127.0.0.1:8765/*` 映射到 APK 内 `assets/*`，
**不开本地服务器、不占用端口、不监听 socket**。

## 报告安全问题

发现越权、数据外泄、注入等问题，请在 GitHub Issue 里**只描述现象**，
不要公开利用细节；维护者会私信你跟进。
