"""Generates the tray and app icons from the first frame of the working sprite,
on a white circular backdrop so the black sprite stays visible against a dark
desktop, wallpaper or taskbar. Run from apps/desktop after gen_sprites.py."""
import os

from PIL import Image, ImageDraw

SIZE = 32
src = Image.open("src/assets/sprites/character/working.png")  # has eyes, more expressive for an icon
frame = src.crop((0, 0, SIZE, SIZE))

backdrop = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(backdrop).ellipse((0, 0, SIZE - 1, SIZE - 1), fill=(250, 250, 250, 255))
icon = Image.alpha_composite(backdrop, frame)

out_dir = "src/assets/icons"
os.makedirs(out_dir, exist_ok=True)

icon.resize((32, 32), Image.NEAREST).save(f"{out_dir}/tray-icon.png")
icon.resize((512, 512), Image.NEAREST).save(f"{out_dir}/app-icon.png")

print("done")
