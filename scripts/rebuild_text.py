"""Build deployable Arabic text from the reviewed transcription, never from OCR.

Edit content/arabic-transcription.json, compare changes against the linked PDF,
then run this command. It is safe to rerun: the reviewed file is independent of
runtime data and no image/source field is used to infer text boundaries.
"""
from __future__ import annotations
import argparse
import json
import re
import unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def validate(records):
    if [h['id'] for h in records] != list(range(1,41)):
        raise ValueError('Expected exactly 40 ordered cards')
    for card in records:
        text=card['text']
        if not isinstance(text,str) or len(text)<150 or len(text.split())<15:
            raise ValueError(f'Card {card["id"]}: missing Arabic text')
        if re.search(r'<\/?\w|⦗|⦘|�',text):
            raise ValueError(f'Card {card["id"]}: markup or extraction artifact')
        if not any('\u064b'<=c<='\u0652' for c in text):
            raise ValueError(f'Card {card["id"]}: missing vocalization')
        if text.rstrip().endswith((':','،','؛')):
            raise ValueError(f'Card {card["id"]}: unfinished boundary')
        if unicodedata.normalize('NFC',text)!=text:
            raise ValueError(f'Card {card["id"]}: not normalized')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=ROOT/'content/arabic-transcription.json')
    p.add_argument('--cards',type=Path,default=ROOT/'dist/assets/hadiths.json')
    args=p.parse_args()
    source=json.loads(args.source.read_text());validate(source)
    cards=json.loads(args.cards.read_text())
    if [h['id'] for h in cards]!=list(range(1,41)):
        raise ValueError('Runtime card order is invalid')
    for card,review in zip(cards,source):
        card['arabicText']=review['text']
        card['arabicReports']=review['reports']
        card.pop('arabic',None)
        card.pop('lines',None)
    args.cards.write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
    print(f'Built {len(cards)} cards, {sum(len(h["arabicText"].split()) for h in cards)} Arabic words')
if __name__=='__main__': main()
