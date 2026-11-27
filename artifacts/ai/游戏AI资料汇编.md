# 卡牌/回合制游戏 AI 资料汇编（2026-11-27）

> 按发布时间倒序排列，越新权重越高。每条标注「对我们的可迁移点」。
> 我们的现状：隐藏信息（对手手牌未知）、PIMC 确定性抽样 + 平坦 rollout（无树、无信念）、CPU-only、手机上跑。

## 一、时间线速览

| 年份 | 工作 | 核心方法 | 对我们的意义 |
|---|---|---|---|
| 2017 | [DeepStack](https://arxiv.org/abs/1701.01724) | 深度反事实价值网 + 连续重解 | 首证"网络+搜索"能击败职业选手，但需要千核 |
| 2018 | [AlphaZero](https://www.science.org/doi/10.1126/science.aar6404) | MCTS + 双头网络自对弈 | 完美信息范式；我们是隐藏信息，不能直接套 |
| 2018 | [Libratus](https://www.science.org/doi/10.1126/science.aao1733) | CFR + 子博弈重解 | 无限制德州扑克；算力需求极高 |
| **2020** | **[ReBeL](https://arxiv.org/abs/2007.13544)** | 递归信念搜索 + 价值网 + CFR 求平均策略 | 隐藏信息下"网络+搜索"的正确形态；贵 |
| **2021** | **[DouZero](https://arxiv.org/abs/2106.06135)** | **深度蒙特卡洛（DMC）自对弈，无搜索** | ⭐ 最贴合我们：无需老师、无需树、推理一次前向 |
| 2022 | [DouZero+](https://arxiv.org/abs/2204.02558) | 对手建模 + 教练引导 | 在 DMC 之上加"针对对手"的增益 |
| **2023** | **[Student of Games](https://www.science.org/doi/10.1126/sciadv.adg3256)** | GT-CFR + 搜索 + 学习的统一算法 | 理论上最完整；实现与算力门槛最高 |
| 2024–2025 | 通才游戏智能体（[综述](https://thusi-lab.github.io/Awesome-LFMs-Play-Games/)） | 大模型 + 通用接口 | 与卡牌强度无关，可做解说/对话 |

## 二、四种技术路线对比

| 路线 | 代表 | 隐藏信息处理 | 推理成本 | 数据需求 | 适合我们？ |
|---|---|---|---|---|---|
| CFR 系 | Libratus / Student of Games | 显式信念 + 反事实遗憾 | 高 | 中 | ❌ 算力门槛高 |
| 网络+搜索（PIMC） | DeepStack / ReBeL / DeltaDou | 确定性抽样或信念网 | 中~高 | 中 | ⚠️ 我们已在做，但无树、无信念 |
| **自对弈 DMC** | **DouZero / DouZero+** | 不建模，直接学期望 | **极低（一次前向）** | 高 | ✅ **最匹配** |
| 模仿学习 | 我们的策略网络 | 依赖老师 | 低 | 中 | ❌ 今天已证伪 |

## 三、DouZero 的关键细节（最该借鉴）

来源：[DouZero: Mastering DouDizhu with Self-Play Deep Reinforcement Learning](https://arxiv.org/abs/2106.06135)（ICML 2021）

- **方法**：深度蒙特卡洛（DMC）——用神经网络近似 Q(s,a)，用整局回报做标签，ε-greedy 自对弈，**完全不用搜索，不用任何人类知识**
- **为什么适合大动作空间**：动作编码成卡牌矩阵（4×15 one-hot），网络能泛化到训练中没见过的动作；DQN 会因为 max 运算过估计而发散，策略梯度则无法利用动作特征
- **算力**：单机 48 核 + 4×1080Ti，**半天**超过启发式，**两天**超过监督学习基线，**十天**超过 DeltaDou（那是个训练了两个月的 MCTS+贝叶斯系统）
- **对比**：对启发式规则胜率 0.764，对监督学习 0.659
- **对我们的直接启示**：
  1. 我们的"策略网络 + 模仿"路线方向错了——DouZero 用**整局回报**当标签，不需要老师
  2. 我们的引擎单核 1.25 局/秒，16 核约 **20 局/秒 ≈ 170 万局/天**，数据量不是问题
  3. 我们的动作空间小（每步 5~20 个候选），网络可以做得比 DouZero 小得多，**手机端 0.1ms 推理**完全可行

## 四、ReBeL / Student of Games 的价值（长期方向）

- [ReBeL](https://arxiv.org/abs/2007.13544)：把"价值网络 + 信念"放进子博弈求解，是对隐藏信息的正确处理方式。但需要在**公共树**上做 CFR，实现复杂
- [Student of Games](https://www.science.org/doi/10.1126/sciadv.adg3256)：用 GT-CFR 统一了完美/隐藏信息游戏，是这类问题的"标准答案"。2023 年发表于 Science Advances，可信度高
- **判断**：这两条是"如果有 GPU 和几周时间"才考虑的路线。我们现在连 DMC 基线都没建过，不该跳级

## 五、对我们最有价值的三个结论

1. **不要再喂老师**（模仿学习）。DouZero 证明：用**最终胜负**当标签的自对弈，能超过训练两个月的搜索系统，且不需要任何人类知识。我们今天所有"策略网络失败"的根源就是这个
2. **推理阶段可以不要搜索**。DMC 训练完后，一步前向就出招。这同时解决了我们"3000ms 预算"和"手机发热"两个问题
3. **我们缺的不是评估函数精度，是训练信号的正确性**。今天测出来"每多一倍 rollout ≈ +12 点胜率"，说明搜索有效；但 DouZero 路线的极限更高，因为它学的是**期望回报**而不是**模仿某个老师**

## 六、建议的执行顺序

| 优先级 | 动作 | 成本 | 预期 |
|---|---|---|---|
| 1 | 用现有引擎跑 **DMC 自对弈基线**（ε-greedy + Q 网 + 整局回报），先不接搜索 | 1~2 天，16 核可跑 | 可能直接超过 57.7% 的搜索基线 |
| 2 | 对比 DMC vs 现有"搜索+手工评估" | 半天 | 决定后续主路线 |
| 3 | 若 DMC 有效，加**对手建模**（DouZero+ 思路） | 2~3 天 | 隐藏信息下的针对性提升 |
| 4 | 若还不行，再考虑 ReBeL / Student of Games | 周级 + GPU | 理论最强，但门槛最高 |

## 七、参考链接

- DouZero 论文：https://arxiv.org/abs/2106.06135 ｜ 代码：https://github.com/kwai/DouZero
- DouZero+：https://arxiv.org/abs/2204.02558
- ReBeL：https://arxiv.org/abs/2007.13544
- Student of Games：https://www.science.org/doi/10.1126/sciadv.adg3256
- RLCard 工具包（含 DMC/DQN/NFSP/CFR 实现，可直接读源码）：https://rlcard.org ｜ https://github.com/datamllab/rlcard
- RLCard 论文：https://arxiv.org/abs/1910.04376
- AlphaZero：https://www.science.org/doi/10.1126/science.aar6404
- DeepStack：https://arxiv.org/abs/1701.01724
- 通才游戏智能体综述：https://thusi-lab.github.io/Awesome-LFMs-Play-Games/


---

## 相关文档

- [项目首页](../../README.md) · [文档中心](../../docs/README.md) · [AI 实现详解](../../docs/AI-实现详解.zh.md) · [AI 原理](../../docs/AI.zh.md)
- [实验记录](../../docs/AI-EXPERIMENTS.zh.md) · [构建](../../docs/BUILD.zh.md) · [架构](../../docs/ARCHITECTURE.zh.md) · [项目总总结](../项目总总结-2026-11-28.md)
- [AI 终结报告](AI-终结报告-2026-11-28.md) · [AI 总览](README.md) · [DMC 结果](DMC-结果-2026-11-28.md) · [DMC 设计](DMC设计.md)
