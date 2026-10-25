"""Create ordered reading previews; originals are never modified."""
import json
import math
import os
import sys
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont


def build(items, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    previews, failures = [], []
    for item in items:
        try:
            with Image.open(item["file"]) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                width, height = image.size
                if width > 1600:
                    image = image.resize((1600, round(height * 1600 / width)))
                # Keep text legible by splitting tall images rather than shrinking them.
                step, overlap = 1900, 100
                starts = list(range(0, image.height, step - overlap)) if image.height > 2200 else [0]
                for part, top in enumerate(starts):
                    if top and image.height - top < overlap:
                        break
                    crop = image.crop((0, top, image.width, min(image.height, top + step))) if len(starts) > 1 else image.copy()
                    name = f"preview-{len(previews)+1:04d}.jpg"
                    crop.save(output / name, quality=92)
                    previews.append({**{k: v for k, v in item.items() if k != "file"}, "name": name,
                                     "part": part + 1, "cropTop": top, "originalWidth": width,
                                     "originalHeight": height, "width": crop.width, "height": crop.height})
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            failures.append({"resource": item.get("resource"), "error": type(error).__name__})
    sheets = []
    for offset in range(0, len(previews), 6):
        batch = previews[offset:offset+6]
        canvas = Image.new("RGB", (1800, 3 * 820), "#f1f0eb")
        draw = ImageDraw.Draw(canvas)
        for index, preview in enumerate(batch):
            x, y = (index % 2) * 900, (index // 2) * 820
            label = f'{offset+index+1:02d}  {preview["resource"]}  part {preview["part"]}'
            if "seconds" in preview:
                label += f'  t={preview["seconds"]:.2f}s'
            draw.text((x + 15, y + 10), label, fill="#222222", font=font)
            with Image.open(output / preview["name"]) as image:
                image.thumbnail((870, 760))
                canvas.paste(image, (x + (900-image.width)//2, y + 48 + (760-image.height)//2))
        name = f"sheet-{len(sheets)+1:03d}.jpg"
        canvas.save(output / name, quality=90)
        sheets.append({"name": name, "previews": [p["name"] for p in batch]})
    return {"previews": previews, "sheets": sheets, "failures": failures}


if __name__ == "__main__":
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    print(json.dumps(build(request["items"], request["output"]), ensure_ascii=False))
