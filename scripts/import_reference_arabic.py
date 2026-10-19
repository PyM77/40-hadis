"""Import literal Arabic strings from the retained, user-selected reference HTML.

Only JSON string literals are parsed; none of the reference JavaScript runs.
Spelling, punctuation, ellipses, diacritic order, and spaces are kept verbatim.
"""
import hashlib
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REFERENCE=ROOT/'content/reference/index.html'
COMMIT='e76f0e20dbce09a7e6fdbb85cff5cc8fd221ea4c'

def extract_arabic(html):
    body=html.split('const hadiths = [',1)[1].split('let currentIndex',1)[0]
    matches=list(re.finditer(r'\bid:\s*(\d+)\s*,\s*title:\s*"(?:[^"\\]|\\.)*"\s*,\s*arabic:\s*',body))
    decoder=json.JSONDecoder()
    cards=[]
    for match in matches:
        text,_=decoder.raw_decode(body[match.end():].lstrip())
        if not isinstance(text,str):raise ValueError('Arabic must be a string')
        cards.append({'id':int(match[1]),'text':text})
    if [c['id'] for c in cards]!=list(range(1,41)):raise ValueError('Expected 40 ordered reference cards')
    return cards

def main():
    raw=REFERENCE.read_bytes()
    source={'repository':'https://github.com/cevekanovshoma-lab/40-hadiths-ajurri','commit':COMMIT,'htmlSha256':hashlib.sha256(raw).hexdigest(),'cards':extract_arabic(raw.decode())}
    (ROOT/'content/arabic-reference.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
    print(f'Imported {len(source["cards"])} exact Arabic strings from reference {COMMIT[:8]}')
if __name__=='__main__':main()
