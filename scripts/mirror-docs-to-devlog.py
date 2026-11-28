#!/usr/bin/env python3
"""把公开仓库的 docs/ 镜像到私密开发日志仓库（gitcg-devlog）。

用法：
  python3 scripts/mirror-docs-to-devlog.py --devlog ../gitcg-devlog

做三件事：
1. 复制 docs/*.md、docs/screenshots/、docs/development/ 到 <devlog>/docs/；
2. 把指向公开仓库其它目录的相对链接改写成 GitHub 地址（镜像里没有那些文件）；
3. 在 docs/README.md 顶部写入快照说明（源提交、日期）。
"""
import argparse
import datetime
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "https://github.com/znbb2223/gitcg-tool"
BLOB = f"{REPO}/blob/main"
TREE = f"{REPO}/tree/main"


def repo_path(target: str, current: Path, docs_root: Path) -> str:
    base = Path("docs") / current.relative_to(docs_root)
    return os.path.normpath(str(base.parent / target)).lstrip("./")


def rewrite(text: str, current: Path, docs_root: Path) -> tuple[str, int]:
    changed = 0

    def repl(match: re.Match) -> str:
        nonlocal changed
        label, target = match.group(1), match.group(2)
        if target.startswith(("http", "mailto:", "#")):
            return match.group(0)
        path, _, anchor = target.partition("#")
        if not path or (current.parent / path).exists():
            return match.group(0)
        dest = repo_path(path, current, docs_root)
        url = (BLOB if Path(dest).suffix else TREE) + "/" + dest
        if anchor:
            url += "#" + anchor
        changed += 1
        return f"[{label}]({url})"

    return re.sub(r"\[([^\]]*)\]\(([^)]+)\)", repl, text), changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--devlog", required=True, help="gitcg-devlog 本地路径")
    args = ap.parse_args()
    dst = Path(args.devlog).expanduser().resolve() / "docs"

    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True)
    for f in (ROOT / "docs").glob("*.md"):
        shutil.copy2(f, dst / f.name)
    for name in ("screenshots", "development"):
        src = ROOT / "docs" / name
        if src.exists():
            shutil.copytree(src, dst / name)

    rewritten = 0
    for f in dst.rglob("*.md"):
        text = f.read_text(encoding="utf-8", errors="ignore")
        text, n = rewrite(text, f, dst)
        f.write_text(text, encoding="utf-8")
        rewritten += n

    commit = subprocess.check_output(
        ["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"]
    ).decode().strip()
    today = datetime.date.today().isoformat()
    readme = dst / "README.md"
    note = (
        f"> **快照说明**：本目录是公开仓库 `znbb2223/gitcg-tool` 的 `docs/` 镜像"
        f"（提交 `{commit}`，{today}）。\n"
        "> 以公开仓库为准；更新方式见本仓库根目录 README「文档快照」一节。\n\n"
    )
    body = readme.read_text(encoding="utf-8") if readme.exists() else "# 文档镜像\n"
    if "快照说明" in body:
        body = re.sub(r"> \*\*快照说明\*\*.*?\n\n", "", body, flags=re.S)
    readme.write_text(note + body, encoding="utf-8")

    print(f"镜像完成：{len(list(dst.rglob('*.md')))} 个 md，改写外链 {rewritten} 处，源提交 {commit}")


if __name__ == "__main__":
    main()
