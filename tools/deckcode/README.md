# 牌组码工具（七圣召唤）

编码 / 解码 / 非常手段牌组码。三个版本，功能一致：

| 文件 | 平台 | 依赖 |
|---|---|---|
| `deckcode.sh` | Linux / macOS / 任何带 bash 的终端 | python3 |
| `deckcode.bat` | Windows 10/11 | 自带 PowerShell（无需安装） |
| `deckcode.html` | 浏览器（手机/电脑） | 无，双击即用 |

## 用法

```bash
./deckcode.sh same-card 332001 1314 1601 1208   # 3 个角色 + 30 张同卡
./deckcode.sh same-char 1314 332001             # 3 个同角色 + 30 张同卡
./deckcode.sh repeat 1314 1601 1208 332001 331001   # 循环补到 30 张
./deckcode.sh encode <33 个 id>                 # 3 角色 + 30 牌
./deckcode.sh decode <牌组码>
./deckcode.sh batch 列表.txt                     # 每行一组
```

Windows：

```bat
deckcode.bat same-card 332001 1314 1601 1208
deckcode.bat decode <牌组码>
```

浏览器：直接打开 `deckcode.html`，输入后点按钮。

## 说明

- 牌组码格式：33 个 12-bit shareId → 25 字节 → 加校验字节、交错混淆 → 51 字节 → Base64；
- 编码会自动挑选校验字节以避开敏感词黑名单（与游戏内行为一致）；
- **牌组码对顺序敏感**：角色/行动牌排序不同，编码结果不同，但解码出的是同一套牌；
- 「30 张同卡 / 3 个同角色」属于非常手段，正式对局可能被规则或服务端拒绝，仅用于测试与娱乐；
- 未知卡牌 id 会报错并列出。

来源：项目起源「雨酱牌」；主要编程与代码工作由 DeepSeek Harness 完成。
