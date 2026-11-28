#!/usr/bin/env python3
"""把 docs/ 里的源文档同步成 APK 内置副本（android/dev-docs/）。

源 → 目标：
  docs/KNOWN-ISSUES.zh.md → android/dev-docs/KNOWN-ISSUES.md
  docs/MAINTENANCE.zh.md  → android/dev-docs/MAINTENANCE.md

规则：
- 源文档顶部加“自动生成，请改源文档”的说明；
- 相对链接改成 GitHub 地址（APK 内置副本里没有 docs/ 目录）；
- `--check` 只比较，不写入；有漂移时退出码 1。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "https://github.com/znbb2223/gitcg-tool/blob/main"

PAIRS = [
    ("docs/KNOWN-ISSUES.zh.md", "android/dev-docs/KNOWN-ISSUES.md", "KNOWN-ISSUES.zh.md"),
    ("docs/MAINTENANCE.zh.md", "android/dev-docs/MAINTENANCE.md", "MAINTENANCE.zh.md"),
]

HEADER = (
    "> ⚠️ 本文件由 `scripts/sync-dev-docs.py` 从 `docs/{source}` 自动生成，请改源文档。\n"
    "> 校验：`python3 scripts/sync-dev-docs.py --check`\n\n"
)


def link_to_github(match: re.Match) -> str:
    label, target = match.group(1), match.group(2)
    if target.startswith(("http://", "https://", "#", "mailto:")):
        return match.group(0)
    clean = target.lstrip("./")
    if clean.startswith("../docs/"):
        clean = clean[len("../docs/"):]
    if clean.startswith("docs/"):
        clean = clean[len("docs/"):]
    if clean.endswith(".md") or ".md#" in clean:
        clean = clean.replace("../", "")
        if not clean.startswith("docs/"):
            clean = "docs/" + clean
        return f"[{label}]({REPO}/{clean})"
    if clean.startswith("../"):
        return f"[{label}]({REPO}/{clean[3:]})"
    return f"[{label}]({REPO}/{clean})"


def build(src_rel: str, source_name: str) -> str:
    text = (ROOT / src_rel).read_text(encoding="utf-8")
    text = re.sub(r"\[([^\]]*)\]\(([^)]+)\)", link_to_github, text)
    return HEADER.format(source=source_name) + text


def main() -> int:
    check = "--check" in sys.argv
    changed = []
    for src_rel, dst_rel, source_name in PAIRS:
        content = build(src_rel, source_name)
        dst = ROOT / dst_rel
        old = dst.read_text(encoding="utf-8") if dst.exists() else ""
        if old != content:
            changed.append(dst_rel)
            if not check:
                dst.write_text(content, encoding="utf-8")
    if check:
        if changed:
            print("以下内置副本与源文档不一致：", ", ".join(changed))
            print("执行 python3 scripts/sync-dev-docs.py 重新生成。")
            return 1
        print("android/dev-docs 与 docs/ 源文档一致。")
        return 0
    print("已同步：", ", ".join(changed) if changed else "（无变化）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
