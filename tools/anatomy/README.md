# Anatomy figure (/how-it-works/anatomy/)

Built with the Anatomy isometric kit by Ryan, https://github.com/wheresryan22/anatomy
(commit 1482e8469b0a9e0d8cc18ea2740a01423d29ae80), MIT licence. `kit/iso-kit.mjs` is copied
unchanged and `kit/LICENSE` carries the original copyright and permission notice.

Rebuild:
    python3 tools/anatomy/model_figures.py path/to/recalculated-model.xlsx   # writes model.json
    node tools/anatomy/build.mjs                                             # writes SVG + fragments
    python3 <archegon-v3>/scripts/build_site_pages.py                       # wraps the page
Preview PNG: headless Chrome screenshot of assets/diagrams/anatomy.svg at 2x.

Scope note: the kit's method classes a whole plant as an "Epic". This is a Hero-scale version
(about 120 drawn parts); the kit's geometry audit and line-end check were not run.
