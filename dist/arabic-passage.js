'use strict';
// Clip highlights to the visible source passage. No HTML is embedded in data,
// and no hidden words enter the document when only a line has been revealed.
function arabicPassageParts(text, start, end, ranges) {
  const parts = [];
  let cursor = start;
  for (const range of ranges || []) {
    const lo = Math.max(start, range.start), hi = Math.min(end, range.end);
    if (lo >= hi) continue;
    if (cursor < lo) parts.push({text:text.slice(cursor,lo),speech:false});
    parts.push({text:text.slice(lo,hi),speech:true}); cursor = hi;
  }
  if (cursor < end) parts.push({text:text.slice(cursor,end),speech:false});
  return parts;
}
if (typeof module !== 'undefined') module.exports = { arabicPassageParts };
