# 牌组码工具（七圣召唤）

打开就是菜单：`deckcode.sh` / `deckcode.bat` 直接运行会出现编号菜单
（1 解码、2 编辑/编码、3 查询名字/ID、4 30 张同卡、5 3 个同角色、6 自由填充、7 批量、0 退出）。

| 文件 | 平台 | 依赖 |
|---|---|---|
| `deckcode.sh` | **任意 sh**：Android /system/bin/sh、Termux、dash、mksh、busybox sh | **零外部命令**（纯 POSIX sh 内建） |
| `deckcode.bat` | 真正的 Windows（能跑 bat） | 仅 Windows 自带：cmd + certutil + cscript |
| `deckcode.html` | 手机/电脑浏览器 | 无 |

> Winlator / Wine 不是真 Windows，没有 certutil.exe / cscript.exe，BAT 无法在那里工作
> （会提示并暂停，不再闪退）；请改用手机浏览器打开 `deckcode.html`，或在 Termux 里跑 `deckcode.sh`。

## 菜单

- **1 解码**：粘牌组码，逐槽显示名字 + ID；
- **2 编辑/编码**：33 槽（3 角色 + 30 行动牌）逐槽自由改，支持查看、设置、填充 30 张、
  30 张同卡、3 个同角色、解码粘贴、输出牌组码、清空；
- **3 查询**：名字或 ID 模糊查表（内置 110 角色 + 527 行动牌）；
- **7 批量**：文本文件每行一组（牌组码或 33 个名字/ID）。

命令行模式也保留：

```sh
./deckcode.sh decode <牌组码>
./deckcode.sh set <牌组码> 4 猫爪冰摇
./deckcode.sh encode 甘雨 迪奥娜 凯亚 ...（共 33 个）
./deckcode.sh fill 甘雨 迪奥娜 凯亚 <30 张牌>
./deckcode.sh same-card 最好的伙伴！ 甘雨 迪奥娜 凯亚
./deckcode.sh list 甘雨
./deckcode.sh batch 列表.txt
```

Windows 换成 `deckcode.bat`，参数一样（需要 certutil/cscript，真 Windows 自带）。

## 说明

- 编码自动挑选校验字节避开敏感词黑名单（与游戏内一致）；
- 牌组码固定 33 槽（3+30），不足/超出无法编码；顺序不同编码不同、内容相同；
- 30 张同卡 / 3 个同角色属非常手段，正式对局可能被拒绝；
- 未知 ID、重名都会报错并给候选。

来源：项目起源「雨酱牌」；主要编程与代码工作由 DeepSeek Harness 完成。
