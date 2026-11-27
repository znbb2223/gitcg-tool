#!/usr/bin/env python3
"""训练动作策略网络（state-action 打分器）。

和价值网络的区别：价值网络给"局面"打一个分，策略网络给"局面 + 某个候选动作"
打一个分，再对同一局面的所有候选用 softmax 归一化，标签是 AI 实际选中的那个。

输入：collect-trajectories.mjs v4 产出（每行带 c 候选动作、ai 选中位置）
输出：policy-nn.json —— 供推理端加载

用法:
    python3 train_policy.py --data /data/gitcg/traj-v4/*.jsonl.gz --out policy-nn.json
"""

import argparse
import glob
import gzip
import json
import os
import sys

# 小批量 MLP 用多线程 BLAS 反而慢一个数量级（线程调度开销远大于计算量），
# 必须在 import numpy 之前设置才生效：实测 42k 样本 3 epoch 从 >5 分钟降到几秒。
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np

from train_value import backward, forward, init_layer

# 候选动作的类别，顺序固定；改了就必须重训
ACTION_KINDS = ("useSkill", "playCard", "switchActive", "elementalTuning", "declareEnd", "none")
# 类别 one-hot + cost/dmg/kill/fast/tgtHp/end（+ sc，可选）
ACTION_NUMBERS = ("cost", "dmg", "kill", "fast", "tgtHp", "end")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", nargs="+", required=True, help="JSONL 文件或通配符")
    parser.add_argument("--out", default="policy-nn.json")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--hidden", default="64,32", help="隐藏层宽度，逗号分隔")
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--batch", type=int, default=128, help="每批多少个决策点")
    parser.add_argument("--val-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=20260101)
    parser.add_argument(
        "--no-score",
        action="store_true",
        help="不把启发式打分 sc 作为输入：推理时就不用先跑一遍启发式，但准确率会掉",
    )
    return parser.parse_args()


def open_text(path):
    return gzip.open(path, "rt", encoding="utf-8") if path.endswith(".gz") else open(path, encoding="utf-8")


def encode_action(candidate, with_score):
    """候选动作 → 定长向量。sc 是启发式打分，带上它等于让网络抄现成答案。"""
    kind = candidate.get("k", "none")
    keys = (*ACTION_NUMBERS, "sc") if with_score else ACTION_NUMBERS
    return [
        *(1.0 if kind == name else 0.0 for name in ACTION_KINDS),
        *(float(candidate.get(key, 0) or 0) for key in keys),
    ]


def load_samples(patterns):
    paths = []
    for pattern in patterns:
        paths.extend(glob.glob(pattern))
    if not paths:
        raise SystemExit(f"没有匹配到数据文件: {patterns}")
    states, candidate_lists, labels = [], [], []
    skipped = 0
    for path in sorted(set(paths)):
        with open_text(path) as file:
            for line in file:
                row = json.loads(line)
                candidates = row.get("c") or []
                # v4 用 ai（选中项在候选里的位置）；v3 只有 a（全局下标），越界的行丢掉
                label = row["ai"] if "ai" in row else row.get("a", -1)
                # 只有一个候选的局面没有偏好信号，标签越界的行是旧格式，都丢掉
                if len(candidates) < 2 or not isinstance(label, int) or not 0 <= label < len(candidates):
                    skipped += 1
                    continue
                states.append(row["x"])
                candidate_lists.append(candidates)
                labels.append(label)
    if not states:
        raise SystemExit("没有可用的决策样本")
    if skipped:
        print(f"跳过 {skipped} 行（候选不足或标签越界）")
    return (
        np.asarray(states, dtype=np.float32),
        candidate_lists,
        np.asarray(labels, dtype=np.int64),
    )


def pad_candidates(candidates, dim):
    """把一批候选补齐成 (B, K, D)，附带 (B, K) 的合法性掩码"""
    width = max(len(items) for items in candidates)
    padded = np.zeros((len(candidates), width, dim), dtype=np.float32)
    mask = np.zeros((len(candidates), width), dtype=bool)
    for index, items in enumerate(candidates):
        padded[index, : len(items)] = items
        mask[index, : len(items)] = True
    return padded, mask


def main():
    args = parse_args()
    rng = np.random.default_rng(args.seed)
    with_score = not args.no_score
    states, raw_candidates, labels = load_samples(args.data)
    candidates = [
        np.asarray([encode_action(item, with_score) for item in items], dtype=np.float32)
        for items in raw_candidates
    ]
    action_dim = len(ACTION_KINDS) + len(ACTION_NUMBERS) + (1 if with_score else 0)
    print(
        f"决策样本 {len(states)} 条，状态 {states.shape[1]} 维，动作 {action_dim} 维"
        f"（{'含' if with_score else '不含'}启发式打分）"
    )

    order = rng.permutation(len(states))
    split = int(len(order) * (1 - args.val_ratio))
    train_idx, val_idx = order[:split], order[split:]

    # 状态与动作分别归一化，推理端要用同一份参数
    flat_candidates = np.concatenate([candidates[i] for i in train_idx])
    state_mean, action_mean = states[train_idx].mean(axis=0), flat_candidates.mean(axis=0)
    state_std, action_std = states[train_idx].std(axis=0), flat_candidates.std(axis=0)
    state_std[state_std < 1e-6] = 1.0
    action_std[action_std < 1e-6] = 1.0
    mean = np.concatenate([state_mean, action_mean])
    std = np.concatenate([state_std, action_std])
    states_norm = (states - state_mean) / state_std

    widths = [states.shape[1] + action_dim] + [int(width) for width in args.hidden.split(",")] + [1]
    layers = []
    for index in range(len(widths) - 1):
        # 最后一层不打激活，输出的是可以随便大小比较的分数
        kind = "relu" if index < len(widths) - 2 else "none"
        layers.append([init_layer(rng, widths[index], widths[index + 1]),
                       np.zeros(widths[index + 1], dtype=np.float32), kind])
    moments = [[np.zeros_like(w), np.zeros_like(w), np.zeros_like(b), np.zeros_like(b)] for w, b, _ in layers]
    beta1, beta2, eps = 0.9, 0.999, 1e-8
    step = 0

    def score_batch(indexes):
        batch_states = states_norm[indexes]
        batch_candidates = [
            (np.asarray(candidates[i], dtype=np.float32) - action_mean) / action_std for i in indexes
        ]
        padded, mask = pad_candidates(batch_candidates, action_dim)
        inputs = np.concatenate(
            [np.repeat(batch_states[:, None, :], padded.shape[1], axis=1), padded], axis=2
        )
        return inputs, mask

    for epoch in range(args.epochs):
        permutation = rng.permutation(train_idx)
        total_loss = 0.0
        for offset in range(0, len(permutation), args.batch):
            batch_idx = permutation[offset: offset + args.batch]
            inputs, mask = score_batch(batch_idx)
            shape = inputs.shape[:2]
            activations = forward(layers, inputs.reshape(-1, inputs.shape[2]))
            scores = activations[-1][:, 0].reshape(shape)
            scores = np.where(mask, scores, -1e9)
            scores = scores - scores.max(axis=1, keepdims=True)
            exponentials = np.where(mask, np.exp(scores), 0.0)
            probabilities = exponentials / exponentials.sum(axis=1, keepdims=True)
            picked = probabilities[np.arange(len(batch_idx)), labels[batch_idx]]
            total_loss += float(-np.log(np.maximum(picked, 1e-12)).sum())

            grad = probabilities.copy()
            grad[np.arange(len(batch_idx)), labels[batch_idx]] -= 1.0
            grad = (grad / len(batch_idx)).reshape(-1, 1)
            grads = backward(layers, activations, grad.astype(np.float32))
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

        val_inputs, val_mask = score_batch(val_idx)
        val_scores = forward(layers, val_inputs.reshape(-1, val_inputs.shape[2]))[-1][:, 0]
        val_scores = np.where(val_mask, val_scores.reshape(val_inputs.shape[:2]), -1e9)
        accuracy = float(np.mean(val_scores.argmax(axis=1) == labels[val_idx]))
        # 候选数平均 5 个时随机猜是 20%，这个数是唯一能说明学没学到东西的指标
        random_baseline = float(np.mean([1.0 / len(candidates[i]) for i in val_idx]))
        print(
            f"epoch {epoch + 1:02d}/{args.epochs}  cross_entropy {total_loss / len(permutation):.4f}  "
            f"val_top1 {accuracy:.2%}  (随机猜 {random_baseline:.1%})",
            flush=True,
        )

    export = {
        "kind": "gi-tcg-policy-nn",
        "version": 1,
        "stateDim": int(states.shape[1]),
        "actionDim": int(action_dim),
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
    sys.exit(main())
