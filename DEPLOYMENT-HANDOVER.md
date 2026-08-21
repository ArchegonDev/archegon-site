# Archegon deployment handover

## Current state

- Repository: `https://github.com/ArchegonDev/archegon-site.git`
- Branch: `main`
- Deployment target: GitHub Pages
- Custom domain: `www.archegon.com`
- Site type: static HTML/CSS/JS; no build server and no runtime API
- Local preview:

```sh
python3 -m http.server 4180 --bind 127.0.0.1
```

Open `http://127.0.0.1:4180/`.

## What is ready to deploy

- `index.html` is now the promoted Archegon redesign:
  - flat EGS SVG hero
  - sharper partner-focused copy
  - five-year milestone/phasing section
  - lead form with `mailto:` handoff
  - evidence citations
  - own data-hall photography
- `blog/` remains the Archegon project research-notes area.
- `notes/` is the separate personal research area:
  - listing page: `/notes/`
  - Markdown source: `notes/posts/*.md`
  - generated post pages: `notes/<slug>/index.html`
  - repository cards: `notes/repos.yml`
- `evidence/` uses the shared visual system and contains source and image credits.
- `lab/` contains prototypes only. It is excluded from `sitemap.xml` and blocked in `robots.txt`.

## Release verification

Run these from the repository root before pushing:

```sh
python3 tools/build-notes.py
python3 tools/check_links.py
git status --short
```

Expected link-check output:

```text
Checked internal links: OK
```

The final local smoke test should confirm these URLs return 200:

- `/`
- `/blog/`
- `/notes/`
- `/notes/welcome/`
- `/evidence/`
- `/assets/photo-cabling.webp`
- `/assets/photo-containment.webp`
- `/figure.svg`
- `/sitemap.xml`
- `/robots.txt`

The pages were also checked at desktop and 390px mobile widths. The mobile
navigation is visible and horizontally scrollable; all links have a 44px hit
area. The four public pages pass axe-core WCAG 2A/AA checks with zero
violations. The photographic opportunity band was checked from rendered pixels
after strengthening its scrim for small-text contrast.

## Deployment

This repository has no GitHub Actions workflow. Deploy the merged `main`
branch using the repository's GitHub Pages settings:

1. Push local `main` to `origin`.
2. In GitHub, open **Settings → Pages**.
3. Use the configured branch deployment from `main` (root `/`).
4. Confirm the custom domain remains `www.archegon.com`.
5. Wait for Pages to publish, then hard-refresh the custom domain.
6. Verify the homepage, `/blog/`, `/notes/`, and `/evidence/` on the public URL.

Do not deploy `lab/agent/`: it is a deterministic offline prototype, not a
production visitor agent. It has no API key and no server-side proxy. A live
LLM version would require a server-side provider proxy, rate limiting, logging
policy, and a reviewed compliance guardrail before it is linked publicly.

## Adding a personal note

Create a Markdown file in `notes/posts/` with this front matter:

```yaml
---
title: A clear title
date: 2026-08-21
tags: [research, agents]
summary: A one-line description for the notes listing.
draft: false
---
```

Then run:

```sh
python3 tools/build-notes.py
python3 tools/check_links.py
```

Add public code repositories to `notes/repos.yml`, then run the same build.
Generated HTML is committed because GitHub Pages does not run a build step.

## Content and compliance guardrails

- Keep personal notes clearly separate from Archegon project material.
- Keep project claims sourced to `evidence/`; label illustrative figures and
  image context accurately.
- Do not publish return figures, capital requirements, capital-stack details,
  or financial-model outputs on the public site.
- Keep the no-offer/no-financial-advice/no-financial-promotion language on
  investor-facing pages.
- Review any jurisdiction-specific legal language with a qualified solicitor;
  this handover is not legal advice.
- Keep the Fervo-style EGS geometry: paired wells, long parallel laterals, and
  engineered fractures. Do not replace it with conventional vertical-well
  geothermal imagery.

## Rollback

If the public deployment is not acceptable, revert the Pages source to the
previous published commit in GitHub. The pre-merge branch remains available
locally as `hero-geothermal-scene` until it is deliberately removed.
