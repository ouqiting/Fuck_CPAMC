#!/usr/bin/env python3
"""Clean management.html Builder - Linux version.

Clones upstream, patches out APIKEY.FUN entries, builds, outputs management.html.
"""

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run(cmd, cwd=None, check=True):
    print(f"  $ {' '.join(cmd) if isinstance(cmd, list) else cmd}", flush=True)
    result = subprocess.run(
        cmd if isinstance(cmd, list) else cmd,
        cwd=str(cwd) if cwd else None,
        shell=isinstance(cmd, str),
    )
    if check and result.returncode != 0:
        print(f"[ERROR] Command failed with exit code {result.returncode}", flush=True)
        sys.exit(result.returncode)
    return result


def check_command(cmd):
    return shutil.which(cmd) is not None


def main():
    parser = argparse.ArgumentParser(description="Build clean management.html")
    parser.add_argument("--output-dir", default="./output", help="Output directory")
    parser.add_argument(
        "--upstream-url",
        default="https://github.com/router-for-me/Cli-Proxy-API-Management-Center.git",
        help="Upstream git URL",
    )
    parser.add_argument("--branch", default="main", help="Upstream branch")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    output_path = Path(args.output_dir)
    if not output_path.is_absolute():
        output_path = script_dir / output_path
    work_dir = script_dir / ".build-tmp"
    repo_dir = work_dir / "repo"
    patch_script = script_dir / "patch.cjs"

    print("=" * 40)
    print("  Clean management.html Builder")
    print("=" * 40)
    print(f"Upstream : {args.upstream_url}")
    print(f"Branch   : {args.branch}")
    print(f"WorkDir  : {work_dir}")
    print(f"Output   : {output_path}")
    print()

    for cmd in ("git", "node", "bun"):
        if not check_command(cmd):
            print(f"[ERROR] '{cmd}' not found in PATH. Please install it first.")
            sys.exit(1)

    print("[1/6] Cloning upstream...")
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    run(["git", "clone", "--depth", "1", "--branch", args.branch, args.upstream_url, str(repo_dir)])

    print("[2/6] Installing dependencies...")
    run(["bun", "install", "--frozen-lockfile"], cwd=repo_dir)

    print("[3/6] Applying patch (hiding XXX sidebar & dashboard entries)...")
    run(["node", str(patch_script), str(repo_dir)], cwd=repo_dir)

    print("[4/6] Building...")
    run(["bun", "run", "build"], cwd=repo_dir)

    print("[5/6] Copying management.html...")
    built_html = repo_dir / "dist" / "index.html"
    if not built_html.exists():
        print(f"[ERROR] {built_html} not found after build.")
        sys.exit(1)
    output_path.mkdir(parents=True, exist_ok=True)
    dest_file = output_path / "management.html"
    shutil.copy2(built_html, dest_file)
    size_mb = round(dest_file.stat().st_size / (1024 * 1024), 2)
    print(f"  -> {dest_file} ({size_mb} MB)")

    print("[6/6] Cleaning up temp files...")
    try:
        def _on_rm_error(func, path, exc_info):
            os.chmod(path, 0o777)
            func(path)

        shutil.rmtree(work_dir, onerror=_on_rm_error)
        print(f"  Removed {work_dir}")
    except Exception as e:
        print(f"[WARN] Failed to remove {work_dir}: {e}")
        print("       You can delete it manually.")

    print()
    print("=" * 40)
    print("  Done!")
    print("=" * 40)
    print(f"management.html is at: {dest_file}")
    print("Copy it to your CLI Proxy API backend folder.")


if __name__ == "__main__":
    main()
