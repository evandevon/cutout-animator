#!/usr/bin/env python3
"""Draws templates/*.pdf. Numbers must match the layout at the top of template.js."""
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import black, white, HexColor
W,H=297,210
BG=(10,22,160,90); SCRIPT=(10,118,160,70)
CHARS=[(176,22,53,38),(234,22,53,38),(176,72,53,38),(234,72,53,38)]
COLS=[176,213,250]; rowy=lambda i:128+i*9.5
LISTS=[('Background sound',['Rain','Wind','Ocean','Forest']),('Music',['Happy','Adventure','Spooky','Sleepy']),('Sound effects',['Boing','Bam','Pop','Knock','Explosion','Zip'])]
GREY=HexColor('#b5b5b5'); TEXT=HexColor('#555555')
def make(path,size):
    k=size[0]/W; c=canvas.Canvas(path,pagesize=(size[0]*mm,size[1]*mm)); c.setTitle('Cutout Animator template')
    X=lambda x:x*k*mm; Y=lambda y:(H-y)*k*mm; S=lambda v:v*k*mm
    def rect(x,y,w,h,lw=.5):
        c.setStrokeColor(GREY); c.setLineWidth(lw*k*2.83); c.rect(X(x),Y(y+h),S(w),S(h),stroke=1,fill=0)
    def text(x,y,t,s=9,bold=False,col=TEXT):
        c.setFillColor(col); c.setFont('Helvetica-Bold' if bold else 'Helvetica',s*k); c.drawString(X(x),Y(y),t)
    for i,(cx,cy) in enumerate([(13,13),(284,13),(284,197),(13,197)]):
        c.setFillColor(black); c.rect(X(cx-5),Y(cy+5),S(10),S(10),stroke=0,fill=1)
        if i==0: c.setFillColor(white); c.rect(X(cx-2),Y(cy+2),S(4),S(4),stroke=0,fill=1)
    text(24,15,'Name: ______________________',11,True,black); text(120,15,'Scene: ______',11,True,black)
    text(165,15,'Use dark pens and bright colours. Stay inside the boxes.',8)
    text(10,20.8,'Background: draw the whole picture to the edges',8.5,True)
    rect(*BG); rect(*SCRIPT); text(10,116.8,'My script: what will you say?',8.5,True)
    for i,(x,y,w,h) in enumerate(CHARS):
        text(x,y-1.2,f'Character {i+1}',8.5,True); rect(x,y,w,h)
        for dx,lab in zip([0,13.5,27,40.5],['Sway','Hop','Float','Spin']):
            rect(x+dx,y+39.5,5,5,.7); text(x+dx+6,y+43.4,lab,7.5)
    for col,(title,items) in zip(COLS,LISTS):
        text(col,125,title,8.5,True)
        for i,t in enumerate(items):
            rect(col,rowy(i),6,6,.7); text(col+7.5,rowy(i)+4.6,t,9)
    text(24,200,'Tick the sounds you want. Tick how each character moves, or none to keep it still.',8)
    text(150,200,'evandevon.github.io/cutout-animator',8)
    c.showPage(); c.save()
make('templates/cutout-template-A4.pdf',(297,210))
