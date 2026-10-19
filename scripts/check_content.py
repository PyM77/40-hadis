"""Require exact reference-site Arabic strings in every deployed card."""
import hashlib
import json
from pathlib import Path
from rebuild_text import validate
from import_reference_arabic import extract_arabic
ROOT=Path(__file__).resolve().parents[1]
reference=json.loads((ROOT/'content/arabic-reference.json').read_text())
raw=(ROOT/'content/reference/index.html').read_bytes()
assert hashlib.sha256(raw).hexdigest()==reference['htmlSha256'],'Reference snapshot changed; reimport it'
source=extract_arabic(raw.decode())
assert source==reference['cards'],'Imported strings differ from reference HTML'
validate(source)
cards=json.loads((ROOT/'dist/assets/hadiths.json').read_text())
assert [c['id'] for c in cards]==list(range(1,41)),'Expected all 40 cards'
for card,ref in zip(cards,source):
    assert card['arabicText']==ref['text'],f'Card {card["id"]}: not identical to selected site'
    assert card['arabicTextSource']==reference['repository']
    assert len(card['translation'])>50
    assert 'lines' not in card and 'arabicReports' not in card
# Guard source behavior that differs deliberately from the former PDF edition.
assert source[0]['text'].startswith('عَنْ أَبِي هُرَيْرَةَ')
assert '...' in source[39]['text']
print('Validated all 40 Arabic strings character-for-character against reference HTML')
