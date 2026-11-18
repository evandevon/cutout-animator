#!/usr/bin/env python3
"""Draws the printable templates. Every position here must match LAYOUTS at the top of template.js.
   templates/cutout-template-A4.pdf  one sheet = one scene (backdrop, script, 4 characters)
   templates/story-template-A4.pdf   a story: cast page (6 characters) + Orientation, Complication,
                                     What happens next (print as many as needed) and Resolution pages
All sheets are landscape A4 (297 x 210 mm), and can be printed larger. Each has four corner squares
(the top-left one has a white centre) and a 4-square page code at the bottom that tells the app which page it is."""
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import black, white, HexColor

W,H=297,210
GREY=HexColor('#b5b5b5'); TEXT=HexColor('#555555'); FAINT=HexColor('#dddddd'); CHIP=HexColor('#eeeeee'); HINT=HexColor('#8a8a8a')
SOUNDS=['Rain','Wind','Ocean','Forest','Underwater','Night','Campfire']
MUSIC=['Happy','Adventure','Spooky','Sleepy','Silly','Sad','Tense']
ANIM=['Sway','Hop','Float','Spin']
CODE_X,CODE_Y,CODE_S,CODE_P=185,197,3,4.5   # page code squares
CODES={'scene':[1,1,0,0],'cast':[1,0,0,0],'orientation':[0,1,0,0],'complication':[0,0,1,0],'next':[0,1,1,0],'resolution':[0,0,0,1]}
STAGES=[('orientation','Orientation','Who is in the story? Where are they? When is it?',
           ['Introduce the characters.','Show where and when it happens.','Start calm: try Happy or Sleepy music.']),
        ('complication','Complication','What goes wrong? How do the characters feel?',
           ['Something goes wrong.','Show how the characters feel.','Try Tense, Sad or Spooky music.']),
        ('next','What happens next','What do they try? Does it work? What happens then?',
           ['Show what the characters try next.','Does it work, or make things worse?','Scan these pages in story order.']),
        ('resolution','Resolution','How is the problem solved? How have things changed?',
           ['Solve the problem, or try to.','Show how things have changed.','Happy music helps it finish well.'])]

class Sheet:
    def __init__(s,c): s.c=c
    def Y(s,y): return (H-y)*mm
    def rect(s,x,y,w,h,lw=.5,col=GREY,fill=None):
        c=s.c; c.setStrokeColor(col); c.setLineWidth(lw*2.83)
        if fill: c.setFillColor(fill)
        c.rect(x*mm,s.Y(y+h),w*mm,h*mm,stroke=1,fill=1 if fill else 0)
    def text(s,x,y,t,size=9,bold=False,col=TEXT,align='l'):
        c=s.c; c.setFillColor(col); c.setFont('Helvetica-Bold' if bold else 'Helvetica',size)
        {'l':c.drawString,'c':c.drawCentredString,'r':c.drawRightString}[align](x*mm,s.Y(y),t)
    def line(s,x0,y0,x1,y1,col=FAINT,lw=.4):
        c=s.c; c.setStrokeColor(col); c.setLineWidth(lw*2.83); c.line(x0*mm,s.Y(y0),x1*mm,s.Y(y1))
    def corners(s):
        for i,(cx,cy) in enumerate([(13,13),(284,13),(284,197),(13,197)]):
            s.c.setFillColor(black); s.c.rect((cx-5)*mm,s.Y(cy+5),10*mm,10*mm,stroke=0,fill=1)
            if i==0: s.c.setFillColor(white); s.c.rect((cx-2)*mm,s.Y(cy+2),4*mm,4*mm,stroke=0,fill=1)
    def code(s,kind):
        for i,b in enumerate(CODES[kind]):
            s.c.setFillColor(black if b else white); s.c.setStrokeColor(black); s.c.setLineWidth(.5)
            s.c.rect((CODE_X+i*CODE_P)*mm,s.Y(CODE_Y+CODE_S),CODE_S*mm,CODE_S*mm,stroke=1,fill=1)
    def tick(s,x,y,label,size,fs):
        s.rect(x,y,size,size,.7); s.text(x+size+1.5,y+size-1,label,fs)
    def char(s,x,y,w,h,i,fs=8.5,afs=7.5,name_top=True):
        s.text(x,y-1.2,f'Character {i+1}',fs,True)
        if name_top: s.text(x+w,y-1.2,'name: ____________',7,col=HINT,align='r')
        s.rect(x,y,w,h)
        for j,a in enumerate(ANIM): s.tick(x+j*w/4,y+h+1.5,a,4.5,afs)
    def lists(s,x,y,dx,dy,size,fs):
        if dx<40: s.text(x,y-2.2,'Background sound',8.5,True)
        else: s.text(x,y-5.7,'Background',8.5,True); s.text(x,y-2.2,'sound',8.5,True)
        s.text(x+dx,y-2.2,'Music',8.5,True)
        for i,t in enumerate(SOUNDS): s.tick(x,y+i*dy,t,size,fs)
        for i,t in enumerate(MUSIC): s.tick(x+dx,y+i*dy,t,size,fs)
    def footer(s,kind,note):
        s.text(24,200,note,8); s.code(kind); s.text(276,200,'evandevon.github.io/cutout-animator',6.5,align='r')

def scene_sheet(s):
    s.corners()
    s.text(24,15,'Name: ____________________',11,True,black); s.text(110,15,'Scene: _______',11,True,black)
    s.text(165,15,'Use dark pens and bright colours. Stay inside the boxes.',8)
    s.text(10,23.8,'Backdrop: draw the whole place, right to the edges',8.5,True); s.rect(10,25,160,90)
    s.text(10,125.8,'My script: what will you say?',8.5,True); s.rect(10,127,160,61)
    for i in range(5): s.line(13,138+i*10,167,138+i*10)
    for i in range(4): s.char(178+(i%2)*58,25+(i//2)*50,51,35,i,8.5,7)
    s.lists(178,128,38,8.5,5.5,8.5)
    x,y,w,h=245,127,42,61; s.text(x,y-1.2,"Sounds I'll make",8.5,True); s.rect(x,y,w,h); s.text(x+2,y+5,'Write or draw each one.',6.5,col=HINT)
    for i in range(5): s.line(x+3,y+16+i*9,x+w-3,y+16+i*9)
    s.footer('scene','Tick one background sound and one music. Tick how each character moves, or none to keep it still.')

def tracker(s,cur):
    names=['Orientation','Complication','Next','Resolution']; ws=[30,32,18,30]; k=80/sum(ws); x=196
    for i,(n,w) in enumerate(zip(names,ws)):
        w*=k; on=i==cur; s.rect(x,8.5,w-2,6.5,.4,col=black if on else GREY,fill=black if on else CHIP)
        s.text(x+(w-2)/2,13,n,6.5,bold=on,col=white if on else TEXT,align='c'); x+=w

def story_header(s):
    s.corners(); s.text(24,15,'Name: ____________________',11,True,black); s.text(110,15,'Story: ______________________',11,True,black)

def cast_page(s):
    story_header(s); s.text(196,15,'Page 1: The cast',11,True,black)
    s.text(10,22.5,'Draw your 6 characters. They will be in every scene. Use dark pens and bright colours. Stay inside the boxes.',8.5,True)
    for i in range(6):
        x,y=10+(i%3)*95.5,30+(i//3)*83; s.char(x,y,86,52,i,name_top=False)
        # under each character: its name and a really short description
        s.text(x,y+64.5,'Name:',8,True); s.line(x+10,y+64.8,x+86,y+64.8,col=GREY,lw=.35)
        s.text(x,y+71.5,'About them:',8,True); s.line(x+19,y+71.8,x+86,y+71.8,col=GREY,lw=.35)
    s.footer('cast','Scan this page first, then the scene pages. Tick how each character moves, or none to keep it still.')

def stage_page(s,k):
    key,name,prompt,tips=STAGES[k]; story_header(s); tracker(s,k)
    s.text(10,21.5,name,14,True,black); s.text(10+s.c.stringWidth(name,'Helvetica-Bold',14)/mm+3,21.5,'Backdrop: draw the whole place, right to the edges',8.5,True)
    s.rect(10,25,176,99)
    s.text(10,133.8,'What happens in this scene?',8.5,True); s.rect(10,135,176,52); s.text(12,140,prompt,7,col=HINT)
    for i in range(4): s.line(13,152.5+i*10.5,183,152.5+i*10.5)
    s.text(196,27.8,'Who is in this scene?',8.5,True)
    for i in range(6): s.tick(196+(i%3)*12,30+(i//3)*8,str(i+1),5.5,9)
    s.lists(196,62,43,7.5,5.5,9)
    s.text(196,119.5,'Tips',8.5,True)
    for i,t in enumerate(tips): s.text(196,124.5+i*4.4,'• '+t,7.5,col=HINT)
    s.text(196,141,'Sounds in this scene',8.5,True); s.rect(196,142.2,91,44.8)
    s.text(198,147.5,'Background sounds',8,True); s.text(229,147.5,'(like birds, traffic, a crowd)',6.5,col=HINT)
    for i in range(2): s.line(199,154.5+i*6.5,284,154.5+i*6.5)
    s.line(196,164.6,287,164.6,col=GREY,lw=.4)
    s.text(198,170,'Sound effects',8,True); s.text(219,170,'(like a door slam, a splash, "boing!")',6.5,col=HINT)
    for i in range(2): s.line(199,177+i*6.5,284,177+i*6.5)
    s.footer(key,'Tick one background sound and one music. Tick everyone who is in this scene.')

def make(path,title,pages):
    c=canvas.Canvas(path,pagesize=(W*mm,H*mm)); c.setTitle(title); s=Sheet(c)
    for p in pages: p(s); c.showPage()
    c.save()

make('templates/cutout-template-A4.pdf','Cutout Animator scene template',[scene_sheet])
make('templates/story-template-A4.pdf','Cutout Animator story template',[cast_page]+[(lambda s,k=k:stage_page(s,k)) for k in (0,1,2,2,3)])  # two What happens next pages by default
print('ok')
