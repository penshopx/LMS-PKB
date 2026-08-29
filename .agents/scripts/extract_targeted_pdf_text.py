from pathlib import Path
import fitz

pdf = Path('attached_assets/2024pmpupr7_1788020600443.pdf')
doc = fitz.open(pdf)
for start, end, name in [(0, 14, 'regulation_pages_1_14.txt'), (14, 32, 'regulation_pages_15_32.txt')]:
    with open(Path('.agents/outputs/pdf_analysis') / name, 'w') as f:
        for i in range(start, min(end, len(doc))):
            f.write(f'\n===== PAGE {i+1} =====\n')
            f.write(doc[i].get_text('text') or '')
