#!/usr/bin/env python3
"""训练局面价值网络（numpy 实现的 MLP，无需 PyTorch）。

输入：collect-trajectories.mjs 产出的 JSONL（每行 {"w":0/1,"f":[22 维]}）
输出：server-nn.json —— 可直接被 packages/ai/src/value.ts 的 nnValue 加载

用法:
    python3 train_value.py --data /data/traj/*.jsonl --out server-nn.json --epochs 30
"""

import argparse
import glob
import json
import sys

import numpy as np


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", nargs="+", required=True, help="JSONL 文件或通配符")
    parser.add_argument("--out", default="server-nn.json")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--hidden", default="64,32", help="隐藏层宽度，逗号分隔")
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--batch", type=int, default=512)
    parser.add_argument("--val-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=20260101)
    return parser.parse_args()


def load_samples(patterns):
    paths = []
    for pattern in patterns:
        paths.extend(glob.glob(pattern))
    if not paths:
        raise SystemExit(f"没有匹配到数据文件: {patterns}")
    features, labels = [], []
    for path in sorted(set(paths)):
        with open(path, encoding="utf-8") as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                features.append(row["f"])
                labels.append(float(row["w"]))
    if not features:
        raise SystemExit("数据为空")
    return np.asarray(features, dtype=np.float32), np.asarray(labels, dtype=np.float32)


def init_layer(rng, fan_in, fan_out):
    # He 初始化
    return (rng.standard_normal((fan_in, fan_out)) * np.sqrt(2.0 / fan_in)).astype(np.float32)


def forward(layers, x):
    """返回每层激活值（含输入），最后一层 tanh 输出 [-1,1]"""
    activations = [x]
    current = x
    for weights, bias, kind in layers:
        current = current @ weights + bias
        if kind == "relu":
            current = np.maximum(current, 0)
        elif kind == "tanh":
            current = np.tanh(current)
        activations.append(current)
    return activations


def backward(layers, activations, grad_out):
    grads = []
    delta = grad_out
    for index in range(len(layers) - 1, -1, -1):
        weights, _, kind = layers[index]
        if index == len(layers) - 1:
            activation_input = activations[index + 1]
            if kind == "tanh":
                delta = delta * (1 - activation_input**2)
        else:
            activation_output = activations[index + 1]
            if kind == "relu":
                delta = delta * (activation_output > 0)
        prev = activations[index]
        grad_w = prev.T @ delta
        grad_b = delta.sum(axis=0)
        grads.append((grad_w, grad_b))
        if index > 0:
            delta = delta @ weights.T
    return list(reversed(grads))


def main():
    args = parse_args()
    rng = np.random.default_rng(args.seed)
    features, labels = load_samples(args.data)
    print(f"样本 {len(features)} 条，特征 {features.shape[1]} 维，正样本率 {labels.mean():.2%}")

    mean = features.mean(axis=0)
    std = features.std(axis=0)
    std[std < 1e-6] = 1.0
    normalized = (features - mean) / std
    targets = labels * 2 - 1  # 0/1 → -1/+1，配合 tanh 输出

    order = rng.permutation(len(normalized))
    split = int(len(order) * (1 - args.val_ratio))
    train_idx, val_idx = order[:split], order[split:]

    widths = [normalized.shape[1]] + [int(width) for width in args.hidden.split(",")] + [1]
    layers = []
    for index in range(len(widths) - 1):
        kind = "tanh" if index == len(widths) - 2 else "relu"
        layers.append([init_layer(rng, widths[index], widths[index + 1]),
                       np.zeros(widths[index + 1], dtype=np.float32), kind])

    # Adam
    moments = [[np.zeros_like(w), np.zeros_like(w), np.zeros_like(b), np.zeros_like(b)] for w, b, _ in layers]
    beta1, beta2, eps = 0.9, 0.999, 1e-8
    step = 0

    for epoch in range(args.epochs):
        permutation = rng.permutation(train_idx)
        total_loss = 0.0
        for offset in range(0, len(permutation), args.batch):
            batch_idx = permutation[offset : offset + args.batch]
            x = normalized[batch_idx]
            y = targets[batch_idx]
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

        val_input = normalized[val_idx]
        val_output = forward(layers, val_input)[-1][:, 0]
        val_target = targets[val_idx]
        accuracy = float(np.mean((val_output > 0) == (val_target > 0)))
        mse = float(np.mean((val_output - val_target) ** 2))
        print(
            f"epoch {epoch + 1:02d}/{args.epochs}  train_mse {total_loss / len(permutation):.4f}  "
            f"val_mse {mse:.4f}  val_acc {accuracy:.2%}",
            flush=True,
        )

    export = {
        "kind": "gi-tcg-value-nn",
        "version": 1,
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
    size = len(json.dumps(export))
    print(f"已导出 {args.out}（约 {size / 1024:.0f} KB）")


if __name__ == "__main__":
    sys.exit(main())
