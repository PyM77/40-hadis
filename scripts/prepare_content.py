"""Build faithful Arabic line facsimiles and extract translations from supplied PDFs.
The boundaries were checked visually against the two source editions.
"""
from pathlib import Path
import json, re, unicodedata, shutil
import numpy as np
from PIL import Image
import pypdfium2 as pdfium
import pdfplumber
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'dist/assets'; ASSETS.mkdir(parents=True,exist_ok=True)
import argparse
parser=argparse.ArgumentParser(description='Prepare the supplied Arabic and Russian source PDFs.')
parser.add_argument('--sources',type=Path,default=Path.home()/'Downloads')
DOWNLOADS=parser.parse_args().sources
ar_source=next(p for p in DOWNLOADS.glob('*.pdf') if 'الأربعون حديثا' in unicodedata.normalize('NFC',p.name))
ru_source=DOWNLOADS/'40 хадисов.pdf'
# Page number, top coordinate of the chapter heading in a 1.8x rendering.
heads=[(6,1110),(7,400),(7,768),(7,1136),(8,343),(9,1047),(10,565),(11,344),(11,1076),(12,542),(12,1111),(13,446),(13,778),(14,348),(14,843),(15,404),(15,914),(16,554),(17,454),(18,223),(18,868),(19,636),(20,226),(20,605),(21,227),(21,540),(22,950),(23,226),(24,877),(26,395),(26,723),(26,1051),(27,496),(27,1021),(28,221),(29,662),(30,555),(30,1001),(31,441),(32,223)]
titles=['Понимание религии','Достоинство знания','Намерение','Столпы ислама','Вера. Хадис Джибриля','Сотворение и предопределение','Вера в предопределение','Следование Сунне','Достоинство Корана','Десять обрадованных Раем','Сподвижники Пророка ﷺ','Вера: слова, дела и убеждение','Путь Пророка ﷺ и сподвижников','Омовение: один, два и три раза','Как совершать омовение','Полное омовение','Пять деяний и Рай','Как совершать молитву','Полноценная молитва','Тщательность в молитве и омовении','Достоинство молитвы','Омовение и молитва как велено','Обязательность закята','Щедрость и милостыня','Садака с урожая и имущества','Закят со скота','Достоинство Рамадана','Предписанный пост','Наблюдение за полумесяцем','Спешите совершить хадж','Побуждение к хаджу','Обязанность хаджа','Дежурство на пути Аллаха','Усердие на пути Аллаха','Соблюдение установлений','Терпение при несчастье','Искренность в религии','Дозволенное и запретное','Семеро в тени в День воскресения','Наставления Абу Зарру']
ar_titles=['في طلب العلم','في فضل العلم','في النية','في الإسلام','في الإيمان','في الخلقة','في الإيمان بالقدر','في لزوم السنة','في فضل القرآن','في الصحابة','في حب الصحابة','الإيمان يزيد وينقص','في الفرق','في الوضوء','في كيفية الوضوء','في غسل الجنابة','في الصلاة','في كيفية الصلاة','في البنية','في إسباغ الوضوء','في فضل الصلاة','في أدب الصلاة','في الزكاة','في الصدقة','في صدقة الثمار','في زكاة الماشية','في فضل رمضان','في الصوم','في رؤية الهلال','في تعجيل الحج','في الحث على الحج','في فرض الحج','في الرباط','في الجهاد','في الاحتساب','في الصبر على المصيبة','في النصيحة','في الحلال والحرام','في ظل الله يوم القيامة','في جملة الأعمال']
doc=pdfium.PdfDocument(ar_source)
pages={};bands={};footers={}
k=np.exp(-np.arange(-12,13)**2/32);k/=k.sum()
for n in range(6,38):
 im=doc[n-1].render(scale=1.8).to_pil().convert('RGB');a=np.array(im);h,w=a.shape[:2];pages[n]=im
 ink=a[:,180:905].min(2)<215
 # Footnotes start below the thin horizontal rule on the right.
 footer=h
 for y in range(1000,h):
  row=ink[y,320:];runs=np.diff(np.r_[False,row,False].astype(int));starts=np.where(runs==1)[0];ends=np.where(runs==-1)[0]
  if len(starts) and max(ends-starts)>190:footer=y;break
 footers[n]=footer
 counts=(a[:,180:905].min(2)<210).sum(1);smooth=np.convolve(counts,k,mode='same')
 candidates=[p for p in range(210,min(footer,h)-15) if smooth[p]>6 and smooth[p]==max(smooth[p-16:p+17])]
 peaks=[]
 for p in sorted(candidates,key=lambda p:-smooth[p]):
  if all(abs(p-q)>=33 for q in peaks):peaks.append(p)
 peaks.sort();cuts=[200]
 for p,q in zip(peaks,peaks[1:]):
  l=p+12;u=q-12
  valley=counts[l:u];mins=np.where(valley==valley.min())[0];target=(p+q)/2
  cuts.append(int(l+min(mins,key=lambda v:abs(l+v-target))))
 cuts.append(footer)
 out=[]
 for i,p in enumerate(peaks):
  lo=cuts[i];hi=cuts[i+1];ys=np.where(counts[lo:hi]>2)[0]
  if len(ys):out.append((int(lo+ys.min()),int(lo+ys.max()+1)))
 bands[n]=out
with pdfplumber.open(ru_source) as ru:
 ru_pages=[];ru_heads=[]
 for i,page in enumerate(ru.pages[:151]):
  full=page.extract_text() or ''
  if m:=re.search(r'\[(\d+) ХАДИС\]',full):ru_heads.append((i,int(m.group(1))))
  chars=[c for c in page.chars if 13.5<c['size']<15.5 and c['top']>35]
  ru_pages.append(pdfplumber.utils.extract_text(chars,x_tolerance=2,y_tolerance=4))
 data=[]
 for idx,(page,y) in enumerate(heads):
  n=idx+1;endpage,endy=heads[idx+1] if n<40 else (37,310)
  lines=[]
  for p in range(page,endpage+1):
   low=y+40 if p==page else 200;high=endy-10 if p==endpage else footers[p]
   for s,e in bands[p]:
    if (s+e)/2<low or (s+e)/2>=high:continue
    # Pad from original page; each complete line remains indivisible.
    crop=pages[p].crop((130,max(low,s-3),945,min(high,e+3)))
    if crop.height<10:continue
    fn=f'lines/{n:02}-{len(lines)+1:03}.webp';dest=ASSETS/fn;dest.parent.mkdir(exist_ok=True)
    crop.save(dest,format='WEBP',lossless=True)
    inkcols=(np.array(crop).min(2)<210).sum(0)
    xs=np.where(inkcols>0)[0];left=max(0,int(xs.min())-3);right=min(crop.width,int(xs.max())+4)
    empty=inkcols==0;runs=np.diff(np.r_[False,empty,False].astype(int));starts=np.where(runs==1)[0];ends=np.where(runs==-1)[0]
    spaces=[int((a+b)/2) for a,b in zip(starts,ends) if b-a>=8 and a>left and b<right]
    parts=[]
    while right-left>365:
     candidates=[x for x in spaces if left+60<x<right-120]
     if not candidates:break
     cut=min(candidates,key=lambda x:abs(x-(right-350)))
     parts.append({'x':cut,'width':right-cut});right=cut
    parts.append({'x':left,'width':right-left})
    lines.append({'parts':parts,'src':'assets/'+fn,'width':crop.width,'height':crop.height,'page':p,'top':max(low,s-3),'bottom':min(high,e+3)})
  ru_start=ru_heads[idx][0];ru_end=ru_heads[idx+1][0] if n<40 else 150
  t='\n'.join(ru_pages[ru_start:ru_end])
  m=re.search(r'\b\d+\.\s+(?:От |Рассказал |Нам |Передается |Шурахбиль )',t)
  if not m:raise ValueError(f'No translation start {n}')
  t=t[m.start():].split('[Сказал Мухаммад')[0].split('108.')[0].strip()
  t=re.sub(r'^\d+\.\s*','',t)
  t=re.sub(r'(?<!\w)i(?!\w)','ﷺ',t)
  t=re.sub(r'(?<!\w)4(?!\w)','(да будет доволен им Аллах)',t)
  t=re.sub(r'(?<!\w)O(?!\w)','(да будет Аллах доволен ими обоими)',t)
  t=re.sub(r'\n(?=\[(?:Абу Зарр|Посланник Аллаха)\])','\n\n',t)
  t='\n\n'.join(re.sub(r'\s+',' ',p).replace('» .','».').replace('» ,','»,') for p in t.split('\n\n'))
  assert len(t)>50 and len(lines)>1,(n,t,lines)
  data.append({'id':n,'title':titles[idx],'arabicTitle':ar_titles[idx],'lines':lines,'translation':t,'arabicPage':page,'translationPage':ru_start+1})
(ASSETS/'hadiths.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
shutil.copyfile(ar_source,ASSETS/'arabic-original.pdf');shutil.copyfile(ru_source,ASSETS/'russian-translation.pdf')
print('Created',len(data),'hadiths;',sum(len(h['lines']) for h in data),'lines')
print('Footers',footers)
for h in data:print(h['id'],len(h['lines']),len(h['translation']),h['translation'][:70],h['translation'][-70:])
