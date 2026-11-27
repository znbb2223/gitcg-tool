#!/usr/bin/env python3
"""样本统计诊断：读 JSONL / JSONL.gz，输出分布、标签平衡、特征统计。"""
import argparse, gzip, glob, json, statistics as st


def open_rows(paths):
    for path in paths:
        opener = gzip.open if path.endswith(".gz") else open
        with opener(path, "rt", encoding="utf-8") as file:
            for line in file:
                line = line.strip()
                if line:
                    yield json.loads(line)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", nargs="+", required=True)
    args = parser.parse_args()
    paths = []
    for pattern in args.data:
        paths.extend(glob.glob(pattern))
    rows = list(open_rows(sorted(set(paths))))
    if not rows:
        raise SystemExit("没有数据")

    wins = sum(r.get("w", 0) for r in rows)
    seats = {}
    actions, rounds = {}, {}
    per_game = {}
    for row in rows:
        seats[row.get("s")] = seats.get(row.get("s"), 0) + 1
        label = row.get("l") or row.get("a") or "?"
        actions[label.split(":")[0]] = actions.get(label.split(":")[0], 0) + 1
        rounds[row.get("t")] = rounds.get(row.get("t"), 0) + 1

    print(f"样本总行数: {len(rows)}")
    print(f"正样本率: {wins / len(rows):.2%}  （胜 {wins} / 负 {len(rows) - wins}）")
    print(f"座位分布: {seats}")
    print(f"回合分布: {dict(sorted(rounds.items(), key=lambda kv: (kv[0] is None, kv[0])))}")
    print(f"动作类型: {actions}")

    # 特征统计（只处理数组形式 f）
    matrix = [r["f"] for r in rows if isinstance(r.get("f"), list)]
    if matrix:
        dim = len(matrix[0])
        print(f"\n特征维度: {dim}")
        print("维度 | 均值 | 标准差 | 最小 | 最大")
        for i in range(min(dim, 25)):
            column = [row[i] for row in matrix if len(row) == dim]
            print(f"{i:>4} | {st.mean(column):>6.3f} | {st.pstdev(column):>6.3f} | {min(column):>6.3f} | {max(column):>6.3f}")
        constant = [i for i in range(dim) if len({round(row[i], 4) for row in matrix}) == 1]
        print(f"\n恒定不变的维度（信息量为 0）: {constant if constant else '无'}")


if __name__ == "__main__":
    main()
