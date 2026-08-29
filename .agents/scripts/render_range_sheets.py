from pathlib import Path
import fitz
from PIL import Image, ImageDraw
root=Path('attached_assets'); out=Path('.agents/outputs/pdf_analysis/ranges'); out.mkdir(parents=True, exist_ok=True)
for pdf in root.glob('*.pdf'):
    if '2024pmpupr7' in pdf.name: continue
    doc=fitz.open(pdf)
    for start,end in [(2,7),(7,12),(12,15)]:
        pages=[]
        for i in range(start,min(end,len(doc))):
            pix=doc[i].get_pixmap(matrix=fitz.Matrix(1.0,1.0),alpha=False)
            im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
            im.thumbnail((700,500))
            pages.append((i+1,im))
        if not pages: continue
        cols=2; rows=(len(pages)+1)//2
        sheet=Image.new('RGB',(1440,rows*540),'white'); d=ImageDraw.Draw(sheet)
        for j,(p,im) in enumerate(pages):
            x=(j%cols)*720+10; y=(j//cols)*540+30
            sheet.paste(im,(x,y)); d.text((x,y-24),f'Page {p}',fill='black')
        sheet.save(out/f'{pdf.stem}_{start+1}_{end}.jpg',quality=90)
