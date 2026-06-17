#!/usr/bin/env python3
"""
MovieVault — secret-literal guard (PreToolUse on Write/Edit/MultiEdit).

Reads the Claude Code hook JSON on stdin. For file-write tools, scans the
content being written for TMDB API keys, JWTs, and other secret patterns.
If any match is found, exits 2 with a clear message so Claude self-corrects.

Fix: values belong in .env (Electron) or Vercel env vars (web), never in source.
"""

from __future__ import annotations

import json
import re
import sys

PATTERNS: list[tuple[str, str]] = [
    # TMDB v3 API key — 32-char hex string near a tmdb/api_key keyword
    ("TMDB API key (v3)",
     r"(?:TMDB|tmdb|api[_-]?key)[^A-Za-z0-9\n]{0,20}[0-9a-f]{32}"),
    # Bare 32-char hex that looks like a key value (= or : before it)
    ("32-char hex key literal",
     r"(?:=|:\s*['\"])[0-9a-f]{32}(?:['\"]|$)"),
    # JWT — eyJ… tokens (TMDB read access token is a JWT)
    ("JWT token (eyJ…)",
     r"eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}"),
    # Generic high-entropy secret near common keyword
    ("High-entropy literal near key/secret/token/password",
     r"(?:api[_-]?key|secret|token|password)[^A-Za-z0-9\n]{1,8}[A-Za-z0-9+/=_\-]{32,}"),
    # Other common key formats
    ("AWS access key",     r"AKIA[0-9A-Z]{16}"),
    ("GitHub PAT",         r"gh[pousr]_[A-Za-z0-9]{30,}"),
    ("Anthropic API key",  r"sk-ant-[A-Za-z0-9_\-]{20,}"),
    ("OpenAI API key",     r"sk-(?:proj-)?[A-Za-z0-9_\-]{20,}"),
]

ALLOW_MARK = "pragma: allowlist secret"

# Files where secrets are expected — skip scanning these
ALLOWED_PATHS = {".env", ".env.local", ".env.example", ".env.local.example"}


def extract_content(data: dict) -> tuple[str, str] | None:
    tool = data.get("tool_name", "")
    ti = data.get("tool_input", {}) or {}
    if tool == "Write":
        return ti.get("file_path", "?"), ti.get("content", "") or ""
    if tool == "Edit":
        return ti.get("file_path", "?"), ti.get("new_string", "") or ""
    if tool == "MultiEdit":
        edits = ti.get("edits", []) or []
        joined = "\n".join((e.get("new_string", "") or "") for e in edits)
        return ti.get("file_path", "?"), joined
    return None


def main() -> int:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        print(f"[check_secrets] warning: malformed hook JSON ({e}); pass-through.", file=sys.stderr)
        return 0

    pair = extract_content(data)
    if pair is None:
        return 0
    path_hint, content = pair

    # Don't scan .env files — they're supposed to have secrets
    import os
    basename = os.path.basename(path_hint)
    if basename in ALLOWED_PATHS or basename.startswith(".env"):
        return 0

    # Strip allowlisted lines
    lines = [ln for ln in content.splitlines() if ALLOW_MARK not in ln]

    findings: list[tuple[str, list[tuple[int, str]]]] = []
    for label, pattern in PATTERNS:
        hits: list[tuple[int, str]] = []
        for i, line in enumerate(lines, start=1):
            if re.search(pattern, line):
                hits.append((i, line.strip()[:160]))
                if len(hits) >= 3:
                    break
        if hits:
            findings.append((label, hits))

    if not findings:
        return 0

    msg = [f"🚫 Secret literal detected in {path_hint}", ""]
    for label, hits in findings:
        msg.append(f"  {label}:")
        for i, snippet in hits:
            msg.append(f"    line {i}: {snippet}")
        msg.append("")
    msg += [
        "Fix:",
        "  • Electron app  → put the value in .env at the project root (already gitignored).",
        "  • Web app       → set the variable in Vercel dashboard → Settings → Environment Variables.",
        "  • Local web dev → put it in apps/web/.env.local (gitignored).",
        "  • See: refdocs/guides/env_setup.md for the full variable reference.",
        "",
        "False positive? Append '# pragma: allowlist secret' to the line — use sparingly.",
    ]
    print("\n".join(msg), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
