'use strict';
const $ = id => document.getElementById(id);
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const KEY = 'sorok-practice-v1';
let data = [], current = 1, revealed = 0, step = 1, scale = 1, mode = 'practice';
let saved = { last: 1, done: [], days: {}, step: 1, scale: 1 };
let toastTimer;
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  if (raw && typeof raw === 'object') {
    saved.last = Number.isInteger(raw.last) && raw.last >= 1 && raw.last <= 40 ? raw.last : 1;
    saved.done = Array.isArray(raw.done) ? [...new Set(raw.done.filter(n => Number.isInteger(n) && n >= 1 && n <= 40))] : [];
    saved.days = raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days) ? raw.days : {};
    saved.step = raw.step === 2 ? 2 : 1;
    saved.scale = Number.isFinite(raw.scale) ? Math.max(.85, Math.min(1.5, raw.scale)) : 1;
  }
} catch { /* Browser storage is optional. */ }
step = saved.step; scale = saved.scale;
function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function persist() {
  saved.last = current; saved.step = step; saved.scale = scale;
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Practice also works in private browsers. */ }
}
function notify(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000);
}
function renderList() {
  const q = $('search').value.trim().toLocaleLowerCase('ru');
  const items = data.filter(h => `${h.id} ${String(h.id).padStart(2,'0')} ${h.title} ${h.arabicTitle}`.toLocaleLowerCase('ru').includes(q));
  $('hadith-list').replaceChildren();
  if (!items.length) {
    const p = document.createElement('p'); p.className = 'empty-search'; p.textContent = 'Хадис не найден. Попробуйте номер от 1 до 40 или другую тему.';
    $('hadith-list').append(p); return;
  }
  for (const h of items) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `hadith-item${h.id === current ? ' active' : ''}`;
    b.dataset.id = h.id;
    if (h.id === current) b.setAttribute('aria-current', 'true');
    const num = document.createElement('span'); num.className = 'item-number'; num.textContent = String(h.id).padStart(2,'0');
    const title = document.createElement('span'); title.className = 'item-title'; title.textContent = h.title;
    b.append(num, title);
    if (saved.done.includes(h.id)) { const check = document.createElement('span'); check.innerHTML = icon('check'); check.firstChild.classList.add('item-check'); check.setAttribute('aria-label', 'Повторён'); b.append(check); }
    b.addEventListener('click', () => select(h.id)); $('hadith-list').append(b);
  }
}
function renderProgress() {
  const today = Array.isArray(saved.days[dayKey()]) ? new Set(saved.days[dayKey()].filter(n => Number.isInteger(n) && n >= 1 && n <= 40)).size : 0;
  $('today-count').innerHTML = `${today} <span>/ 40</span>`;
  $('today-bar').style.width = `${today/40*100}%`;
  const done = Array.isArray(saved.days[dayKey()]) && saved.days[dayKey()].includes(current);
  $('mark-done').classList.toggle('completed', done);
  $('mark-done').setAttribute('aria-pressed', String(done));
  $('mark-done').querySelector('span').textContent = done ? 'Повторён сегодня · снять' : 'Отметить повторённым';
  $('completion-title').textContent = done ? 'Ещё один шаг к прочному знанию' : 'Получилось вспомнить?';
  $('completion-description').textContent = done ? 'Хадис отмечен. К нему можно вернуться в любое время.' : 'Отметьте хадис после самостоятельного повторения.';
}
// `revealed` is a word boundary, so resizing never exposes a hidden word.
let pendingRows = [], layoutFrame = 0;
function wrapArabicWords(words, measure, available) {
  const rows = [];
  let row = [];
  for (const word of words) {
    const trial = [...row, word].join(' ');
    measure.textContent = trial;
    if (row.length && measure.getBoundingClientRect().width > available) {
      rows.push({ text: row.join(' '), words: row.length });
      row = [word];
    } else row.push(word);
  }
  if (row.length) rows.push({ text: row.join(' '), words: row.length });
  return rows;
}
function renderLines() {
  if (!data.length) return;
  const h = data[current-1];
  const words = h.arabicText.trim().split(/\s+/u);
  revealed = Math.min(revealed, words.length);
  $('lines').style.setProperty('--arabic-scale', scale);
  const measure = document.createElement('span');
  measure.className = 'arabic-content arabic-measure';
  measure.setAttribute('aria-hidden', 'true');
  measure.dir = 'rtl'; measure.lang = 'ar';
  measure.style.setProperty('--arabic-scale', scale);
  document.body.append(measure);
  const gutter = innerWidth <= 480 ? 17 : 26;
  const available = Math.max(100, $('lines').clientWidth - gutter - 3);
  const opened = wrapArabicWords(words.slice(0, revealed), measure, available);
  pendingRows = wrapArabicWords(words.slice(revealed), measure, available);
  measure.remove();
  const remaining = pendingRows.length;
  const total = opened.length + remaining;
  const fragment = document.createDocumentFragment();
  for (let i=0; i<opened.length+Math.min(remaining,3); i++) {
    const row = document.createElement('div'); row.className = 'arabic-line';
    const num = document.createElement('span'); num.className = 'line-index';
    num.setAttribute('aria-hidden','true'); num.textContent = String(i+1).padStart(2,'0'); row.append(num);
    if (i < opened.length) {
      const text = document.createElement('p'); text.className = 'arabic-content';
      text.textContent = opened[i].text;
      row.append(text);
    } else {
      row.setAttribute('aria-label',`Строка ${i+1} скрыта`);
      const skeleton = document.createElement('div'); skeleton.className = 'hidden-line'; skeleton.setAttribute('aria-hidden','true');
      const widths = [[16,10,22,13,17,8],[12,19,9,16,23,9],[22,14,11,18,9,13]][i%3];
      widths.forEach(w=>{const s=document.createElement('span');s.style.width=`${w}%`;skeleton.append(s);});
      row.append(skeleton);
    }
    fragment.append(row);
  }
  if (remaining>3) {
    const more=document.createElement('div'); more.className='hidden-more';
    more.textContent=`Ещё ${remaining-3} ${plural(remaining-3,'строка скрыта','строки скрыты','строк скрыто')}`;
    more.lang='ru';more.dir='ltr';fragment.append(more);
  }
  $('lines').replaceChildren(fragment);
  $('reveal-status').textContent = `Открыто ${opened.length} из ${total} ${plural(total,'строки','строк','строк')}`;
  $('reading-bar').style.width = `${revealed/words.length*100}%`;
  $('reveal').disabled = remaining === 0;
  $('reveal').querySelector('span').textContent = remaining === 0 ? 'Весь хадис открыт' : (step === 1 || remaining === 1 ? 'Открыть строку' : 'Открыть 2 строки');
  $('show-all').disabled = remaining === 0; $('restart').disabled = revealed === 0;
  $('memory-hint').hidden = remaining === 0;
  if (remaining === 0) {
    const end = document.createElement('div'); end.className='end-of-hadith';end.lang='ru';end.dir='ltr';
    end.innerHTML=`<span>✧</span> Хадис открыт полностью. Начните заново, чтобы повторить.`; $('lines').append(end);
  }
  $('step-one').classList.toggle('selected',step===1); $('step-two').classList.toggle('selected',step===2);
  $('step-one').setAttribute('aria-pressed',String(step===1)); $('step-two').setAttribute('aria-pressed',String(step===2));
  $('smaller').disabled = scale<=.85; $('larger').disabled=scale>=1.5;
}
function scheduleArabicLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => { if (data.length && mode === 'practice') renderLines(); });
}

function plural(n,one,few,many) { const a=n%100,b=n%10;return a>=11&&a<=14?many:b===1?one:b>=2&&b<=4?few:many; }
function setMode(next) {
  mode=next; const practice=mode==='practice';
  $('practice-panel').hidden=!practice; $('translation-panel').hidden=practice;
  for (const [id,active] of [['practice-tab',practice],['translation-tab',!practice]]) {
    $(id).classList.toggle('active',active);$(id).setAttribute('aria-selected',String(active));$(id).tabIndex=active?0:-1;
  }
  document.querySelector('.size-control').hidden=!practice;
  if (practice && data.length) scheduleArabicLayout();
}
function select(id, updateHash = true) {
  if (!data.length) return;
  current=Math.max(1,Math.min(40,id)); revealed=0;
  const h=data[current-1];
  $('hadith-number').textContent=String(current).padStart(2,'0');
  $('hadith-label').textContent=`ХАДИС ${current} ИЗ 40`;
  $('hadith-title').textContent=h.title; $('arabic-title').textContent=h.arabicTitle;
  $('translation-text').replaceChildren();
  for(const text of h.translation.split('\n\n')){const p=document.createElement('p');p.textContent=text;$('translation-text').append(p);}
  $('translation-source').href=`assets/russian-translation.pdf#page=${h.translationPage}`;
  $('arabic-source').href=`assets/arabic-original.pdf#page=${h.arabicPage}`;
  $('previous').disabled=current===1; $('next').disabled=current===40;
  $('page-position').innerHTML=`${String(current).padStart(2,'0')} <span>/ 40</span>`;
  $('mark-done').disabled=false;
  document.title=`${current}. ${h.title} — Сорок`;
  setMode('practice');renderLines();renderList();renderProgress();persist();closeMenu();
  if(updateHash) history.replaceState(null,'',`#${current}`);
}
function closeMenu(){ $('sidebar').classList.remove('open');$('drawer-overlay').hidden=true;$('open-menu').setAttribute('aria-expanded','false');document.body.classList.remove('menu-open'); }
$('open-menu').setAttribute('aria-expanded','false');$('open-menu').setAttribute('aria-controls','sidebar');
$('open-menu').addEventListener('click',()=>{$('sidebar').classList.add('open');$('drawer-overlay').hidden=false;$('open-menu').setAttribute('aria-expanded','true');document.body.classList.add('menu-open');$('close-menu').focus();});
$('close-menu').addEventListener('click',()=>{closeMenu();$('open-menu').focus();});$('drawer-overlay').addEventListener('click',closeMenu);
$('search').addEventListener('input',renderList);
$('reveal').addEventListener('click',()=>{ if(!data.length)return;revealed+=pendingRows.slice(0,step).reduce((sum,row)=>sum+row.words,0);renderLines();requestAnimationFrame(()=>$('reveal').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})); });
$('show-all').addEventListener('click',()=>{if(!data.length)return;revealed=data[current-1].arabicText.trim().split(/\s+/u).length;renderLines();notify('Весь хадис открыт для сверки');});
$('restart').addEventListener('click',()=>{revealed=0;renderLines();$('practice-card').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});notify('Текст скрыт. Вспомните хадис заново.');});
$('step-one').addEventListener('click',()=>{step=1;renderLines();persist();});$('step-two').addEventListener('click',()=>{step=2;renderLines();persist();});
$('smaller').addEventListener('click',()=>{scale=Math.max(.85,+(scale-.1).toFixed(2));renderLines();persist();});$('larger').addEventListener('click',()=>{scale=Math.min(1.5,+(scale+.1).toFixed(2));renderLines();persist();});
$('practice-tab').addEventListener('click',()=>setMode('practice'));$('translation-tab').addEventListener('click',()=>setMode('translation'));
for(const id of ['practice-tab','translation-tab']) $(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'practice':e.key==='End'?'translation':mode==='practice'?'translation':'practice';setMode(next);$(next+'-tab').focus();}});
$('random').addEventListener('click',()=>{if(!data.length)return;let id=1+Math.floor(Math.random()*39);if(id>=current)id++;select(id);notify(`Хадис ${id} — новая практика`);});
$('previous').addEventListener('click',()=>{if(current>1)select(current-1);});$('next').addEventListener('click',()=>{if(current<40)select(current+1);});
$('mark-done').addEventListener('click',()=>{
  const day=dayKey();const done=Array.isArray(saved.days[day]) && saved.days[day].includes(current);
  if(done){saved.days[day]=saved.days[day].filter(n=>n!==current);if(!Object.values(saved.days).some(ids=>Array.isArray(ids)&&ids.includes(current)))saved.done=saved.done.filter(n=>n!==current);notify('Отметка снята');}
  else {if(!saved.done.includes(current))saved.done.push(current);saved.days[day]=[...new Set([...(Array.isArray(saved.days[day])?saved.days[day]:[]),current])];notify('Хадис отмечен как повторённый');}
  persist();renderList();renderProgress();
});
$('about-button').addEventListener('click',()=>$('about-dialog').showModal());$('close-about').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
window.addEventListener('hashchange',()=>{const n=Number(location.hash.slice(1));if(Number.isInteger(n)&&n>=1&&n<=40)select(n,false);});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('sidebar').classList.contains('open')){closeMenu();$('open-menu').focus();return;}
  if(e.key==='Tab'&&$('sidebar').classList.contains('open')){const els=[...$('sidebar').querySelectorAll('a,button,input')].filter(el=>el.offsetParent!==null);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}return;}
  if(['INPUT','TEXTAREA','BUTTON','A'].includes(e.target.tagName)||$('about-dialog').open)return;
  if(e.key==='/'){e.preventDefault();if(innerWidth<=800)$('open-menu').click();$('search').focus();}
  if(e.code==='Space'&&mode==='practice'&&!$('reveal').disabled){e.preventDefault();$('reveal').click();}
});
fetch('assets/hadiths.json?v=arabic-text-1').then(r=>{if(!r.ok)throw Error('Не удалось загрузить тексты');return r.json();}).then(items=>{
  if(!Array.isArray(items)||items.length!==40||items.some(h=>typeof h.arabicText!=='string'||!h.arabicText.trim()))throw Error('Библиотека недоступна');
  data=items;const hash=Number(location.hash.slice(1));select(Number.isInteger(hash)&&hash>=1&&hash<=40?hash:saved.last);
  $('practice-card').setAttribute('aria-busy','false');
  document.fonts.ready.then(scheduleArabicLayout);
}).catch(()=>{
  $('practice-card').setAttribute('aria-busy','false');$('lines').innerHTML='<p class="error-message" lang="ru" dir="ltr">Не удалось загрузить библиотеку. Обновите страницу или откройте оригинал книги по ссылке ниже.</p>';
  $('hadith-list').innerHTML='<p class="empty-search">Ошибка загрузки. Обновите страницу, чтобы попробовать снова.</p>';
});

let observedArabicWidth = 0;
new ResizeObserver(entries => {
  const width = entries[0].contentRect.width;
  if (Math.abs(width-observedArabicWidth)>.5) {observedArabicWidth=width;if(mode==='practice')scheduleArabicLayout();}
}).observe($('lines'));
document.fonts.addEventListener('loadingdone',scheduleArabicLayout);
