# 牌组码工具（七圣召唤）

自由编辑牌组码：33 个槽位（3 角色 + 30 行动牌）可任意填，名字或数字 ID 都行；
内置完整对照表（110 角色 / 527 行动牌）。三个版本，功能一致：

| 文件 | 平台 | 依赖 |
|---|---|---|
| `deckcode.sh` | Linux / macOS / 任意 bash | **只用 bash 内建**，不装任何东西 |
| `deckcode.bat` | Windows（能跑 bat 的机器） | **只用 Windows 自带**：cmd + certutil + cscript |
| `deckcode.html` | 浏览器（手机/电脑） | 无，双击即用 |

## 用法

```bash
./deckcode.sh list 甘雨                 # 查对照表（名字或 ID）
./deckcode.sh decode <牌组码>           # 解码，逐槽显示名字
./deckcode.sh set <牌组码> 4 猫爪冰摇    # 改任意一个槽位（自由编辑）
./deckcode.sh encode 甘雨 迪奥娜 凯亚 唯此一心 猫爪冰摇 ...   # 33 个：3 角色 + 30 牌
./deckcode.sh fill 甘雨 迪奥娜 凯亚 唯此一心 猫爪冰摇 ...     # 自由填 30 张
./deckcode.sh same-card 最好的伙伴！ 甘雨 迪奥娜 凯亚         # 30 张同卡（快捷）
./deckcode.sh same-char 甘雨 最好的伙伴！                    # 3 个同角色（快捷）
./deckcode.sh batch 列表.txt                                 # 每行一组
```

Windows：把 `./deckcode.sh` 换成 `deckcode.bat`，参数完全一样。

浏览器：直接打开 `deckcode.html`：33 个槽位直接输入名字/ID，或粘贴 33 个（或 30 张牌）
一键填充；粘贴牌组码可解码回槽位；下方对照表点一下即可填进当前槽位。

## 说明

- 编码会自动挑选校验字节避开敏感词黑名单（与游戏内一致）；
- 牌组码对顺序敏感：角色/行动牌顺序不同，编码结果不同（内容相同）；
- “30 张同卡 / 3 个同角色”属非常手段，正式对局可能被规则或服务端拒绝，仅用于测试与娱乐；
- 未知卡牌 ID、重名（匹配到多个）都会报错并给出候选。

来源：项目起源「雨酱牌」；主要编程与代码工作由 DeepSeek Harness 完成。
