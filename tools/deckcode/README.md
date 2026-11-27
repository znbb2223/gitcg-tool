# 牌组码工具（七圣召唤）

| 文件 | 平台 | 依赖 | 名字表 |
|---|---|---|---|
| `deckcode.sh` | 任意 sh（Android sh / Termux / dash / mksh） | **零外部命令** | 中文名（完整） |
| `deckcode.bat` | **纯 cmd**，Winlator / Wine / 任何 Windows | **只用 cmd 内建** | `\uXXXX` 转义（ASCII 安全） |
| `deckcode-windows.bat` | 真 Windows 10/11 | 自带 certutil + cscript | 中文名（完整） |
| `deckcode.html` | 手机/电脑浏览器 | 无 | 中文名（完整，可编辑 33 槽） |

## 菜单

`deckcode.sh` / `deckcode.bat` / `deckcode-windows.bat` 打开或运行就是菜单：

1) 解码牌组码（逐槽显示 ID）
2) 编码 33 个 ID（3 角色 + 30 行动牌）
3) 30 张同卡
4) 3 个同角色 + 30 张同卡
5) 查 ID ↔ shareId
6) 查名字（`\uXXXX` 转义，如 `\u7518\u96e8` = 甘雨）
0) 退出

纯 cmd 版第一次运行会在同目录生成 `deckcode-map-v2.txt`（ID : shareId : 转义名），之后直接复用。

## 说明

- 牌组码固定 33 槽（3+30），不足/超出无法编码；顺序不同编码不同、内容相同；
- 30 张同卡 / 3 个同角色属非常手段，正式对局可能被拒绝；
- 中文名对照：`deckcode.html` / `deckcode.sh` 里最方便；纯 cmd 版用 `\uXXXX` 形式存储与查找；
- Winlator / Wine 没有 certutil/cscript，请用 `deckcode.bat`（纯 cmd）或 `deckcode.html`。

来源：项目起源「雨酱牌」；主要编程与代码工作由 DeepSeek Harness 完成。
