# 云服务器数据备份（2026-11）

> 释放云服务器前，把唯一不可再生的数据拉了回来。
> 完整样本体积超过 GitHub 单文件限制，放在 Release 资产里；Git 仓库只存日志与本说明。

## 一、完整 DMC 样本

| 项 | 值 |
|---|---|
| 文件 | `dmc-full-samples.tar.gz` |
| 大小 | 152.9 MB（159,207,881 字节） |
| 内容 | 197 个条目，其中 72 个 `*.jsonl.gz` |
| SHA-256 | `c29b7625bab3e07da18bde442f801978ae7b01e26420ce2496c013b5bc3bc0b2` |
| 公开备份 | [Release dmc-2026-11](https://github.com/znbb2223/gitcg-tool/releases/tag/dmc-2026-11) |
| 本地备份 | `/sdcard/Download/DSH-Go/服务器备份/dmc-full-samples.tar.gz` |

恢复：

```bash
# 校验
sha256sum dmc-full-samples.tar.gz
# 期望：c29b7625bab3e07da18bde442f801978ae7b01e26420ce2496c013b5bc3bc0b2
# 解包
mkdir -p dmc && tar -xzf dmc-full-samples.tar.gz -C dmc
# 统计
find dmc -name "*.jsonl.gz" | wc -l
```

> 仓库里 `artifacts/ai/dmc/samples/` 只有 r0~r4 各 1 个分片（约 11MB），
> 完整 5.89M 样本以这个压缩包为准。

## 二、实验日志

已归档到 `artifacts/ai/dmc/server-logs/`：

| 文件 | 内容 |
|---|---|
| `bench-1-*.log` / `bench-16-*.log` | 单线程 / 16 线程基准 |
| `rab-*.log` | RAB 相关实验记录 |
| `post-checks.out` | DMC 自对弈 sanity 复核（224 局） |
| `bench.sh` | 基准脚本 |

## 三、没有备份的东西

- `/tmp/intro-v*.mp4`、`/tmp/seg*`：最终 v13 已在本机，中间版本可再生；
- `/tmp/*.m4a`：版权音乐，视频已成品；
- `render_intro_*.py`、`launch*.sh`：`artifacts/` 已有最新脚本；
- 模型权重：仓库 `artifacts/ai/dmc/q0~q4.json` 已有，服务器无额外权重。

## 相关文档

- [MAINTENANCE.zh.md](MAINTENANCE.zh.md) · [BUILD.zh.md](BUILD.zh.md) · [文档中心](README.md) · [项目首页](../README.md)
