#!/usr/bin/env python3
"""Build ASTRA's timed, editable pitch from the authored JSON."""
import argparse, csv, json, math, os, shutil, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR
from pptx.oxml.xmlchemy import OxmlElement
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
W,H=1920,1080
NAVY='#091622'; CREAM='#f4efe6'; ORANGE='#ed8b35'; CYAN='#65d9e8'
FONT=os.getenv('ASTRA_FONT_REGULAR','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'); BOLD=os.getenv('ASTRA_FONT_BOLD','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
pdfmetrics.registerFont(TTFont('DV',FONT)); pdfmetrics.registerFont(TTFont('DVB',BOLD))

def hexrgb(s): return tuple(bytes.fromhex(s.lstrip('#')))
def font(sz,b=False): return ImageFont.truetype(BOLD if b else FONT,sz)
def fit_lines(text, maxwidth, sz, bold=True):
    words=text.split(); lines=[]; line=''; f=font(sz,bold)
    for word in words:
        trial=(line+' '+word).strip()
        if line and f.getlength(trial)>maxwidth: lines.append(line); line=word
        else: line=trial
    if line: lines.append(line)
    return lines

def image_for(n):
    art=ROOT/'docs/art'; prod=art/'production-vision'; demo=ROOT/'docs/demo/fixture-captures'
    choices={1:'09-partner-lunar-journey',2:'13-badges-coop-friends',3:'09-partner-lunar-journey',4:'20-worlds-next-destinations',8:'21-character-motion-adventure',9:'10-create-your-companion',10:'14-avatar-photo-stylization',11:'09-partner-lunar-journey',12:'20-worlds-next-destinations',13:'20-worlds-next-destinations',14:'15-short-dialogue-voice',15:'11-playful-tasks-dialogue',16:'11-playful-tasks-dialogue',17:'15-short-dialogue-voice',18:'15-short-dialogue-voice',19:'16-museum-science-discovery',20:'16-museum-science-discovery',21:'17-resource-care-alert',22:'17-resource-care-alert',23:'12-home-family-learning',24:'18-knowledge-badges-uniform',25:'13-badges-coop-friends',26:'19-family-companion-app',28:'20-worlds-next-destinations',29:'09-partner-lunar-journey',30:'09-partner-lunar-journey'}
    if n==27:return demo/'fixture-04-canyon.png'
    return prod/(choices[n]+'.png') if n in choices else art/'01-world-atlas.png'

def make_bg(n,out):
    im=Image.new('RGB',(W,H),hexrgb(NAVY)); p=image_for(n)
    if p.exists() and n not in (4,5,6,7,14,15,21,26,27,28):
        src=Image.open(p).convert('RGB'); src=ImageOps.fit(src,(W,H),method=Image.Resampling.LANCZOS)
        # Art is kept legible on the right; a dark veil creates room for titles.
        shade=Image.new('RGBA',(W,H),(0,0,0,0)); px=shade.load()
        for x in range(W):
            a=int(235-(x/W)*220)
            ImageDraw.Draw(shade).line((x,0,x,H),fill=(9,22,34,a))
        im=Image.alpha_composite(src.convert('RGBA'),shade).convert('RGB')
        d=ImageDraw.Draw(im); d.rectangle((0,900,W,H),fill=(9,22,34))
    else:
        d=ImageDraw.Draw(im)
        for y in range(H):
            t=y/H; d.line((0,y,W,y),fill=(int(9+7*t),int(22+14*t),int(34+17*t)))
        d.ellipse((1180,-420,2300,700),outline=(28,57,67),width=3)
        d.ellipse((1280,-320,2200,600),outline=(25,49,59),width=2)
    im.save(out,quality=95)

def elements(s):
    n=s['id']; e=[]
    def text(x,y,w,t,size=48,color=CREAM,bold=False): e.append(('text',x,y,w,t,size,color,bold))
    def box(x,y,w,h,color, radius=0): e.append(('box',x,y,w,h,color,radius))
    # Small consistent brand and chapter label.
    text(96,67,900,'ASTRA  /  '+s['chapter'].upper(),22,CYAN,True)
    special=n in (5,6,7)
    if special:
        num={5:'73%',6:'71%',7:'33 ESTUDOS'}[n]
        text(96,205,1500,num,105 if n==7 else 180,ORANGE,True)
        text(102,450,1250,s['title'],62,CREAM,True)
        sub={5:'Usuários de internet de 9 a 10 anos que jogaram online',6:'Usuários de internet de 11 a 12 anos que jogaram online',7:'3.894 participantes · aprendizagem em STEM'}[n]
        text(102,555,1350,sub,34,CREAM)
        foot={5:'Cetic.br / NIC.br · TIC Kids Online Brasil 2025 · p. 84',6:'Cetic.br / NIC.br · TIC Kids Online Brasil 2025 · p. 84',7:'Wang et al. (2022) · efeito 0,667 · doi:10.1186/s40594-022-00344-0 · Não avalia ASTRA'}[n]
        text(102,875,1650,foot,21,CYAN)
    else:
        title=s['title']; sz=70 if len(title)<29 else 62
        text(96,200,1080,title,sz,CREAM,True)
        text(100,390,1000,s['subtitle'],35,CREAM)
        if n==30: text(100,580,1000,'ASTRA',150,ORANGE,True)
        if n==9:
            text(100,550,1500,'HUMANO   ·   CACHORRO   ·   GATO',34,CYAN,True)
            text(100,620,1500,'TARTARUGA   ·   ROBÔ',34,CYAN,True)
        if n==14:
            box(1020,510,700,180,'#f4efe6'); text(1070,555,600,'O que vamos descobrir?',35,NAVY,True)
        if n==15:
            for i,(a,b) in enumerate([('01','OBSERVAR'),('02','TESTAR'),('03','DESCOBRIR')]):
                x=100+i*480; text(x,620,380,a,60,ORANGE,True); text(x,710,400,b,26,CYAN,True)
        if n==21:
            for i,(label,width) in enumerate([('OXIGÊNIO',400),('ENERGIA',450),('ÁGUA',330),('ALIMENTO',250)]):
                y=510+i*90; e.append(('circle',105,y,42,42,CYAN)); text(115,y+8,30,['O','E','A','C'][i],19,NAVY,True); text(165,y+5,250,label,23,CYAN,True); box(430,y+5,520,22,'#28404a'); box(430,y+5,width,22,ORANGE)
        if n==17:
            box(1100,520,95,150,CYAN); box(1138,670,20,50,CYAN); box(1105,720,85,12,CYAN)
            box(1250,500,520,130,CREAM); text(1280,540,470,'Por que a Lua brilha?',29,NAVY,True)
        if n==18:
            box(1120,510,650,150,CREAM); text(1160,550,570,'Vamos descobrir juntos!',33,NAVY,True)
        if n==19:
            for i,label in enumerate(['LUA','FÍSICA','MATEMÁTICA']):
                x=100+i*470; box(x,590,390,130,'#28404a'); text(x+30,635,350,label,30,CYAN,True)
        if n==20:
            box(1120,470,600,330,'#28404a'); box(1150,500,540,270,NAVY); text(1360,570,200,'▶',95,CYAN,True)
        if n==22:
            box(0,0,18,H,'#db6c62'); box(1100,540,630,130,CREAM); text(1140,580,560,'Vamos reabastecer?',32,NAVY,True)
        if n==24:
            for i,label in enumerate(['OBSERVAR','EXPLICAR','APLICAR']):
                x=100+i*480; box(x,600,390,115,'#28404a'); text(x+25,635,350,label,28,CYAN,True)
        if n==26:
            box(1060,390,700,440,'#34505b'); box(1080,410,660,400,NAVY)
            for i,label in enumerate(['CONSENTIMENTO','ACOMPANHAMENTO','PRIVACIDADE']):
                y=455+i*105; text(1120,y,500,label,26,CREAM,True); box(1570,y,100,34,CYAN)
        if n==28:
            text(100,560,1500,'VOZ  ·  AVATARES  ·  IA  ·  FAMÍLIA  ·  COOPERAÇÃO',28,CYAN,True)
        if n==27: e.append(('picture',950,235,850,580,str(image_for(27))))
        if n==27:text(100,500,700,'Mundo explorável em demonstração',29,CYAN,True)
    if s['kind']=='production_concept':text(96,930,1200,'VISÃO DE PRODUÇÃO  ·  ARTE COM IA',19,CYAN,True)
    if s['kind']=='current_demo':text(96,930,800,'DEMO ATUAL',22,ORANGE,True)
    if s['kind']=='vision':text(96,930,1000,'VISÃO DE PRODUÇÃO  ·  ARTE COM IA',19,CYAN,True)
    box(96,1010,1728,2,'#34505b'); box(96,1010,int(1728*n/30),3,ORANGE)
    text(96,1022,600,f'{n:02d} / 30',18,CREAM)
    text(1670,1022,160,s['timecode']+'  /  03:00',18,CREAM)
    return e

def render_pil(bg,e,out):
    im=Image.open(bg).convert('RGB'); d=ImageDraw.Draw(im)
    for item in e:
        if item[0]=='circle':
            _,x,y,w,h,col=item; d.ellipse((x,y,x+w,y+h),fill=col)
        elif item[0]=='picture':
            _,x,y,w,h,path=item; pic=ImageOps.contain(Image.open(path).convert('RGB'),(w,h)); im.paste(pic,(x+(w-pic.width)//2,y+(h-pic.height)//2)); d=ImageDraw.Draw(im)
        elif item[0]=='box':
            _,x,y,w,h,c,r=item; d.rectangle((x,y,x+w,y+h),fill=c)
        else:
            _,x,y,w,t,sz,c,b=item
            for j,line in enumerate(fit_lines(t,w,sz,b)): d.text((x,y+j*sz*1.22),line,font=font(sz,b),fill=c,anchor='lt')
    im.save(out)

def ppt_elements(slide,e):
    from pptx.enum.shapes import MSO_SHAPE
    for item in e:
        if item[0]=='circle':
            _,x,y,w,h,col=item; sh=slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x/144), Inches(y/144), Inches(w/144), Inches(h/144)); sh.fill.solid(); sh.fill.fore_color.rgb=RGBColor(*hexrgb(col)); sh.line.fill.background()
        elif item[0]=='picture':
            _,x,y,w,h,path=item; iw,ih=Image.open(path).size; scale=min(w/iw,h/ih); nw,nh=iw*scale,ih*scale; slide.shapes.add_picture(path, Inches((x+(w-nw)/2)/144), Inches((y+(h-nh)/2)/144), width=Inches(nw/144), height=Inches(nh/144))
        elif item[0]=='box':
            _,x,y,w,h,c,r=item; sh=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x/144), Inches(y/144), Inches(w/144), Inches(h/144)); sh.fill.solid(); sh.fill.fore_color.rgb=RGBColor(*hexrgb(c)); sh.line.fill.background()
        else:
            _,x,y,w,t,sz,c,b=item; lines=fit_lines(t,w,sz,b); sh=slide.shapes.add_textbox(Inches(x/144), Inches((y-4)/144), Inches(w/144), Inches((len(lines)*sz*1.28+15)/144)); tf=sh.text_frame; tf.clear(); tf.word_wrap=False; tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0
            for i,line in enumerate(lines):
                p=tf.paragraphs[0] if i==0 else tf.add_paragraph(); p.text=line; p.font.name='DejaVu Sans'; p.font.size=Pt(sz/2); p.font.bold=b; p.font.color.rgb=RGBColor(*hexrgb(c)); p.space_after=Pt(0)

def pdf_elements(c,e):
    for item in e:
        if item[0]=='circle':
            _,x,y,w,h,col=item; c.setFillColorRGB(*(v/255 for v in hexrgb(col))); c.circle(x+w/2,H-y-h/2,w/2,fill=1,stroke=0)
        elif item[0]=='picture':
            _,x,y,w,h,path=item; c.drawImage(path,x,H-y-h,width=w,height=h,preserveAspectRatio=True,anchor='c')
        elif item[0]=='box':
            _,x,y,w,h,col,r=item; c.setFillColorRGB(*(v/255 for v in hexrgb(col))); c.rect(x,H-y-h,w,h,fill=1,stroke=0)
        else:
            _,x,y,w,t,sz,col,b=item; c.setFillColorRGB(*(v/255 for v in hexrgb(col))); c.setFont('DVB' if b else 'DV',sz)
            for j,line in enumerate(fit_lines(t,w,sz,b)):c.drawString(x,H-y-sz*.93-j*sz*1.22,line)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--output-dir',type=Path,default=Path('/workspace/artifacts/ASTRA-Export-2026-11-15/apresentacao')); args=ap.parse_args(); out=args.output_dir.resolve(); out.mkdir(parents=True,exist_ok=True)
    slides=json.loads((ROOT/'docs/presentation/PITCH_30_SLIDES.json').read_text()); assert len(slides)==30 and sum(s['durationSeconds'] for s in slides)==180
    for d in ['png','jpeg','backgrounds']: (out/d).mkdir(exist_ok=True)
    prs=Presentation(); prs.slide_width=Inches(13.333333); prs.slide_height=Inches(7.5)
    pdf=canvas.Canvas(str(out/'ASTRA-30-slides-3min.pdf'),pagesize=(W,H))
    for s in slides:
        n=s['id']; bg=out/'backgrounds'/f'{n:02d}.jpg'; png=out/'png'/f'{n:02d}.png'; make_bg(n,bg); el=elements(s); render_pil(bg,el,png)
        with Image.open(png) as im: im.resize((960,540),Image.Resampling.LANCZOS).save(out/'jpeg'/f'{n:02d}.jpg',quality=85,optimize=True)
        slide=prs.slides.add_slide(prs.slide_layouts[6]); slide.shapes.add_picture(str(bg),0,0,width=prs.slide_width,height=prs.slide_height); ppt_elements(slide,el)
        tr=OxmlElement('p:transition'); tr.set('advClick','0'); tr.set('advTm','6000'); slide._element.insert_element_before(tr,'p:timing','p:extLst')
        slide.notes_slide.notes_text_frame.text=f"{s['timecode']} — {s['durationSeconds']} segundos\n{s['narration']}"
        pdf.drawImage(str(bg),0,0,width=W,height=H); pdf_elements(pdf,el); pdf.showPage()
    prs.save(str(out/'ASTRA-30-slides-3min.pptx')); pdf.save()
    sheet=Image.new('RGB',(5*384,6*216),hexrgb(NAVY))
    for s in slides:
        n=s['id']; im=Image.open(out/'jpeg'/f'{n:02d}.jpg').resize((384,216),Image.Resampling.LANCZOS); sheet.paste(im,(((n-1)%5)*384,((n-1)//5)*216))
    sheet.save(out/'contato-30-slides.jpg',quality=90)
    with (out/'roteiro-tempos.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.writer(f); w.writerow(['slide','inicio','duracao_segundos','titulo','narracao']); w.writerows((s['id'],s['timecode'],s['durationSeconds'],s['title'],s['narration']) for s in slides)
    (out/'roteiro-tempos.md').write_text('# ASTRA — roteiro de 3 minutos\n\nCada slide: 6 segundos. Duração total: 03:00.\n\n'+'\n'.join(f"- **{s['timecode']} · {s['id']:02d}. {s['title']}** — {s['narration']}" for s in slides)+'\n',encoding='utf8')
    (out/'index.html').write_text('''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ASTRA — 3 minutos</title><style>body{margin:0;background:#091622;color:#f4efe6;font:16px system-ui;display:grid;place-items:center;min-height:100vh}main{width:min(96vw,1600px)}img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}nav{display:flex;align-items:center;gap:12px;padding:12px}button{background:#ed8b35;color:#091622;border:0;padding:10px 18px;border-radius:4px;font-weight:bold;cursor:pointer}span{margin-left:auto}</style><main><img id="slide" alt="Slide ASTRA"><nav><button id="toggle">Iniciar</button><button id="prev">←</button><button id="next">→</button><button id="full">Tela cheia</button><span id="time"></span></nav></main><script>const duration=180, step=6;let elapsed=0,playing=false,last=0;const img=document.querySelector('#slide'),label=document.querySelector('#time'),toggle=document.querySelector('#toggle');function render(){let i=Math.min(29,Math.floor(elapsed/step));img.src='jpeg/'+String(i+1).padStart(2,'0')+'.jpg';img.alt='Slide '+(i+1)+' de 30';let t=Math.floor(elapsed);label.textContent=String(i+1).padStart(2,'0')+'/30 · '+String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')+' / 03:00';toggle.textContent=playing?'Pausar':elapsed>=duration?'Reiniciar':'Iniciar'}function tick(now){if(playing){elapsed=Math.min(duration,elapsed+(now-last)/1000);last=now;if(elapsed>=duration)playing=false;render()}requestAnimationFrame(tick)}toggle.onclick=()=>{if(elapsed>=duration)elapsed=0;playing=!playing;last=performance.now();render()};function go(delta){elapsed=Math.max(0,Math.min(174,(Math.floor(elapsed/step)+delta)*step));last=performance.now();render()}document.querySelector('#prev').onclick=()=>go(-1);document.querySelector('#next').onclick=()=>go(1);document.querySelector('#full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();document.onkeydown=e=>{if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1);if(e.key===' '){e.preventDefault();toggle.click()}};render();requestAnimationFrame(tick)</script></html>''',encoding='utf8')
    # Single-file player: embedding JPEGs permits exporting/opening this HTML on its own.
    import base64
    player=(out/'index.html').read_text(encoding='utf8')
    frames=['data:image/jpeg;base64,'+base64.b64encode((out/'jpeg'/f'{i:02d}.jpg').read_bytes()).decode('ascii') for i in range(1,31)]
    player=player.replace('<script>const duration=', '<script>const FRAMES='+json.dumps(frames)+';const duration=')
    player=player.replace("img.src='jpeg/'+String(i+1).padStart(2,'0')+'.jpg';", "if(img.dataset.slide!==String(i)){img.src=FRAMES[i];img.dataset.slide=String(i)};")
    player=player.replace('min-height:100vh}', 'min-height:100vh}button{min-height:44px}main:fullscreen{width:100vw}nav{flex-wrap:wrap}')
    (out/'index.html').write_text(player,encoding='utf8')
    (out/'ASTRA-30-slides-3min.html').write_text(player,encoding='utf8')
    (out/'manifest.json').write_text(json.dumps({'slides':30,'durationPerSlideMs':6000,'totalDurationSeconds':180,'source':'docs/presentation/PITCH_30_SLIDES.json','notes':'timestamp and authored narration on each slide'},indent=2)+'\n')
    (out/'fontes').mkdir(exist_ok=True)
    for face in [FONT,BOLD]: shutil.copyfile(face,out/'fontes'/Path(face).name)
    license=Path('/usr/share/doc/fonts-dejavu/copyright')
    if license.exists(): shutil.copyfile(license,out/'fontes'/'LICENCA-DejaVu.txt')
    print('Built',out)
if __name__=='__main__': main()
