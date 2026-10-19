"""Build Arabic text verbatim from the user-selected reference website.

The former full PDF transcription is retained under content/ for history; it
is not the active source. Reimport the retained reference HTML with
import_reference_arabic.py before running this builder after a source update.
"""
import argparse
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def validate(records):
    if [h['id'] for h in records] != list(range(1,41)):
        raise ValueError('Expected exactly 40 ordered cards')
    for card in records:
        text=card['text']
        if not isinstance(text,str) or not text.strip() or not re.search('[\u0621-\u064A]',text):
            raise ValueError(f'Card {card["id"]}: missing Arabic text')
        if re.search(r'<\/?\w|⦗|⦘|�',text):
            raise ValueError(f'Card {card["id"]}: markup or extraction artifact')
        # The selected reference contains intentional ellipses and unnormalized
        # diacritics. Do not enforce PDF length/completeness or normalize text.

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=ROOT/'content/arabic-reference.json')
    p.add_argument('--cards',type=Path,default=ROOT/'dist/assets/hadiths.json')
    args=p.parse_args()
    reference=json.loads(args.source.read_text());source=reference['cards'];validate(source)
    cards=json.loads(args.cards.read_text())
    if [h['id'] for h in cards]!=list(range(1,41)):
        raise ValueError('Runtime card order is invalid')
    for card,review in zip(cards,source):
        card['arabicText']=review['text']
        card['arabicTextSource']=reference['repository']
        for old in ['arabic','lines','arabicReports']:card.pop(old,None)
    args.cards.write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
    print(f'Built {len(cards)} reference cards, {sum(len(h["arabicText"].split()) for h in cards)} Arabic words')
if __name__=='__main__':main()
