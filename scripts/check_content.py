"""Validate complete card boundaries and synchronization before publication."""
import json
import re
import unicodedata
from pathlib import Path
from rebuild_text import validate

ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'content/arabic-transcription.json').read_text())
cards=json.loads((ROOT/'dist/assets/hadiths.json').read_text())
validate(source)
assert [c['id'] for c in cards]==list(range(1,41)), 'Expected all 40 cards'
for c,s in zip(cards,source):
    assert c['arabicText']==s['text'], f'Card {c["id"]}: regenerate deployable text'
    assert c['arabicReports']==s['reports']
    assert c['arabicPage']==s['arabicPage']
    assert len(c['translation'])>50
    assert 'lines' not in c, 'Practice must use native text'
    assert '[[' not in c['arabicText'] and ']]' not in c['arabicText']

def plain(s):
    return re.sub(r'[^\u0621-\u063A\u0641-\u064A\s]','',re.sub('[\u064B-\u065F\u0670]','',unicodedata.normalize('NFKD',s))).split()
def has(i,phrase):
    assert ' '.join(plain(phrase)) in ' '.join(plain(cards[i-1]['arabicText'])), f'Card {i}: missing checked passage'

# Regression guards for truncation, wrong report selection, and omitted scenes
# encountered in the abandoned OCR boundary draft and alternate digital edition.
has(1,'خيرا يفقهه في الدين')
has(2,'ولا خير في سائر الناس بعد')
assert cards[13]['arabicReports']==[15], 'Card 14 is the ablution report only'
has(14,'هذا وضوئي ووضوء الأنبياء قبلي')
has(26,'في كل خمسين حقة')
has(26,'ولم يذكر الزهري البقر')
has(36,'أخذ رسول الله ﷺ بيدي فانطلق بي إلى النخل')
has(40,'إن للمسجد تحية وإن تحيته ركعتان')
has(40,'فأي المؤمنين أسلم قال من سلم الناس')
has(40,'ولا حسب كحسن الخلق')
assert len(cards[25]['arabicText'].split())>220, 'Livestock report was truncated'
print('Validated all 40 native-text cards and critical report boundaries')
