'use strict';
const $ = id => document.getElementById(id);
const KEY = 'sorok-practice-v1';
let data = [], current = 1, revealed = 0, step = 1, scale = 1, mode = 'practice';
let pendingRows = [], layoutFrame = 0, toastTimer, sidebarTimer, lastFocus;
let sidebarOpen = false;
let saved = { last: 1, done: [], days: {}, step: 1, scale: 1 };
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  if (raw && typeof raw === 'object') {
    saved.last = Number.isInteger(raw.last) && raw.last >= 1 && raw.last <= 40 ? raw.last : 1;
    saved.done = Array.isArray(raw.done) ? [...new Set(raw.done.filter(validId))] : [];
    saved.days = raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days) ? raw.days : {};
    saved.step = raw.step === 2 ? 2 : 1;
    saved.scale = Number.isFinite(raw.scale) ? Math.max(.85, Math.min(1.5, raw.scale)) : 1;
  }
} catch { /* Storage is optional. */ }
step = saved.step; scale = saved.scale;
function validId(n) { return Number.isInteger(n) && n >= 1 && n <= 40; }
function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function persist() {
  saved.last = current; saved.step = step; saved.scale = scale;
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Also works without storage. */ }
}
function notify(message) {
  $('toast-msg').textContent = message;
  $('toast').classList.remove('opacity-0', 'pointer-events-none');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('opacity-0', 'pointer-events-none'), 2500);
}
function renderList() {
  const q = $('search-input').value.trim().toLocaleLowerCase('ru');
  const items = data.filter(h => `${h.id} ${String(h.id).padStart(2,'0')} ${h.title} ${h.translation}`.toLocaleLowerCase('ru').includes(q));
  const list = $('hadiths-list-container'); list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p'); empty.className = 'p-8 text-center text-sm text-slate-500 font-medium';
    empty.textContent = 'Ничего не найдено'; list.append(empty); return;
  }
  for (const h of items) {
    const item = document.createElement('button'); item.type = 'button'; item.dataset.id = h.id;
    item.className = `sidebar-item p-4 cursor-pointer flex items-center space-x-4 transition border-b border-[#c0a16b]/10 hover:bg-[#fef3c7]/40 ${h.id === current ? 'bg-[#fef3c7]/60 border-l-4 border-l-[#c0a16b]' : ''}`;
    if (h.id === current) item.setAttribute('aria-current','true');
    const num = document.createElement('div'); num.className = 'w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0';
    num.textContent = h.id;
    const body = document.createElement('div'); body.className = 'flex-1 overflow-hidden';
    const title = document.createElement('h4'); title.className = 'font-bold text-[#064e3b] text-[15px] leading-tight mb-0.5';
    title.textContent = h.title + (saved.done.includes(h.id) ? ' ✓' : '');
    const preview = document.createElement('p'); preview.className = 'text-[11px] text-slate-400 truncate';
    const quote = h.translation.indexOf('«');
    const text = quote < 0 ? h.translation : h.translation.slice(quote+1).replace('»','');
    preview.textContent = text.length > 55 ? text.slice(0,55) + '…' : text;
    body.append(title, preview); item.append(num, body);
    item.addEventListener('click', () => { select(h.id); closeSidebar(); }); list.append(item);
  }
}
function renderProgress() {
  const done = Array.isArray(saved.days[dayKey()]) && saved.days[dayKey()].includes(current);
  $('mark-done').setAttribute('aria-pressed', String(done));
  $('done-label').textContent = done ? 'Повторён сегодня · снять' : 'Отметить повторённым';
  const n = Array.isArray(saved.days[dayKey()]) ? new Set(saved.days[dayKey()].filter(validId)).size : 0;
  $('menu-progress').textContent = `Повторено сегодня: ${n} / 40 · Сохраняется на устройстве`;
}
// The reveal boundary is stored in words, never in visual lines. Reflowing or
// changing the font cannot reveal new words or lose an already opened passage.
function wrapWords(words, measure, width) {
  const rows = [];
  let row = [];
  for (const word of words) {
    measure.textContent = [...row, word].join(' ');
    if (row.length && measure.getBoundingClientRect().width > width) {
      rows.push({ text: row.join(' '), words: row.length }); row = [word];
    } else row.push(word);
  }
  if (row.length) rows.push({ text: row.join(' '), words: row.length });
  return rows;
}
function renderArabic() {
  if (!data.length) return;
  const target = $('arabic-text'), text = data[current-1].arabicText;
  target.style.setProperty('--arabic-scale',scale);
  $('practice-tools').hidden = mode !== 'practice';
  if (mode === 'reading') { target.textContent = text; return; }
  const words = text.trim().split(/\s+/u);
  revealed = Math.min(revealed,words.length);
  const measure = document.createElement('span'); measure.className = 'arabic-text arabic-measure';
  measure.dir = 'rtl'; measure.lang = 'ar'; measure.setAttribute('aria-hidden','true');
  // Copy resolved typography so measurement also matches responsive breakpoints.
  const font = getComputedStyle(target);
  for (const prop of ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','wordSpacing','fontKerning','fontFeatureSettings','fontVariationSettings']) measure.style[prop] = font[prop];
  document.body.append(measure);
  const width = Math.max(100,target.clientWidth-1);
  const opened = wrapWords(words.slice(0,revealed),measure,width);
  pendingRows = wrapWords(words.slice(revealed),measure,width); measure.remove();
  const fragment = document.createDocumentFragment();
  for (const line of opened) {
    const p = document.createElement('p'); p.className = 'arabic-row'; p.textContent = line.text; fragment.append(p);
  }
  // One placeholder keeps the next-step control near the recalled passage.
  for (let i=0;i<Math.min(1,pendingRows.length);i++) {
    const row = document.createElement('div'); row.className = 'arabic-placeholder'; row.setAttribute('aria-label',`Строка ${opened.length+i+1} скрыта`);
    for (const w of [[20,12,24,17],[14,25,12,20],[22,15,18,14]][i]) {
      const s = document.createElement('span'); s.style.width = `${w}%`; s.setAttribute('aria-hidden','true'); row.append(s);
    }
    fragment.append(row);
  }
  if (pendingRows.length>1) {
    const more = document.createElement('div'); more.className = 'hidden-more'; more.lang = 'ru'; more.dir = 'ltr';
    more.textContent = `Ещё скрыто строк: ${pendingRows.length-1}`; fragment.append(more);
  }
  target.replaceChildren(fragment);
  const total = opened.length+pendingRows.length;
  $('reveal-status').textContent = `Открыто строк: ${opened.length} / ${total}`;
  $('reading-bar').style.width = `${revealed/words.length*100}%`;
  $('memory-hint').hidden = pendingRows.length === 0;
  $('reveal').disabled = pendingRows.length === 0;
  $('reveal').textContent = pendingRows.length === 0 ? 'Весь хадис открыт ✓' : step === 2 && pendingRows.length > 1 ? 'Открыть 2 строки ←' : 'Открыть строку ←';
  $('show-all').disabled = pendingRows.length === 0; $('restart').disabled = revealed === 0;
  for (const [id,active] of [['step-one',step===1],['step-two',step===2]]) $(id).setAttribute('aria-pressed',String(active));
  $('smaller').disabled = scale <= .85; $('larger').disabled = scale >= 1.5;
}
function scheduleLayout() {
  cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(renderArabic);
}
function setMode(next) {
  mode = next;
  for (const id of ['practice','reading']) {
    $(id+'-tab').setAttribute('aria-selected',String(id===mode)); $(id+'-tab').tabIndex = id===mode ? 0 : -1;
  }
  $('arabic-area').setAttribute('aria-labelledby',mode+'-tab'); renderArabic();
}
function setTranslation(open) {
  $('toggle-translation').setAttribute('aria-expanded',String(open)); $('translation-panel').hidden = !open;
  $('translation-action').textContent = open ? 'Скрыть ⌃' : 'Показать ⌄';
}
function select(id, updateHash = true) {
  if (!data.length) return;
  current = Math.max(1,Math.min(40,id)); revealed = 0;
  const h = data[current-1];
  $('hadith-num').textContent = current; $('counter').textContent = `${current} / 40`;
  $('russian-text').textContent = h.translation;
  $('arabic-source').href = `assets/arabic-original.pdf#page=${h.arabicPage}`;
  $('translation-source').href = `assets/russian-translation.pdf#page=${h.translationPage}`;
  $('prev-btn').disabled = current === 1; $('next-btn').disabled = current === 40;
  $('mark-done').disabled = false;
  document.title = `${current}. ${h.title} — 40 Хадисов`;
  setTranslation(false); renderArabic(); renderList(); renderProgress(); persist();
  document.querySelector('main').scrollTop = 0;
  if (updateHash) history.replaceState(null,'',`#${current}`);
  const card = $('card-container'); card.classList.remove('fade-in'); void card.offsetWidth; card.classList.add('fade-in');
}
function openSidebar() {
  clearTimeout(sidebarTimer); sidebarOpen = true; lastFocus = document.activeElement;
  const el = $('sidebar'); el.classList.remove('hidden','pointer-events-none'); el.setAttribute('aria-hidden','false');
  $('open-menu').setAttribute('aria-expanded','true'); $('search-input').value = ''; renderList();
  requestAnimationFrame(() => { if(sidebarOpen) {el.classList.remove('opacity-0');$('sidebar-content').classList.remove('-translate-x-full');} });
  $('close-menu').focus();
}
function closeSidebar() {
  clearTimeout(sidebarTimer); sidebarOpen = false; $('sidebar').classList.add('opacity-0','pointer-events-none');
  $('sidebar-content').classList.add('-translate-x-full'); $('sidebar').setAttribute('aria-hidden','true'); $('open-menu').setAttribute('aria-expanded','false');
  sidebarTimer = setTimeout(() => { if(!sidebarOpen) $('sidebar').classList.add('hidden'); },300);
  (lastFocus || $('open-menu')).focus();
}
$('open-menu').addEventListener('click',openSidebar); $('close-menu').addEventListener('click',closeSidebar);
$('sidebar').addEventListener('click',e=>{if(e.target===$('sidebar'))closeSidebar();});
$('search-input').addEventListener('input',renderList);
$('practice-tab').addEventListener('click',()=>setMode('practice')); $('reading-tab').addEventListener('click',()=>setMode('reading'));
for (const id of ['practice','reading']) $(id+'-tab').addEventListener('keydown',e=>{
  if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {e.preventDefault();const next=e.key==='Home'?'practice':e.key==='End'?'reading':mode==='practice'?'reading':'practice';setMode(next);$(next+'-tab').focus();}
});
$('toggle-translation').addEventListener('click',()=>setTranslation($('translation-panel').hidden));
$('reveal').addEventListener('click',()=>{if(!data.length)return;revealed+=pendingRows.slice(0,step).reduce((n,row)=>n+row.words,0);renderArabic();$('reveal').scrollIntoView({block:'nearest',behavior:'auto'});});
$('show-all').addEventListener('click',()=>{if(!data.length)return;revealed=data[current-1].arabicText.trim().split(/\s+/u).length;renderArabic();});
$('restart').addEventListener('click',()=>{revealed=0;renderArabic();document.querySelector('main').scrollTop=0;notify('Текст скрыт. Вспомните хадис заново.');});
$('step-one').addEventListener('click',()=>{step=1;renderArabic();persist();}); $('step-two').addEventListener('click',()=>{step=2;renderArabic();persist();});
$('smaller').addEventListener('click',()=>{scale=Math.max(.85,+(scale-.1).toFixed(2));renderArabic();persist();});
$('larger').addEventListener('click',()=>{scale=Math.min(1.5,+(scale+.1).toFixed(2));renderArabic();persist();});
$('prev-btn').addEventListener('click',()=>{if(current>1)select(current-1);}); $('next-btn').addEventListener('click',()=>{if(current<40)select(current+1);});
$('mark-done').addEventListener('click',()=>{
  const day=dayKey(), ids=Array.isArray(saved.days[day])?saved.days[day].filter(validId):[],done=ids.includes(current);
  saved.days[day]=done?ids.filter(n=>n!==current):[...new Set([...ids,current])];
  if(done){if(!Object.values(saved.days).some(a=>Array.isArray(a)&&a.includes(current)))saved.done=saved.done.filter(n=>n!==current);}
  else if(!saved.done.includes(current))saved.done.push(current);
  renderProgress();renderList();persist();notify(done?'Отметка снята':'Хадис отмечен как повторённый');
});
$('copy-hadith').addEventListener('click',async()=>{
  if(!data.length)return;
  const h=data[current-1],text=`Хадис №${h.id}\n\n${h.arabicText}\n\nПеревод Абу Аделя:\n${h.translation}`;
  try {
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;top:0;left:-10000px';document.body.append(area);area.select();
      const copied=document.execCommand('copy');area.remove();$('copy-hadith').focus();if(!copied)throw Error('copy');
    }
    notify('Хадис скопирован полностью');
  }catch{notify('Не удалось скопировать. Выделите текст вручную.');}
});
window.addEventListener('hashchange',()=>{const n=Number(location.hash.slice(1));if(validId(n))select(n,false);});
document.addEventListener('keydown',e=>{
  if(sidebarOpen){
    if(e.key==='Escape'){e.preventDefault();closeSidebar();}
    if(e.key==='Tab') {const els=[...$('sidebar-content').querySelectorAll('button,input,a')].filter(el=>el.offsetParent!==null);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}}
    return;
  }
  if(['INPUT','TEXTAREA','BUTTON','A'].includes(e.target.tagName))return;
  if(e.code==='Space'&&mode==='practice'&&!$('reveal').disabled){e.preventDefault();$('reveal').click();}
  if(e.key==='ArrowRight'&&current<40)select(current+1);
  if(e.key==='ArrowLeft'&&current>1)select(current-1);
});
let touchStart;
const main=document.querySelector('main');
main.addEventListener('touchstart',e=>{touchStart={x:e.changedTouches[0].screenX,y:e.changedTouches[0].screenY};},{passive:true});
main.addEventListener('touchend',e=>{
  if(!touchStart||sidebarOpen||document.getSelection()?.toString())return;
  const dx=e.changedTouches[0].screenX-touchStart.x,dy=e.changedTouches[0].screenY-touchStart.y;touchStart=null;
  if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5){if(dx<0&&current<40)select(current+1);if(dx>0&&current>1)select(current-1);}
},{passive:true});
const progress=document.createElement('p');progress.id='menu-progress';progress.className='menu-progress';$('sidebar-content').append(progress);
const random=document.createElement('button');random.type='button';random.id='random';random.className='menu-random';random.textContent='Случайный хадис ↗';
random.addEventListener('click',()=>{if(!data.length)return;let id=1+Math.floor(Math.random()*39);if(id>=current)id++;select(id);closeSidebar();});
$('sidebar-content').insertBefore(random,progress);
fetch('assets/hadiths.json?v=reference-arabic-2').then(r=>{if(!r.ok)throw Error('load');return r.json();}).then(items=>{
  if(!Array.isArray(items)||items.length!==40||items.some((h,i)=>h.id!==i+1||typeof h.arabicText!=='string'||!h.arabicText.trim()))throw Error('library');
  data=items;const id=Number(location.hash.slice(1));select(validId(id)?id:saved.last);$('card-container').setAttribute('aria-busy','false');document.fonts.ready.then(scheduleLayout);
}).catch(()=>{
  $('card-container').setAttribute('aria-busy','false');$('arabic-text').replaceChildren();
  const p=document.createElement('p');p.className='loading-text';p.lang='ru';p.dir='ltr';p.textContent='Не удалось загрузить хадисы. Обновите страницу или откройте оригинал книги по ссылке ниже.';$('arabic-text').append(p);
});
let previousWidth=0;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-previousWidth)>.5){previousWidth=width;scheduleLayout();}}).observe($('arabic-text'));
document.fonts.addEventListener('loadingdone',scheduleLayout);
