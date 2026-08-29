from pathlib import Path
import fitz

root=Path('attached_assets'); out=Path('.agents/outputs/pdf_analysis/selected'); out.mkdir(parents=True, exist_ok=True)
for pdf in root.glob('*.pdf'):
    if '2024pmpupr7' in pdf.name: continue
    doc=fitz.open(pdf)
    for i in range(len(doc)):
        pix=doc[i].get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False)
        pix.save(out/f'{pdf.stem}_page_{i+1}.png')
