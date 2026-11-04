"""Extract the user-supplied regulatory references without touching app data."""

import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "docs" / "knowledge-base"
SOURCES = [
    (
        "PU-6-2025",
        "NEW_PK-2026-1._Implementasi_Permen_PU_6_OK_1793788070080.pdf",
        "permen-pu-6-2025",
        91,
        "d73f21bdf0432577b7d1daa7f1f7afc1c8a3217ef8b348cdc2f8283db4b60041",
    ),
    (
        "DAGRI-7-2024",
        "Permendagri_No_7_Tahun_2024_OCR_1793788377763.pdf",
        "permendagri-7-2024",
        140,
        "0d15baeb2bfeb2d245dbb2b2b00d72375630d74994103b5124aa74594f776a37",
    ),
]


def main():
    for tool in ("pdfinfo", "pdftotext"):
        if not shutil.which(tool):
            raise RuntimeError(f"Required Poppler utility unavailable: {tool}")

    # Validate every input before replacing any reference output.
    prepared = []
    for source_id, filename, slug, expected_pages, expected_hash in SOURCES:
        path = ROOT / "attached_assets" / filename
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        if digest != expected_hash:
            raise RuntimeError(f"Source changed; review identity first: {source_id}")
        info = subprocess.check_output(["pdfinfo", str(path)], text=True)
        match = re.search(r"^Pages:\s+(\d+)\s*$", info, re.MULTILINE)
        if not match or int(match.group(1)) != expected_pages:
            raise RuntimeError(f"Unexpected page count: {source_id}")
        text = subprocess.check_output(
            ["pdftotext", "-layout", "-enc", "UTF-8", str(path), "-"],
        ).decode("utf-8")
        pages = text.split("\f")
        if pages and not pages[-1].strip():
            pages.pop()
        if len(pages) != expected_pages:
            raise RuntimeError(f"Incomplete page extraction: {source_id}")
        prepared.append((source_id, filename, slug, digest, pages))

    (DEST / "extracted").mkdir(parents=True, exist_ok=True)
    manifest = []
    for source_id, filename, slug, digest, pages in prepared:
        relative = f"extracted/{slug}.txt"
        output = [
            f"SOURCE: {source_id}\nFILE: {filename}\n",
            "EKSTRAKSI TEKS SAJA — gambar dan tabel wajib diperiksa pada PDF.\n",
        ]
        for number, page in enumerate(pages, 1):
            output.append(f"\n=== HALAMAN PDF {number} ===\n{page.rstrip()}\n")
        (DEST / relative).write_text("".join(output), encoding="utf-8")
        manifest.append({
            "id": source_id,
            "original": f"attached_assets/{filename}",
            "sha256": digest,
            "pages": len(pages),
            "text": relative,
            "text_extraction_only": True,
            "pages_with_fewer_than_100_text_characters": [
                i for i, page in enumerate(pages, 1) if len(page.strip()) < 100
            ],
        })
    (DEST / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(manifest)} references with page markers.")


if __name__ == "__main__":
    main()
