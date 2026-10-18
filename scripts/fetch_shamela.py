"""Scrape the vocalised Arabic text of al-Ajurri's Forty Hadith from Shamela.

Fetches the book body (the <div class="nass"> of each page) as an auxiliary
reference. This edition differs from the supplied PDF: its output must never
replace the reviewed text or be passed directly to the production builder.

    python scripts/fetch_shamela.py --out tmp/shamela.json
"""
from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.request
from pathlib import Path

BOOK = 8204
PAGES = 52
URL = 'https://shamela.ws/book/{book}/{page}'
AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'


def fetch(page: int, cache: Path) -> str:
    target = cache / f'{page}.html'
    if not target.exists() or not target.stat().st_size:
        request = urllib.request.Request(
            URL.format(book=BOOK, page=page), headers={'User-Agent': AGENT})
        with urllib.request.urlopen(request, timeout=30) as response:
            target.write_bytes(response.read())
        time.sleep(0.4)
    return target.read_text(encoding='utf-8', errors='replace')


def body_of(raw: str) -> tuple[str | None, str]:
    """Pull the book-text div out of a page, with its printed page number."""
    marker = raw.find('class="nass')
    if marker < 0:
        return None, ''
    start = raw.rfind('<div', 0, marker)
    number = re.search(r'data-page-num="(\d+)"', raw[marker:marker + 200])

    depth, end = 0, len(raw)
    for match in re.finditer(r'<(/?)div\b', raw[start:]):
        depth += -1 if match.group(1) else 1
        if depth == 0:
            end = start + match.start()      # stop *before* the closing tag
            break

    text = raw[start:end]
    text = re.sub(r'<br\s*/?>|</p>', '\n', text)
    text = re.sub(r'<[^>]*>', '', text)       # drop every tag
    text = re.sub(r'</?\w+[^<>]*$', '', text)  # and any truncated one
    text = html.unescape(text)
    text = re.sub(r'[ \t ]+', ' ', text)
    text = '\n'.join(line.strip() for line in text.split('\n'))
    return (number.group(1) if number else None), re.sub(r'\n{3,}', '\n\n', text).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--cache', type=Path, default=Path('tmp/sh'))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    pages = {}
    for page in range(1, PAGES + 1):
        number, text = body_of(fetch(page, args.cache))
        if not text:
            raise SystemExit(f'page {page}: no book text found')
        pages[str(page)] = {'booknum': number, 'text': text}

    leaks = sum(len(re.findall(r'[<>]', p['text'])) for p in pages.values())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding='utf-8')
    total = sum(len(p['text']) for p in pages.values())
    print(f'{len(pages)} pages, {total} chars, {leaks} markup leaks')


if __name__ == '__main__':
    main()
