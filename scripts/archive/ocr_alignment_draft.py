"""Replace the Arabic line facsimiles with real vocalised text.

The supplied Arabic PDF is a pure scan: all 39 pages together yield two
non-whitespace characters, so there is nothing to extract from it.  Instead the
fully vocalised text of the same work is taken from the Shamela digital edition
(al-Ajurri died in 360 AH, so the text itself is long out of copyright) and
anchored to our own edition with Tesseract OCR of the existing line images.

OCR is used only as an *anchor*, never as output: every character that ends up
on the site comes from the Shamela text.  The OCR tells us which stretch of that
text our printed edition actually carries, because the two editions differ --
ours abbreviates the isnads (ثنا for حدثنا) and drops much of the author's
commentary.

Run with the line images and tmp/ocr/*.txt already in place:

    python scripts/rebuild_text.py --shamela tmp/shamela.json --ocr tmp/ocr
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HARAKAT = set('ًٌٍَُِّْٰـ')
ARABIC_WORD = re.compile(r'[ء-ي]+')
# Stretches of text our edition does not carry show up as alignment gaps.
GAP_WORDS = 25
# Reveal chunks aim for roughly one printed line of Arabic.
CHUNK_WORDS = 11


def fold(text: str) -> str:
    """Collapse spelling variants so the two editions compare equal."""
    text = unicodedata.normalize('NFC', text)
    text = ''.join(c for c in text if c not in HARAKAT and not unicodedata.combining(c))
    for a, b in (('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'),
                 ('ى', 'ي'), ('ة', 'ه'),
                 ('ؤ', 'و'), ('ئ', 'ي')):
        text = text.replace(a, b)
    return text


def words(text: str) -> list[str]:
    return ARABIC_WORD.findall(fold(text))


def load_shamela(path: Path) -> str:
    """Flatten the scraped pages and drop the author's preface."""
    pages = json.loads(path.read_text(encoding='utf-8'))
    full = '\n'.join(pages[k]['text'] for k in sorted(pages, key=int))
    full = re.sub(r'⦗[^⦘]*⦘', ' ', full)   # printed page markers
    start = re.search(r'(?m)^\s*١\s*-\s*', full)     # report ١ -
    return full[start.end():]


def tokenise(body: str) -> list[tuple[str, int, int]]:
    """Arabic-bearing tokens of the source text, with their character spans."""
    out = []
    for m in re.finditer(r'\S+', body):
        folded = ARABIC_WORD.findall(fold(m.group(0)))
        if folded:
            out.append((''.join(folded), m.start(), m.end()))
    return out


def ocr_stream(cards: list[dict], ocr_dir: Path) -> tuple[list[str], list[tuple[int, int]]]:
    """Every OCR word in reading order, tagged with the card and line it came from."""
    stream, owner = [], []
    for card in cards:
        for index, line in enumerate(card['lines']):
            stem = Path(line['src']).stem
            text = (ocr_dir / f'{stem}.txt').read_text(encoding='utf-8', errors='replace')
            for word in words(text):
                stream.append(word)
                owner.append((card['id'], index))
    return stream, owner


def align(stream: list[str], source: list[str]) -> dict[int, int]:
    """Map OCR word positions onto source word positions, monotonically."""
    matcher = SequenceMatcher(None, stream, source, autojunk=False)
    mapping = {}
    for block in matcher.get_matching_blocks():
        if block.size >= 2:
            for k in range(block.size):
                mapping[block.a + k] = block.b + k
    return mapping


def snap(anchors: list[int], starts: list[int], commentary: dict[int, int],
         total: int) -> list[tuple[int, int]]:
    """Turn a card's anchors into whole-report spans, minus what it omits.

    OCR is too rough to place the first and last word of a card, but it is more
    than good enough to say *which numbered reports* the card covers.  So take
    each covered report from its own first word, and end it where the author's
    commentary begins -- that is where our edition's hadith text stops.  Cards
    that do carry a gloss anchor past that point and keep it; unanchored holes
    in between are cut back out.
    """
    bounds = starts + [total]
    covered = sorted({
        max(i for i, s in enumerate(starts) if s <= position) for position in anchors
    })
    spans = []
    for report in covered:
        lo, end = bounds[report], bounds[report + 1] - 1
        inside = [p for p in anchors if lo <= p <= end]
        opens = commentary.get(report, end + 1)
        # Stop at the commentary unless the card is anchored inside it.
        hi = max(inside) if max(inside) >= opens else min(opens - 1, end)
        start = lo
        for left, right in zip(inside, inside[1:]):
            if right - left > GAP_WORDS and right <= hi:
                spans.append((start, left))
                start = right
        spans.append((start, max(hi, start)))
    return spans


BREAK_AFTER = ('،', '؛', '.', ':', '»', '"', '}', '؟', '!')


def chunk(body: str, tokens: list[tuple[str, int, int]], lo: int, hi: int) -> list[str]:
    """Cut a span into reveal-sized pieces, preferring sentence punctuation.

    The pieces are contiguous slices of the source, so joining them back up
    reproduces the span character for character.
    """
    cuts, start = [], lo
    while start <= hi:
        limit = min(start + CHUNK_WORDS - 1, hi)
        if limit < hi:
            for index in range(limit, max(start, limit - 5) - 1, -1):
                if body[tokens[index][1]:tokens[index][2]].rstrip().endswith(BREAK_AFTER):
                    limit = index
                    break
        cuts.append((start, limit))
        start = limit + 1
    return [re.sub(r'\s+', ' ', body[tokens[a][1]:tokens[b][2]]).strip() for a, b in cuts]


def close_sentence(body: str, tokens: list[tuple[str, int, int]],
                   lo: int, hi: int) -> tuple[int, int]:
    """Run a span's end on to the next sentence break, so it never stops mid-phrase."""
    limit = min(len(tokens) - 1, hi + 25)
    for position in range(hi, limit + 1):
        hi = position
        if body[tokens[position][1]:tokens[position][2]].rstrip().endswith(BREAK_AFTER):
            break
    return lo, hi


def merge(spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Join spans that snapping grew into each other, and drop stubs."""
    out: list[tuple[int, int]] = []
    for lo, hi in spans:
        if out and lo <= out[-1][1] + 1:
            out[-1] = (out[-1][0], max(out[-1][1], hi))
        else:
            out.append((lo, hi))
    return [(lo, hi) for lo, hi in out if hi - lo >= 2] or out


def cut_dangling(body: str, tokens: list[tuple[str, int, int]],
                 lo: int, hi: int) -> tuple[int, int]:
    """Drop a trailing fragment that only opens something the card never carries.

    Snapping to the next sentence break can pull in the first words of the
    author's commentary (`قال محمد بن الحسين:`) or of the following report's
    isnad.  Walk back over any such opener so the card ends on its own text.
    """
    # Strip trailing words while they are only opening something else: the
    # author's commentary, or the isnad of the report that follows.
    opener = re.compile(
        r'(قال\s+محمد(\s+بن\s+الحسين)?'
        r'|[٠-٩]+\s*-\s*(و?حدثنا|و?اخبرنا)(\s+\S+){0,10}'
        r'|^(و?حدثنا|و?اخبرنا)(\s+\S+){0,10})\s*:\s*$')
    while hi > lo:
        tail = fold(body[tokens[max(lo, hi - 11)][1]:tokens[hi][2]]).strip()
        if not tail.endswith(':') or not opener.search(tail):
            break
        hi -= 1
        while hi > lo and not body[tokens[hi][1]:tokens[hi][2]].rstrip().endswith(BREAK_AFTER):
            hi -= 1
    return lo, hi


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--shamela', type=Path, default=ROOT.parent / 'tmp/shamela.json')
    parser.add_argument('--ocr', type=Path, default=ROOT.parent / 'tmp/ocr')
    parser.add_argument('--cards', type=Path, default=ROOT / 'dist/assets/hadiths.json')
    args = parser.parse_args()

    body = load_shamela(args.shamela)
    tokens = tokenise(body)
    source = [t[0] for t in tokens]

    # Word index of each numbered report, so a card can start on a whole isnad.
    # Report ١ opens the body, its marker having been consumed by load_shamela.
    report_starts = sorted({0} | {
        next((i for i, t in enumerate(tokens) if t[1] >= m.end()), 0)
        for m in re.finditer(r'(?m)^\s*[٠-٩]+\s*-\s*', body)
    })

    # Where the author starts explaining, per report: our edition ends there.
    commentary = {}
    bounds = report_starts + [len(tokens)]
    for index, start in enumerate(report_starts):
        end = bounds[index + 1]
        for position in range(start, end - 1):
            if (tokens[position][0], tokens[position + 1][0]) == ('قال', 'محمد'):
                commentary[index] = position
                break

    cards = json.loads(args.cards.read_text(encoding='utf-8'))
    stream, owner = ocr_stream(cards, args.ocr)
    mapping = align(stream, source)

    anchors: dict[int, list[int]] = {}
    for position, (card_id, _line) in enumerate(owner):
        if position in mapping:
            anchors.setdefault(card_id, []).append(mapping[position])

    report = []
    for card in cards:
        found = sorted(set(anchors[card['id']]))
        spans = snap(found, report_starts, commentary, len(tokens))
        spans = [close_sentence(body, tokens, lo, hi) for lo, hi in spans]
        spans = merge(spans)
        spans = [cut_dangling(body, tokens, lo, hi) for lo, hi in spans]
        pieces = []
        for lo, hi in spans:
            pieces.extend(chunk(body, tokens, lo, hi))
        card['arabic'] = pieces
        card['arabicText'] = ' '.join(pieces)
        card.pop('lines', None)
        report.append((card['id'], len(pieces), len(words(card['arabicText']))))

    args.cards.write_text(
        json.dumps(cards, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for card_id, pieces, count in report:
        print(f'card {card_id:>3}: {pieces:>3} chunks, {count:>4} words')
    print(f'total words: {sum(r[2] for r in report)}')


if __name__ == '__main__':
    main()
