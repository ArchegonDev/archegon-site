#!/usr/bin/env python3
"""
Build the grounding corpus for the lab/ visitor agent.

The agent must only answer from material already published on this site, so
this script extracts it directly from the shipped HTML rather than keeping a
hand-written copy that could drift out of date:

  * evidence/index.html  -> cited sources (id, badge, title, blurb, url)
  * blog/index.html      -> research-note sections
  * lab/index.html       -> the live page copy (thesis, projects, phasing)

Output: lab/agent/kb.json

Run after changing any published copy:  python3 tools/build-kb.py
"""

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "lab" / "agent" / "kb.json"

# Anything matching these is commercially sensitive and must never be
# summarised into the corpus, even if it appears in page copy.
BANNED = re.compile(
    r"\b(irr|return on investment|roi|valuation|pre-money|post-money|"
    r"equity stake|share price|dividend|payback period)\b",
    re.I,
)


def text(fragment: str) -> str:
    """HTML fragment -> collapsed plain text."""
    fragment = re.sub(r"<sup.*?</sup>", "", fragment, flags=re.S)
    # Citation superscripts are bare <a class="cite">7</a>, so stripping tags
    # would leave orphan digits mid-sentence. Remove the whole element.
    fragment = re.sub(r'<a[^>]*class="cite"[^>]*>.*?</a>', "", fragment, flags=re.S)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    out = html.unescape(re.sub(r"\s+", " ", fragment)).strip()
    # Tidy space left before punctuation by tag removal.
    return re.sub(r"\s+([.,;:])", r"\1", out)


# Legal boilerplate and image credits are not answers. They repeat across
# sections and would otherwise dominate retrieval.
SKIP_CLASSES = (
    "source-note",
    "plate-note",
    "plate-credit",
    "figure-caption",
    "footer-disclaimer",
    "phase-cap",
    "phase-total",
)

SKIP_TEXT = re.compile(
    r"^(illustrative|image:|nothing on this website|indicative phasing|"
    r"project summaries|capacity-factor)",
    re.I,
)


def read(rel: str) -> str:
    p = ROOT / rel
    if not p.exists():
        sys.exit(f"error: missing {rel}")
    return p.read_text(encoding="utf-8")


def sources() -> list[dict]:
    src = read("evidence/index.html")
    out = []
    for m in re.finditer(
        r'<article class="source-entry" id="source-([^"]+)">(.*?)</article>',
        src,
        re.S,
    ):
        sid, body = m.group(1), m.group(2)
        badge = re.search(r'class="source-badge">(.*?)<', body, re.S)
        title = re.search(r"<h3>(.*?)</h3>", body, re.S)
        blurb = re.search(r"<p>(.*?)</p>", body, re.S)
        url = re.search(r'href="(https?://[^"]+)"', body)
        out.append(
            {
                "id": sid,
                "kind": text(badge.group(1)) if badge else "Source",
                "title": text(title.group(1)) if title else "",
                "summary": text(blurb.group(1)) if blurb else "",
                "url": url.group(1) if url else "",
                "anchor": f"evidence/#source-{sid}",
            }
        )
    return out


def notes() -> list[dict]:
    """Research-note sections from the blog index."""
    src = read("blog/index.html")
    out = []
    for m in re.finditer(
        r'<(?:article|section)[^>]*id="([^"]+)"[^>]*>(.*?)</(?:article|section)>',
        src,
        re.S,
    ):
        nid, body = m.group(1), m.group(2)
        if nid == "top":
            continue
        head = re.search(r"<h[23]>(.*?)</h[23]>", body, re.S)
        paras = [text(p) for p in re.findall(r"<p[^>]*>(.*?)</p>", body, re.S)]
        paras = [p for p in paras if len(p) > 40]
        if not paras:
            continue
        out.append(
            {
                "id": nid,
                "title": text(head.group(1)) if head else nid,
                "body": " ".join(paras)[:1200],
                "anchor": f"blog/#{nid}",
            }
        )
    return out


def page() -> list[dict]:
    """Section-level copy from the prototype page."""
    src = read("lab/index.html")
    out = []
    for m in re.finditer(
        r'<section class="[^"]*"[^>]*id="([^"]+)"[^>]*>(.*?)</section>', src, re.S
    ):
        sid, body = m.group(1), m.group(2)
        head = re.search(r"<h2>(.*?)</h2>", body, re.S)

        paras = []
        for tag, attrs, inner in re.findall(r"<(p|li)([^>]*)>(.*?)</\1>", body, re.S):
            if any(c in attrs for c in SKIP_CLASSES):
                continue
            t = text(inner)
            if len(t) < 60 or SKIP_TEXT.match(t):
                continue
            paras.append(t)

        # Sub-headings carry real meaning (e.g. phase names), so keep them as
        # their own sentences rather than letting them run into body prose.
        subs = [text(h) for h in re.findall(r"<h3>(.*?)</h3>", body, re.S)]

        if not paras:
            continue

        blob = " ".join(paras)
        out.append(
            {
                "id": sid,
                "title": text(head.group(1)) if head else sid,
                "body": blob[:1900],
                "subheads": subs[:8],
                "anchor": f"#{sid}",
            }
        )
    return out


def main() -> None:
    kb = {
        "note": "Generated by tools/build-kb.py. Do not edit by hand.",
        "sources": sources(),
        "notes": notes(),
        "sections": page(),
    }

    blob = json.dumps(kb)
    hits = sorted(set(m.group(0).lower() for m in BANNED.finditer(blob)))
    if hits:
        sys.exit(
            "error: corpus contains commercially sensitive terms "
            f"({', '.join(hits)}). Remove them from the published copy first."
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(kb, indent=1) + "\n", encoding="utf-8")
    print(
        f"wrote {OUT.relative_to(ROOT)}: "
        f"{len(kb['sources'])} sources, {len(kb['notes'])} notes, "
        f"{len(kb['sections'])} sections, {len(blob) // 1024} KB raw"
    )


if __name__ == "__main__":
    main()
