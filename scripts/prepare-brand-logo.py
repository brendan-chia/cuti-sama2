"""Prepare the supplied artwork for the app without redrawing the logo."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'assets/images/yellow otter.png').convert('RGBA')
# Keep the otter's white map and face intact. Remove the neutral white canvas
# around the illustration and wordmark, including the counters in the letters.
pixels = source.load()
for y in range(source.height):
    for x in range(source.width):
        r, g, b, a = pixels[x, y]
        if 250 <= x <= 650 and 250 <= y <= 636:
            continue
        if min(r, g, b) >= 235 and max(r, g, b) - min(r, g, b) <= 12:
            pixels[x, y] = (r, g, b, 0)
source = source.crop(source.getbbox())
source.save(root / 'assets/images/yellow-otter-logo.png')
print(f'Prepared logo: {source.width} x {source.height}')
