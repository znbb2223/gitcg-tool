#!/usr/bin/env python3
"""训练 DMC（Deep Monte Carlo）动作打分网络。

与策略网的区别：标签不是「老师选了哪一手」，而是「这局最终胜负」（+1 / 0 / -1），
回归到 Q(s, a)。网络结构与 `train_policy.py` 完全一致，导出的 JSON 可以直接被
`packages/ai/src/policy.ts` 的 `policyScores`（以及 `dmc.ts`）加载。

输入：`dmc-selfplay.mjs` 产出的 JSONL（每行 {"x":[44],"c":{...},"r":±1}）
用法:
    python3 train_dmc.py --data '/data/gitcg/dmc/*.jsonl.gz' --out dmc-nn.json --epochs 5
"""

import argparse
import glob
import gzip
import json
import os

# 小批量 MLP 用多线程 BLAS 反而更慢，必须在 import numpy 之前设置
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np

from train_policy import ACTION_KINDS, encode_action
from train_value import backward, forward, init_layer


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", nargs="+", required=True, help="JSONL 文件或通配符")
    parser.add_argument("--out", default="dmc-nn.json")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--hidden", default="64,32")
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--batch", type=int, default=1024)
    parser.add_argument("--val-ratio", type=float, default=0.05)
    parser.add_argument("--seed", type=int, default=20261128)
    parser.add_argument(
        "--no-score",
        action="store_true",
        help="不把启发式打分 sc 作为输入（推理时不必先跑一遍启发式）",
    )
    return parser.parse_args()


def open_text(path):
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8")
    return open(path, encoding="utf-8")


def load_samples(patterns, with_score):
    """两遍扫描 + 预分配 float32，避免千万级样本时 Python 列表撑爆内存。"""
    paths = []
    for pattern in patterns:
        paths.extend(glob.glob(pattern))
    if not paths:
        raise SystemExit(f"没有匹配到数据文件: {patterns}")
    paths = sorted(set(paths))

    # 第一遍：数行数、拿维度
    total = 0
    state_dim = action_dim = None
    for path in paths:
        with open_text(path) as file:
            for line in file:
                if not line.strip():
                    continue
                row = json.loads(line)
                if not row.get("x") or not row.get("c"):
                    continue
                if state_dim is None:
                    state_dim = len(row["x"])
                    action_dim = len(encode_action(row["c"], with_score))
                total += 1
    if total == 0:
        raise SystemExit("数据为空")

    width = state_dim + action_dim
    features = np.zeros((total, width), dtype=np.float32)
    labels = np.zeros(total, dtype=np.float32)
    index = 0
    for path in paths:
        with open_text(path) as file:
            for line in file:
                if not line.strip():
                    continue
                row = json.loads(line)
                if not row.get("x") or not row.get("c"):
                    continue
                features[index, :state_dim] = row["x"]
                features[index, state_dim:] = encode_action(row["c"], with_score)
                labels[index] = float(row["r"])
                index += 1
    return features[:, :state_dim], features[:, state_dim:], labels


def main():
    args = parse_args()
    with_score = not args.no_score
    rng = np.random.default_rng(args.seed)
    states, actions, labels = load_samples(args.data, with_score)
    features = np.concatenate([states, actions], axis=1)
    print(
        f"样本 {len(features)} 条，状态 {states.shape[1]} 维 + 动作 {actions.shape[1]} 维，"
        f"正样本率 {np.mean(labels > 0):.1%}，平局 {np.mean(labels == 0):.1%}"
    )

    mean = features.mean(axis=0)
    std = features.std(axis=0)
    std[std < 1e-6] = 1.0
    # 原地归一化，千万级样本时省下数 GB 内存
    features -= mean
    features /= std
    normalized = features

    order = rng.permutation(len(normalized))
    split = max(1, int(len(order) * (1 - args.val_ratio)))
    train_idx, val_idx = order[:split], order[split:]

    widths = [normalized.shape[1]] + [int(w) for w in args.hidden.split(",")] + [1]
    layers = []
    for index in range(len(widths) - 1):
        kind = "tanh" if index == len(widths) - 2 else "relu"
        layers.append(
            [
                init_layer(rng, widths[index], widths[index + 1]),
                np.zeros(widths[index + 1], dtype=np.float32),
                kind,
            ]
        )

    moments = [
        [np.zeros_like(w), np.zeros_like(w), np.zeros_like(b), np.zeros_like(b)]
        for w, b, _ in layers
    ]
    beta1, beta2, eps = 0.9, 0.999, 1e-8
    step = 0

    for epoch in range(args.epochs):
        permutation = rng.permutation(train_idx)
        total_loss = 0.0
        for offset in range(0, len(permutation), args.batch):
            batch_idx = permutation[offset : offset + args.batch]
            x = normalized[batch_idx]
            y = labels[batch_idx]
            activations = forward(layers, x)
            output = activations[-1][:, 0]
            error = output - y
            total_loss += float(np.mean(error**2)) * len(batch_idx)
            grad_output = (2 * error / len(batch_idx)).reshape(-1, 1)
            grads = backward(layers, activations, grad_output)
            step += 1
            for index, (grad_w, grad_b) in enumerate(grads):
                m_w, v_w, m_b, v_b = moments[index]
                m_w = beta1 * m_w + (1 - beta1) * grad_w
                v_w = beta2 * v_w + (1 - beta2) * grad_w**2
                m_b = beta1 * m_b + (1 - beta1) * grad_b
                v_b = beta2 * v_b + (1 - beta2) * grad_b**2
                moments[index] = [m_w, v_w, m_b, v_b]
                bias_fix1 = 1 - beta1**step
                bias_fix2 = 1 - beta2**step
                layers[index][0] -= args.lr * (m_w / bias_fix1) / (np.sqrt(v_w / bias_fix2) + eps)
                layers[index][1] -= args.lr * (m_b / bias_fix1) / (np.sqrt(v_b / bias_fix2) + eps)

        val_output = forward(layers, normalized[val_idx])[-1][:, 0]
        val_target = labels[val_idx]
        val_mse = float(np.mean((val_output - val_target) ** 2))
        val_sign = float(np.mean(np.sign(val_output) == np.sign(val_target)))
        print(
            f"epoch {epoch + 1:02d}/{args.epochs}  train_mse {total_loss / len(permutation):.4f}  "
            f"val_mse {val_mse:.4f}  val_sign {val_sign:.2%}",
            flush=True,
        )

    export = {
        "kind": "gi-tcg-dmc-nn",
        "version": 1,
        "stateDim": int(states.shape[1]),
        "actionDim": int(actions.shape[1]),
        "usesScore": with_score,
        "actionKinds": list(ACTION_KINDS),
        "mean": [round(float(value), 6) for value in mean],
        "std": [round(float(value), 6) for value in std],
        "layers": [
            {
                "w": [
                    [round(float(weight), 6) for weight in row] + [round(float(bias), 6)]
                    for row, bias in zip(weights.T.tolist(), bias.tolist())
                ],
                "act": kind,
            }
            for weights, bias, kind in layers
        ],
    }
    with open(args.out, "w", encoding="utf-8") as file:
        json.dump(export, file, ensure_ascii=False)
    print(f"已导出 {args.out}（约 {len(json.dumps(export)) / 1024:.0f} KB）")


if __name__ == "__main__":
    raise SystemExit(main())
