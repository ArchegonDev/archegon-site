#!/usr/bin/env python3
"""
Build the personal research notes area from Markdown.

Reads:  notes/posts/*.md          one file per note
        notes/repos.yml           list of code repositories
Writes: notes/index.html          listing page
        notes/<slug>/index.html   one page per note

GitHub Pages builds nothing, so this runs locally and the generated HTML is
committed. Front matter is a YAML block at the top of each file:

    ---
    title: Why I stopped trusting demo videos
    date: 2026-08-14
    tags: [agents, evaluation]
    summary: One-line teaser used on the listing page.
    draft: false
    ---

Usage:  python3 tools/build-notes.py
"""

import html
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "notes" / "posts"
OUT = ROOT / "notes"
SITE = "https://www.archegon.com"

try:
    import yaml
except ImportError:
    sys.exit("error: pyyaml is required.  pip3 install pyyaml")

try:
    import markdown as md_lib
except ImportError:
    md_lib = None


def render_markdown(text: str) -> str:
    """Markdown -> HTML, with a minimal fallback if the library is absent."""
    if md_lib is not None:
        return md_lib.markdown(
            text, extensions=["fenced_code", "codehilite", "tables", "toc"]
        )

    # Fallback: paragraphs, headings, code fences, links, emphasis. Enough to
    # keep the build working without the dependency, not a full parser.
    out, in_code = [], False
    for block in text.split("\n\n"):
        b = block.strip()
        if not b:
            continue
        if b.startswith("```"):
            in_code = not in_code
            body = html.escape(b.strip("`").split("\n", 1)[-1])
            out.append(f"<pre><code>{body}</code></pre>")
            in_code = False
            continue
        h = re.match(r"^(#{1,4})\s+(.*)$", b)
        if h:
            lvl = len(h.group(1)) + 1
            out.append(f"<h{lvl}>{html.escape(h.group(2))}</h{lvl}>")
            continue
        b = html.escape(b)
        b = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', b)
        b = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", b)
        b = re.sub(r"`([^`]+)`", r"<code>\1</code>", b)
        out.append(f"<p>{b}</p>")
    return "\n".join(out)


def parse(path: Path) -> dict | None:
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.S)
    if not m:
        sys.exit(f"error: {path.name} has no YAML front matter")

    meta = yaml.safe_load(m.group(1)) or {}
    for key in ("title", "date", "summary"):
        if not meta.get(key):
            sys.exit(f"error: {path.name} front matter is missing '{key}'")

    if meta.get("draft"):
        print(f"  skipping draft: {path.name}")
        return None

    d = meta["date"]
    if isinstance(d, str):
        d = date.fromisoformat(d)

    return {
        "slug": meta.get("slug") or path.stem,
        "title": str(meta["title"]),
        "date": d,
        "summary": str(meta["summary"]),
        "tags": [str(t) for t in (meta.get("tags") or [])],
        "body": render_markdown(m.group(2)),
    }


def head(title: str, desc: str, canonical: str, depth: int) -> str:
    """Shared <head>. depth = how many levels below site root."""
    up = "../" * depth
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#101418">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}/assets/og-card.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{canonical}">
<link rel="icon" href="{up}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{up}styles.css">
<script defer data-domain="archegon.com" src="https://plausible.io/js/script.js"></script>
</head>
<body>"""


def header(depth: int, current: str = "") -> str:
    up = "../" * depth
    def mark(name):
        return ' aria-current="page"' if name == current else ""
    return f"""
<header class="site-header" data-header>
  <a class="brand" href="{up}" aria-label="Archegon home">
    <img class="brand-logo" src="{up}assets/logo.svg?v=4" alt="Archegon" width="334" height="102">
  </a>
  <nav class="nav" aria-label="Primary navigation">
    <a href="{up}#thesis">Thesis</a>
    <a href="{up}#projects">Projects</a>
    <a href="{up}#opportunity">Opportunity</a>
    <a href="{up}blog/"{mark('blog')}>Research</a>
    <a href="{up}notes/"{mark('notes')}>Notes</a>
    <a href="{up}evidence/"{mark('evidence')}>Evidence</a>
    <a href="{up}#about">About</a>
  </nav>
  <a class="header-cta" href="{up}#contact">Register interest</a>
</header>"""


def footer(depth: int) -> str:
    up = "../" * depth
    return f"""
<footer class="site-footer">
  <div class="footer-top">
    <div>
      <p class="footer-mark">Archegon</p>
      <p>Bringing compute to the heat.</p>
    </div>
    <nav class="footer-links" aria-label="Footer">
      <a href="{up}evidence/">Evidence</a>
      <a href="{up}blog/">Research notes</a>
      <a href="{up}notes/">Personal notes</a>
      <a href="mailto:hello@archegon.com">hello@archegon.com</a>
    </nav>
  </div>
  <p class="footer-disclaimer">
    Personal research notes reflect the author's own views and are published
    for discussion. Nothing on this website constitutes an offer or invitation
    to invest, financial advice, or a financial promotion.
  </p>
</footer>
<script src="{up}script.js"></script>
</body>
</html>
"""


def fmt(d: date) -> str:
    return d.strftime("%-d %B %Y")


def post_page(p: dict) -> str:
    tags = "".join(f"<li>{html.escape(t)}</li>" for t in p["tags"])
    tag_block = f'<ul class="tags">{tags}</ul>' if tags else ""
    canonical = f"{SITE}/notes/{p['slug']}/"
    return (
        head(f"{p['title']} | Archegon notes", p["summary"], canonical, 2)
        + header(2, "notes")
        + f"""
<main class="section-band note-page" id="top">
  <a class="back-link" href="../">All notes</a>
  <article class="note">
    <p class="post-meta">{fmt(p['date'])}</p>
    <h1>{html.escape(p['title'])}</h1>
    <p class="hero-lede">{html.escape(p['summary'])}</p>
    {tag_block}
    <div class="note-body">
{p['body']}
    </div>
  </article>
</main>"""
        + footer(2)
    )


def index_page(posts: list[dict], repos: list[dict]) -> str:
    cards = []
    for p in posts:
        tags = " ".join(f"<span>{html.escape(t)}</span>" for t in p["tags"][:3])
        cards.append(f"""      <article class="post-card">
        <p class="post-meta">{fmt(p['date'])}</p>
        <h2><a href="{p['slug']}/">{html.escape(p['title'])}</a></h2>
        <p>{html.escape(p['summary'])}</p>
        <div class="tag-row">{tags}</div>
        <a class="read-link" href="{p['slug']}/">Read note</a>
      </article>""")

    repo_cards = []
    for r in repos:
        lang = f'<span>{html.escape(str(r["language"]))}</span>' if r.get("language") else ""
        repo_cards.append(f"""      <article class="repo-card">
        <h3><a href="{html.escape(str(r['url']))}" target="_blank" rel="noopener">{html.escape(str(r['name']))}</a></h3>
        <p>{html.escape(str(r.get('description', '')))}</p>
        <div class="tag-row">{lang}</div>
      </article>""")

    repo_section = ""
    if repo_cards:
        repo_section = f"""
  <section class="section-band quiet-band" id="code">
    <div class="band-head">
      <p class="eyebrow">Code</p>
      <h2>Repositories and experiments</h2>
    </div>
    <div class="repo-grid">
{chr(10).join(repo_cards)}
    </div>
  </section>"""

    empty = (
        '<p class="disclaimer">No notes published yet.</p>' if not cards else ""
    )

    return (
        head(
            "Notes | Archegon",
            "Personal research notes, essays, and code from Anthony Lui — "
            "on AI systems, energy, and infrastructure.",
            f"{SITE}/notes/",
            1,
        )
        + header(1, "notes")
        + f"""
<main id="top">
  <section class="section-band blog-hero">
    <p class="eyebrow">Personal research</p>
    <h1>Notes</h1>
    <p class="hero-lede">
      Working notes, essays, and code from Anthony Lui. These are personal
      research interests — AI systems, energy, and infrastructure — written up
      as they develop. They are separate from the Archegon project material and
      represent the author's own views rather than a company position.
    </p>
  </section>

  <section class="section-band post-list" aria-label="Notes">
{chr(10).join(cards)}
    {empty}
  </section>
{repo_section}
</main>"""
        + footer(1)
    )


def main() -> None:
    POSTS.mkdir(parents=True, exist_ok=True)

    posts = []
    for f in sorted(POSTS.glob("*.md")):
        p = parse(f)
        if p:
            posts.append(p)
    posts.sort(key=lambda p: p["date"], reverse=True)

    repos_file = ROOT / "notes" / "repos.yml"
    repos = []
    if repos_file.exists():
        repos = yaml.safe_load(repos_file.read_text(encoding="utf-8")) or []
        for r in repos:
            if not r.get("name") or not r.get("url"):
                sys.exit("error: every entry in repos.yml needs name and url")

    for p in posts:
        d = OUT / p["slug"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(post_page(p), encoding="utf-8")

    (OUT / "index.html").write_text(index_page(posts, repos), encoding="utf-8")

    print(
        f"built notes/: {len(posts)} post(s), {len(repos)} repo(s)"
        + (" [fallback renderer]" if md_lib is None else "")
    )
    for p in posts:
        print(f"  notes/{p['slug']}/  {p['title']}")


if __name__ == "__main__":
    main()
