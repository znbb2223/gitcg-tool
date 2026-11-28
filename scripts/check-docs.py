#!/usr/bin/env python3
"""文档自检：检查 Markdown 围栏配对与相对链接是否存在。

用法：python3 scripts/check-docs.py
退出码：0 全通过；1 有问题。
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules", "dist", "build", "dist-lab"}


def md_files():
    for path in ROOT.rglob("*.md"):
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        yield path


def main():
    problems = []
    for path in md_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        rel = path.relative_to(ROOT)
        lines = text.splitlines()

        fences = sum(1 for line in lines if line.startswith("```"))
        if fences % 2:
            problems.append(f"{rel}: 代码围栏不配对（{fences} 个）")

        for match in re.finditer(r"\[[^\]]*\]\(([^)]+)\)", text):
            target = match.group(1).strip()
            if not target or target.startswith(("http://", "https://", "#", "mailto:", "//")):
                continue
            target = target.split("#")[0]
            if not target:
                continue
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                problems.append(f"{rel}: 死链 -> {target}")

    if problems:
        print(f"发现 {len(problems)} 个问题：")
        for item in problems:
            print(" -", item)
        return 1

    print("文档自检通过：围栏配对、相对链接全部有效。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
