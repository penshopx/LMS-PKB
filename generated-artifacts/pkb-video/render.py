"""Compose the approved 30-second PKB explainer from generated footage."""
from pathlib import Path
import json
import math
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H = 1280, 720
NAVY = (9, 29, 48)
BLUE = (124, 197, 255)
WHITE = (245, 249, 255)
MUTED = (188, 210, 230)
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REG, size)

def text(draw, xy, value, size, color=WHITE, bold=False):
    draw.text(xy, value, font=font(size, bold), fill=color)

def lines(draw, x, y, values, size, step, color=WHITE, bold=False):
    for index, value in enumerate(values):
        text(draw, (x, y + index * step), value, size, color, bold)

def background():
    image = Image.new("RGB", (W, H))
    pixels = image.load()
    for y in range(H):
        for x in range(W):
            glow = max(0, 1 - math.hypot((x - 1030) / 1050, (y - 300) / 780))
            pixels[x, y] = (int(9 + 7 * glow), int(29 + 24 * glow), int(48 + 34 * glow))
    draw = ImageDraw.Draw(image)
    for x in range(650, 1400, 76):
        draw.line((x, 110, x - 150, 720), fill=(26, 59, 86), width=1)
    for y in range(140, 800, 76):
        draw.line((620, y, 1280, y), fill=(26, 59, 86), width=1)
    for radius in (170, 245, 320):
        draw.ellipse((1080-radius, 310-radius, 1080+radius, 310+radius), outline=(32, 75, 107), width=2)
    return image

def logo():
    preview = Image.open(ROOT / "project-preview.jpg").convert("RGBA")
    icon = preview.crop((108, 12, 156, 60))
    mask = Image.new("L", (48, 48))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 47, 47), radius=12, fill=255)
    icon.putalpha(mask)
    return icon

def header(image):
    draw = ImageDraw.Draw(image)
    image.alpha_composite(logo(), (64, 45))
    text(draw, (127, 43), "PKB ASDAMKINDO", 23, WHITE, True)
    text(draw, (128, 76), "Kompetensi Teknik Konstruksi", 14, MUTED)
    draw.line((64, 119, 1216, 119), fill=(90, 150, 194, 70), width=1)
    text(draw, (986, 62), "BELAJAR BERKELANJUTAN", 13, BLUE, True)

def footer(image, phase):
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 630, W, H), fill=(*NAVY, 245))
    draw.line((64, 630, 1216, 630), fill=(61, 105, 140, 200), width=1)
    text(draw, (64, 650), "Acuan: Permen PUPR No. 12 Tahun 2021", 16, MUTED)
    text(draw, (64, 679), "Sertifikat kursus bukan SKK atau penetapan Angka Kredit resmi.", 16, MUTED)
    text(draw, (1153, 651), phase, 18, BLUE, True)

def scene_overlay(index, title, subtitle, eyebrow):
    image = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(image)
    for x in range(850):
        alpha = int(250 * max(0, 1 - max(0, x - 435) / 415))
        draw.line((x, 0, x, H), fill=(*NAVY, alpha))
    draw.rectangle((0, 0, W, 120), fill=(*NAVY, 195))
    header(image)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((64, 192, 112, 198), radius=3, fill=BLUE)
    text(draw, (64, 216), eyebrow, 16, BLUE, True)
    lines(draw, 61, 262, title, 43, 57, WHITE, True)
    lines(draw, 64, 468, subtitle, 21, 33, MUTED)
    footer(image, f"0{index} / 03")
    image.save(ROOT / f"overlay-{index}.png")

def prepare():
    background().save(ROOT / "background.png")
    intro = Image.new("RGBA", (W, H))
    header(intro)
    draw = ImageDraw.Draw(intro)
    text(draw, (64, 206), "PENGEMBANGAN KEPROFESIAN", 15, BLUE, True)
    text(draw, (61, 248), "PKB", 50, WHITE, True)
    text(draw, (60, 310), "ASDAMKINDO", 51, BLUE, True)
    lines(draw, 64, 399, ["Kompetensi Teknik", "Konstruksi"], 31, 43, WHITE, True)
    text(draw, (64, 521), "Belajar. Dokumentasikan. Berkembang.", 19, MUTED)
    preview = Image.open(ROOT / "project-preview.jpg").convert("RGBA").resize((576, 360), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", (604, 400), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((0, 0, 603, 399), radius=19, fill=(16, 48, 74, 250), outline=(76, 131, 173), width=2)
    for x in (18, 33, 48):
        sd.ellipse((x, 13, x+6, 19), fill=BLUE)
    shadow.alpha_composite(preview, (14, 29))
    intro.alpha_composite(shadow, (612, 189))
    intro.save(ROOT / "intro.png")
    scene_overlay(1, ["Belajar sesuai", "kebutuhan", "keahlian."], ["Pilih kursus dan jalur belajar", "untuk tenaga teknik konstruksi."], "01 / PEMBELAJARAN")
    scene_overlay(2, ["Dokumentasikan", "bukti", "pembelajaran."], ["Simpan catatan kegiatan", "dan hasil belajar Anda."], "02 / BUKTI PEMBELAJARAN")
    scene_overlay(3, ["Pantau progres.", "Berkembang", "bersama."], ["Peserta dan koordinator terhubung", "dalam kelompok PKB."], "03 / PROGRES DAN KOORDINASI")
    outro = Image.new("RGBA", (W, H))
    header(outro)
    draw = ImageDraw.Draw(outro)
    text(draw, (64, 201), "UNTUK TENAGA TEKNIK KONSTRUKSI", 17, BLUE, True)
    lines(draw, 60, 255, ["Terus belajar.", "Terus berkembang."], 60, 80, WHITE, True)
    draw.rounded_rectangle((64, 476, 520, 536), radius=12, fill=BLUE)
    text(draw, (88, 491), "Mulai belajar di PKB ASDAMKINDO", 20, NAVY, True)
    footer(outro, "PKB")
    outro.save(ROOT / "outro.png")
    (ROOT / "storyboard.json").write_text(json.dumps({
        "duration": 30, "resolution": "1280x720", "language": "id",
        "scenes": ["Identitas aplikasi", "Pembelajaran individu", "Dokumentasi bukti", "Pemantauan progres", "Ajakan belajar"],
        "audio": "Musik instrumental orisinal, tanpa narasi",
        "regulatory_note": "Sertifikat kursus bukan SKK atau penetapan Angka Kredit resmi.",
    }, ensure_ascii=False, indent=2))

def run(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)

def probe(path):
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))

def render():
    video_names = ["01-learning.mp4", "02-evidence.mp4", "03-progress.mp4"]
    for name in [*video_names, "music.mp3"]:
        metadata = probe(ROOT / name)
        print(name, metadata["format"]["duration"], flush=True)
    for index in range(5):
        duration = 3.6 if index in (0, 4) else 8
        if index in (0, 4):
            source = ["-loop", "1", "-framerate", "30", "-i", str(ROOT / "background.png")]
            overlay = "intro.png" if index == 0 else "outro.png"
            base_filter = "zoompan=z='1+0.00012*on':d=1:s=1280x720:fps=30,setsar=1"
        else:
            source = ["-i", str(ROOT / video_names[index-1])]
            overlay = f"overlay-{index}.png"
            base_filter = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,setsar=1"
        filters = f"[0:v]{base_filter},setpts=PTS-STARTPTS[base];[1:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[title];[base][title]overlay=0:0:shortest=1,format=yuv420p[v]"
        run([*source, "-loop", "1", "-framerate", "30", "-i", str(ROOT / overlay),
             "-filter_complex_threads", "1", "-filter_complex", filters,
             "-map", "[v]", "-t", str(duration), "-an", "-c:v", "libx264",
             "-preset", "fast", "-crf", "20", "-threads", "2", str(ROOT / f"segment-{index}.mp4")])
        print(f"Rendered segment {index}", flush=True)
    sources = []
    for index in range(5):
        sources += ["-i", str(ROOT / f"segment-{index}.mp4")]
    sources += ["-i", str(ROOT / "music.mp3")]
    filters = ";".join(f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[v{i}]" for i in range(5))
    filters += ";[v0][v1]xfade=transition=fade:duration=0.3:offset=3.3[x1]"
    filters += ";[x1][v2]xfade=transition=fade:duration=0.3:offset=11[x2]"
    filters += ";[x2][v3]xfade=transition=fade:duration=0.3:offset=18.7[x3]"
    filters += ";[x3][v4]xfade=transition=fade:duration=0.3:offset=26.4,fade=t=out:st=29.4:d=0.6,format=yuv420p[v]"
    filters += ";[5:a]atrim=duration=30,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.5,afade=t=out:st=28.8:d=1.2[a]"
    run([*sources, "-filter_complex_threads", "1", "-filter_complex", filters,
         "-map", "[v]", "-map", "[a]", "-t", "30", "-r", "30",
         "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-threads", "2",
         "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart",
         str(ROOT / "PKB-ASDAMKINDO-30-detik-720p.mp4")])
    final = probe(ROOT / "PKB-ASDAMKINDO-30-detik-720p.mp4")
    (ROOT / "verification.json").write_text(json.dumps(final, indent=2))
    print("FINAL", final["format"]["duration"], flush=True)

prepare()
if "--prepare-only" not in sys.argv:
    render()
