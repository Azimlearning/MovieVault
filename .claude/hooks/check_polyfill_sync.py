#!/usr/bin/env python3
"""
MovieVault — polyfill-sync reminder (PreToolUse on Write/Edit/MultiEdit).

When preload.js is edited, checks whether the change adds a new property
to the contextBridge / window.electron exposure. If so, reminds Claude to
also add a matching stub in apps/web/src/ipc/polyfill.js.

This is a WARNING only (exit 0) — it does not block the write. It surfaces
the reminder so it isn't forgotten, because polyfill drift is the #1 cause
of "works in Electron, crashes in browser" bugs.
"""

from __future__ import annotations

import json
import re
import sys


PRELOAD_PATHS = {"preload.js", "preload.ts"}


def looks_like_new_method(new_string: str) -> list[str]:
    """Return suspected new method names found in the new_string."""
    # Match patterns like:   methodName: async (...) =>
    #                        methodName: (...)  =>
    #                        methodName: function
    pattern = re.compile(r"^\s{4,}(\w+)\s*:\s*(?:async\s+)?\(", re.MULTILINE)
    return pattern.findall(new_string)


def main() -> int:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        return 0

    tool = data.get("tool_name", "")
    ti = data.get("tool_input", {}) or {}

    if tool not in {"Write", "Edit", "MultiEdit"}:
        return 0

    import os
    path = ti.get("file_path", "")
    basename = os.path.basename(path)
    if basename not in PRELOAD_PATHS:
        return 0

    # Get the content being written/changed
    if tool == "Write":
        content = ti.get("content", "") or ""
    elif tool == "Edit":
        content = ti.get("new_string", "") or ""
    elif tool == "MultiEdit":
        edits = ti.get("edits", []) or []
        content = "\n".join(e.get("new_string", "") for e in edits)
    else:
        return 0

    methods = looks_like_new_method(content)
    if not methods:
        return 0

    msg = [
        f"⚠️  preload.js edited — possible new window.electron method(s): {', '.join(methods)}",
        "",
        "  Reminder: every method added to preload.js needs a matching stub in:",
        "    apps/web/src/ipc/polyfill.js",
        "",
        "  Without the stub, the web app will throw 'window.electron.<method> is not a function'.",
        "  See: refdocs/guides/feature_parity.md — 'IPC polyfill pattern'",
        "       refdocs/changelog/DECISIONS.md  — ADR-002",
    ]
    print("\n".join(msg), file=sys.stderr)
    return 0  # warning only — does not block the write


if __name__ == "__main__":
    sys.exit(main())
