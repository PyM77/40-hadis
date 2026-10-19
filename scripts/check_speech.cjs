'use strict';
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {arabicPassageParts} = require('../dist/arabic-passage.js');
const cards = JSON.parse(readFileSync(join(__dirname,'../dist/assets/hadiths.json'),'utf8'));
for (const card of cards) {
  const text=card.arabicText,ranges=card.arabicSpeechRanges;
  const full=arabicPassageParts(text,0,text.length,ranges);
  assert.equal(full.map(p=>p.text).join(''),text,`Card ${card.id}: full text changed`);
  assert.ok(!full[0].speech,`Card ${card.id}: narrator prefix became red`);
  assert.equal(full.filter(p=>p.speech).map(p=>p.text).join(''),ranges.map(r=>text.slice(r.start,r.end)).join(''));
  const words=[...text.matchAll(/\S+/gu)];
  // Simulate narrow/wide lines and partial reveals around every speech boundary.
  // A red span must be clipped to the visible words, never expose a hidden tail.
  for (const count of [1,2,5,11]) {
    for (let i=0;i<words.length;i+=count) {
      const start=words[i].index,last=words[Math.min(words.length-1,i+count-1)],end=last.index+last[0].length;
      const parts=arabicPassageParts(text,start,end,ranges);
      assert.equal(parts.map(p=>p.text).join(''),text.slice(start,end),`Card ${card.id}: revealed text changed`);
      let cursor=start;
      for (const part of parts) {
        for (let p=cursor;p<cursor+part.text.length;p++) {
          assert.equal(part.speech,ranges.some(r=>r.start<=p&&p<r.end),`Card ${card.id}: misplaced color at ${p}`);
        }
        cursor+=part.text.length;
      }
    }
  }
}
const first=cards[0],s=first.arabicSpeechRanges[0].start;
assert.ok(first.arabicText.slice(s).startsWith('مَنْ يُرِدِ'));
assert.equal(arabicPassageParts(first.arabicText,0,s,first.arabicSpeechRanges).some(p=>p.speech),false);
assert.ok(cards[4].arabicSpeechRanges.length>1,'Dialogue needs separate speech passages');
console.log('Validated speech colors and hidden-text boundaries for all 40 cards');
