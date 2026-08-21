#!/usr/bin/env python3
"""
Convert the 'Archegon' wordmark from live SVG <text> into a fixed outline path.

The shipped logo.svg sets the wordmark as an SVG <text> element with the font
stack "Snell Roundhand, Apple Chancery, Brush Script MT, Segoe Script, cursive".
Snell Roundhand ships only on macOS, so the logo renders as a different
typeface on Windows, Linux and Android. This script bakes the macOS rendering
into a <path> so the mark is identical everywhere.

Two details are needed to match the browser's rendering exactly:

  * Kerning is applied from the font's own `kern`/GPOS tables, because browsers
    enable kerning by default.
  * The original <text> asks for font-style="italic", but Snell Roundhand ships
    no italic face, so the browser synthesises an oblique. The effective angle
    was measured by rasterising both versions and minimising pixel difference,
    which bottomed out at 14 degrees.

Usage:  python3 tools/outline-wordmark.py
"""

import re
import sys
from fontTools.ttLib import TTCollection
from fontTools.pens.svgPathPen import SVGPathPen

FONT = "/System/Library/Fonts/Supplemental/SnellRoundhand.ttc"
TEXT = "Archegon"

# Must match the <text> element in assets/logo.svg
FONT_SIZE = 55.0
X = 108.0
BASELINE = 66.0

# Synthetic oblique substituted for the missing italic face, in degrees.
OBLIQUE = 14.0


def kern_pairs(font):
    """Flat {(left, right): value} map from the legacy `kern` table."""
    pairs = {}
    if "kern" not in font:
        return pairs
    for table in font["kern"].kernTables:
        pairs.update(table.kernTable)
    return pairs


def gpos_kerning(font, left, right):
    """Kerning for one pair from GPOS PairPos subtables, in font units."""
    if "GPOS" not in font:
        return 0

    total = 0
    for feature in font["GPOS"].table.FeatureList.FeatureRecord:
        if feature.FeatureTag != "kern":
            continue
        for idx in feature.Feature.LookupListIndex:
            lookup = font["GPOS"].table.LookupList.Lookup[idx]
            if lookup.LookupType != 2:  # PairPos
                continue
            for sub in lookup.SubTable:
                total += _pairpos_value(sub, left, right)
    return total


def _pairpos_value(sub, left, right):
    coverage = getattr(sub, "Coverage", None)
    if coverage is None or left not in coverage.glyphs:
        return 0
    i = coverage.glyphs.index(left)

    if sub.Format == 1:
        for record in sub.PairSet[i].PairValueRecord:
            if record.SecondGlyph == right:
                return getattr(record.Value1, "XAdvance", 0) or 0
        return 0

    if sub.Format == 2:
        c1 = sub.ClassDef1.classDefs.get(left, 0)
        c2 = sub.ClassDef2.classDefs.get(right, 0)
        try:
            value = sub.Class1Record[c1].Class2Record[c2].Value1
        except (IndexError, AttributeError):
            return 0
        return getattr(value, "XAdvance", 0) or 0

    return 0


def build_path(font):
    upem = font["head"].unitsPerEm
    scale = FONT_SIZE / upem
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    legacy = kern_pairs(font)

    glyphs = []
    for ch in TEXT:
        name = cmap.get(ord(ch))
        if name is None:
            sys.exit(f"error: no glyph for {ch!r} in {FONT}")
        glyphs.append(name)

    parts = []
    pen_x = 0.0  # in font units

    for i, name in enumerate(glyphs):
        if i:
            prev = glyphs[i - 1]
            kern = legacy.get((prev, name), 0) or gpos_kerning(font, prev, name)
            pen_x += kern

        pen = SVGPathPen(glyphset)
        glyphset[name].draw(pen)
        d = pen.getCommands()

        if d:
            # Glyph space is y-up, SVG user space is y-down, hence the flip.
            dx = X + pen_x * scale
            parts.append(
                f'<g transform="translate({dx:.3f} {BASELINE:.3f}) '
                f'scale({scale:.6f} {-scale:.6f})"><path d="{d}"/></g>'
            )

        pen_x += hmtx[name][0]

    advance = pen_x * scale
    return parts, advance


def main():
    font = TTCollection(FONT).fonts[0]  # Regular
    parts, advance = build_path(font)

    src = open("assets/logo.svg", encoding="utf-8").read()
    if "<text" not in src:
        sys.exit("error: assets/logo.svg has no <text> element; already outlined?")

    # Shear about the baseline, matching the browser's synthetic oblique.
    shear = (
        f'transform="translate({X} {BASELINE}) '
        f'skewX({-OBLIQUE:g}) translate({-X} {-BASELINE})"'
    )
    group = f'  <g fill="#050505" {shear}>\n    ' + "\n    ".join(parts) + "\n  </g>\n"
    out = re.sub(r"[ \t]*<text\b.*?</text>\s*\n", group, src, flags=re.S)
    if out == src:
        sys.exit("error: could not replace the <text> element")

    # The shipped viewBox was "24 0 360 96", which cropped 21 units off the left
    # loop and 2.8 off the bottom while leaving ~55 units of empty space on the
    # right. Content measures x 3..329.3, y 2.3..98.8; this fits it with margin.
    out = out.replace('viewBox="24 0 360 96"', 'viewBox="0 0 334 102"')

    open("assets/logo.svg", "w", encoding="utf-8").write(out)
    print(
        f"outlined {len(parts)} glyphs; advance {advance:.2f}px; "
        f"right edge {X + advance:.2f}"
    )


if __name__ == "__main__":
    main()
