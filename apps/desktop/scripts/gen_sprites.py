"""Generates pixel-art raven sprite sheets (idle/working/break) at 32x32,
built from drawn shapes (not a hand-typed character grid) so it reads
clearly as a bird: distinct head/beak, a folded wing, fanned tail
feathers, and thin legs -- previous smaller attempts read as a blob.
"""
import os

from PIL import Image, ImageDraw

SIZE = 32
TRANSPARENT = (0, 0, 0, 0)
BLACK = (24, 24, 27, 255)
GREY = (105, 105, 113, 255)         # folded wing
BEAK = (215, 215, 220, 255)          # slightly duller than pure white so it
LEG = (170, 170, 176, 255)           # doesn't melt into a white backdrop
EYE = (235, 235, 240, 255)           # only drawn while working

# The widget displays this sprite inside a white circular backdrop that's
# only slightly larger than the sprite's own bounding box (see widget css) --
# anything drawn near the edges of this 32x32 canvas pokes out past that
# circle at the corners. Shrinking+centering every coordinate through P()
# keeps a safety margin without having to re-tune each shape by hand.
MARGIN_SCALE = 0.78
MARGIN_OFFSET = SIZE * (1 - MARGIN_SCALE) / 2


def P(x, y):
    return (MARGIN_OFFSET + x * MARGIN_SCALE, MARGIN_OFFSET + y * MARGIN_SCALE)


def box(x0, y0, x1, y1):
    return (*P(x0, y0), *P(x1, y1))


def poly(*points):
    return [P(x, y) for x, y in points]


def draw_base(draw: ImageDraw.ImageDraw) -> None:
    # Tail: one solid tapered wedge (feathers converge to a single point),
    # angled down and back rather than straight out to the side.
    draw.polygon(poly((9, 16), (9, 29), (2, 31)), fill=BLACK)

    # Body: taller, less round torso.
    draw.ellipse(box(7, 9, 25, 29), fill=BLACK)
    # Head: overlaps the top-right of the body.
    draw.ellipse(box(11, 1, 26, 15), fill=BLACK)

    # Beak: triangle protruding from the head's right edge.
    draw.polygon(poly((23, 6), (30, 8), (23, 11)), fill=BEAK)

    # Wing: folded, an elongated teardrop rather than a circle.
    draw.polygon(poly((17, 12), (21, 14), (20, 21), (15, 25), (10, 21), (11, 14)), fill=GREY)

    # Legs + feet.
    draw.line((*P(13, 29), *P(13, 31)), fill=LEG, width=1)
    draw.line((*P(11, 31), *P(15, 31)), fill=LEG, width=1)
    draw.line((*P(20, 29), *P(20, 31)), fill=LEG, width=1)
    draw.line((*P(18, 31), *P(22, 31)), fill=LEG, width=1)


def make_frame(eye=False, y_shift=0, wing_flutter=False):
    canvas = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
    layer = Image.new("RGBA", (SIZE, SIZE), TRANSPARENT)
    draw_base(ImageDraw.Draw(layer))

    if wing_flutter:
        d = ImageDraw.Draw(layer)
        d.polygon(poly((9, 12), (2, 8), (10, 11)), fill=GREY)

    canvas.alpha_composite(layer, (0, y_shift))

    if eye:
        d = ImageDraw.Draw(canvas)
        ex, ey = P(19, 6)
        ey += y_shift * MARGIN_SCALE
        d.ellipse((ex, ey, ex + MARGIN_SCALE, ey + MARGIN_SCALE), fill=EYE)

    return canvas


def strip(frames):
    w = SIZE * len(frames)
    sheet = Image.new("RGBA", (w, SIZE), TRANSPARENT)
    for i, f in enumerate(frames):
        sheet.paste(f, (i * SIZE, 0), f)
    return sheet


out_dir = "src/assets/sprites/character"
os.makedirs(out_dir, exist_ok=True)

# idle (paused/stopped): no eyes -- only the working phase shows eyes
idle = strip([make_frame(eye=False), make_frame(eye=False)])
idle.save(f"{out_dir}/idle.png")

# working: subtle bob, eyes open (the only phase with eyes)
working = strip([make_frame(eye=True, y_shift=0), make_frame(eye=True, y_shift=1)])
working.save(f"{out_dir}/working.png")

# break: no eyes, a little wing flutter instead
brk = strip([make_frame(eye=False), make_frame(eye=False, wing_flutter=True)])
brk.save(f"{out_dir}/break.png")

print("done")
