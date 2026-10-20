"""
Rebuilds public/fonts/material-icons-subset.woff2 with only the icons the code uses.

The full Material Icons font (assets/fonts/material-icons-full.woff2) is 128 KB; the site uses a
few hundred of its 2,000+ icons, so the subset is ~14 KB and loads almost instantly on slow
connections. Run after adding a new icon name:  npm run icons:subset
(needs: python -m pip install --user fonttools brotli)

Any quoted lowercase word in app/, components/ or lib/ that is also an icon name is kept, so icon
names held in variables and config are covered too.
"""
import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

SOURCE = 'assets/fonts/material-icons-full.woff2'
OUTPUT = 'public/fonts/material-icons-subset.woff2'


def ligatures(font):
    """Yields (icon name, ligature glyph, component glyphs) for every icon in the font."""
    g2c = {g: chr(c) for c, g in font.getBestCmap().items()}
    for lookup in font['GSUB'].table.LookupList.Lookup:
        for table in lookup.SubTable:
            table = getattr(table, 'ExtSubTable', table)
            for first, ligs in getattr(table, 'ligatures', {}).items():
                for lig in ligs:
                    parts = [first] + lig.Component
                    name = ''.join(g2c.get(g, '?') for g in parts)
                    if '?' not in name:
                        yield name, lig.LigGlyph, parts


def used_words():
    words = set()
    for root in ('app', 'components', 'lib'):
        for path in pathlib.Path(root).rglob('*'):
            if path.suffix in ('.ts', '.tsx') and path.is_file():
                text = path.read_text(encoding='utf-8', errors='ignore')
                words |= set(re.findall(r"""['"`>{\s]([a-z][a-z0-9_]{1,40})['"`<}\s]""", text))
    return words


def main():
    font = TTFont(SOURCE)
    words = used_words()
    glyphs, kept = set(), set()
    for name, lig_glyph, parts in ligatures(font):
        if name in words:
            kept.add(name)
            glyphs.add(lig_glyph)
            glyphs.update(parts)

    options = subset.Options()
    options.layout_closure = False  # keep only the listed ligatures, not every word the letters spell
    options.layout_features = ['*']
    options.flavor = 'woff2'
    options.notdef_outline = True
    options.name_IDs = ['*']
    subsetter = subset.Subsetter(options)
    subsetter.populate(glyphs=sorted(glyphs))
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(OUTPUT)
    size = pathlib.Path(OUTPUT).stat().st_size
    print(f'{len(kept)} icons kept -> {OUTPUT} ({size / 1024:.1f} KB)', file=sys.stderr)


if __name__ == '__main__':
    main()
