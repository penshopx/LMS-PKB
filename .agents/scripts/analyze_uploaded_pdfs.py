from pathlib import Path
import fitz
import re

root = Path('attached_assets')
out = Path('.agents/outputs/pdf_analysis')
keywords = ['LKUT', 'Laporan Kegiatan Usaha Tahunan', 'pembelajaran', 'pelatihan', 'SIAP', 'PUB ASPEKINDO', 'Permen', 'Peraturan Menteri']

for pdf in sorted(root.glob('*.pdf')):
    doc = fitz.open(pdf)
    print(f'=== {pdf.name} ===')
    print('pages:', doc.page_count, 'metadata:', doc.metadata)
    toc = doc.get_toc()
    print('toc_entries:', len(toc))
    for item in toc[:30]:
        print('TOC', item)
    for idx in [0, 1] if doc.page_count > 1 else [0]:
        pix = doc[idx].get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
        pix.save(out / f'{pdf.stem}_page_{idx+1}.png')
    hits = []
    for idx, page in enumerate(doc):
        text = page.get_text('text') or ''
        lower = text.lower()
        found = [kw for kw in keywords if kw.lower() in lower]
        if found:
            snippets = []
            for kw in found:
                pos = lower.find(kw.lower())
                snippet = re.sub(r'\s+', ' ', text[max(0, pos-100):pos+300]).strip()
                snippets.append(f'{kw}: {snippet}')
            hits.append((idx+1, snippets))
    print('keyword_hit_pages:', len(hits))
    for page_no, snippets in hits[:80]:
        print('PAGE', page_no)
        for snippet in snippets[:4]:
            print(' ', snippet)
    print()
