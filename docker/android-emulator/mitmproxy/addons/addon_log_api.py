"""Enregistre les requêtes HTTP utiles pour analyser l'API Sky Novel / Realm Novel."""

import json
from datetime import datetime, timezone

OUTPUT = "/captures/skynovel-flows.jsonl"

SKIP_SUFFIXES = (
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".woff",
    ".woff2",
    ".css",
    ".ico",
)

SKIP_HOST_PARTS = (
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.com",
    "doubleclick.net",
    "play.googleapis.com",
    "update.googleapis.com",
    "edgedl.me.gvt1.com",
    "gvt1.com",
)


def _should_skip(url: str, host: str) -> bool:
    lower = url.lower()
    if any(lower.endswith(suffix) for suffix in SKIP_SUFFIXES):
        return True
    if any(part in host for part in SKIP_HOST_PARTS):
        return True
    return False


def _safe_text(flow_part, limit: int) -> str | None:
    try:
        text = flow_part.get_text(strict=False)
    except Exception:
        return None
    if not text:
        return None
    if len(text) > limit:
        return text[:limit] + "\n…[truncated]"
    return text


def response(flow):
    url = flow.request.pretty_url
    host = flow.request.host or ""
    if _should_skip(url, host):
        return

    entry = {
        "time": datetime.now(timezone.utc).isoformat(),
        "method": flow.request.method,
        "url": url,
        "host": host,
        "status": flow.response.status_code,
        "request_headers": dict(flow.request.headers),
        "response_headers": dict(flow.response.headers),
    }

    req_body = _safe_text(flow.request, 50_000)
    if req_body:
        entry["request_body"] = req_body

    resp_body = _safe_text(flow.response, 100_000)
    if resp_body:
        entry["response_body"] = resp_body

    with open(OUTPUT, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
