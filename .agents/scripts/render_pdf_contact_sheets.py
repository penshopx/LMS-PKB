from pathlib import Path
import fitz
from PIL import Image, ImageDraw

root = Path('attached_assets')
out = Path('.agents/outputs/pdf_analysis')
for pdf in root.glob('*.pdf'):
    doc = fitz.open(pdf)
    if len(doc) < 3:
        continue
    thumbs=[]
    for i in range(2, len(doc)):
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(0.45,0.45), alpha=False)
        im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
        im.thumbnail((260,340))
        thumbs.append((i+1,im))
    cols=3
    rows=(len(thumbs)+cols-1)//cols
    sheet=Image.new('RGB',(cols*280,rows*370),'white')
    draw=ImageDraw.Draw(sheet)
    for j,(page,im) in enumerate(thumbs):
        x=(j%cols)*280+10; y=(j//cols)*370+25
        sheet.paste(im,(x,y))
        draw.text((x,y-20),f'Page {page}',fill='black')
    path=out/f'{pdf.stem}_pages_3_end_contact.png'
    sheet.save(path)
    print(path, sheet.size)
