"""Build the paused kit page's "See how it works" images and video from a
record-lvk.js run. Every image and the video carry a made-up-data stamp, so a
cropped screenshot still says it.
Usage: python3 scripts/make-kit-howto.py <record-lvk out dir>"""
import sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), "..", "public/local-validation/howto")
os.makedirs(out, exist_ok=True)
STAMP = "SAMPLE RUN · made-up data (800 fake encounters) · not validated · not for clinical use"
FONT = next(f for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"] if os.path.exists(f))
def stamp(img):
    d = ImageDraw.Draw(img); f = ImageFont.truetype(FONT, 20)
    d.rectangle([0, 0, img.width, 38], fill=(180, 83, 9))
    d.text((img.width // 2, 19), STAMP, font=f, fill="white", anchor="mm")
    d.rectangle([0, img.height - 38, img.width, img.height], fill=(180, 83, 9))
    d.text((img.width // 2, img.height - 19), STAMP, font=f, fill="white", anchor="mm")
    return img
shots = {"1-rules": 2, "2-workqueue": 9, "3-results": 12, "4-protocol": 15}
for name, i in shots.items():
    im = Image.open(os.path.join(src, f"frame-{i:03d}.png")).convert("RGB")
    im = im.crop((0, 0, im.width, im.height - 54))  # drop the replay caption bar
    stamp(im).save(os.path.join(out, name + ".jpg"), quality=82, optimize=True)
# Video: the full replay at 2.5x, stamped top and bottom (the bottom band sits
# above the replay's own caption bar, which stays: it narrates each step).
fp = FONT.replace(":", "\\:")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(src, "local-validation-kit.mp4"),
  "-vf", f"setpts=PTS/2.5,drawbox=x=0:y=0:w=iw:h=38:color=0xB45309:t=fill,"
         f"drawtext=fontfile={fp}:text='{STAMP.replace(':', chr(92)+':')}':fontcolor=white:fontsize=20:x=(w-tw)/2:y=10,"
         f"drawbox=x=0:y=ih-92:w=iw:h=38:color=0xB45309:t=fill,"
         f"drawtext=fontfile={fp}:text='{STAMP.replace(':', chr(92)+':')}':fontcolor=white:fontsize=20:x=(w-tw)/2:y=h-83",
  "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-movflags", "+faststart",
  os.path.join(out, "sample-run.mp4")], check=True)
Image.open(os.path.join(out, "1-rules.jpg")).save(os.path.join(out, "poster.jpg"), quality=70)
print("ok")
