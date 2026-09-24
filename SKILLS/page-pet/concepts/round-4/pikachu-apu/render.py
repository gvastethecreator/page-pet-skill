"""Draw the compact electric-mouse concept without external image assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


SCALE = 3
SIZE = 1024
INK = "#191b18"
YELLOW = "#f2cf3e"
TAIL = "#d5ab27"
RED = "#ca6758"
CREAM = "#f7f0db"
BROWN = "#795344"

image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)


def point(x: float, y: float) -> tuple[int, int]:
    return round(x * SCALE), round(y * SCALE)


def curve(start: tuple[float, float], *segments: tuple[float, ...]) -> list[tuple[int, int]]:
    points = [point(*start)]
    x0, y0 = start
    for x1, y1, x2, y2, x3, y3 in segments:
        for i in range(1, 25):
            t = i / 24
            u = 1 - t
            x = u**3 * x0 + 3 * u**2 * t * x1 + 3 * u * t**2 * x2 + t**3 * x3
            y = u**3 * y0 + 3 * u**2 * t * y1 + 3 * u * t**2 * y2 + t**3 * y3
            points.append(point(x, y))
        x0, y0 = x3, y3
    return points


def shape(points: list[tuple[int, int]], fill: str, width: int = 17) -> None:
    draw.polygon(points, fill=fill)
    draw.line(points + [points[0]], fill=INK, width=width * SCALE, joint="curve")


def stroke(points: list[tuple[int, int]], color: str = INK, width: int = 11) -> None:
    draw.line(points, fill=color, width=width * SCALE, joint="curve")


def oval(box: tuple[int, int, int, int], fill: str, outline: str = INK, width: int = 12) -> None:
    draw.ellipse(tuple(v * SCALE for v in box), fill=fill, outline=outline, width=width * SCALE)


# The irregular lightning tail and ears sit behind the compact head/body mass.
shape([point(x, y) for x, y in [(679, 612), (749, 560), (738, 510), (872, 525),
                                 (818, 624), (864, 650), (712, 733), (647, 679)]], TAIL)
shape(curve((355, 325), (335, 253, 328, 180, 354, 106), (383, 70, 441, 228, 447, 338)), YELLOW)
shape(curve((572, 322), (612, 206, 677, 112, 713, 135), (738, 167, 690, 291, 650, 384)), YELLOW)

# Tips read as dark at icon size; one ear is deliberately bent.
shape(curve((350, 185), (348, 147, 350, 115, 354, 106), (369, 87, 391, 133, 408, 179),
            (394, 196, 373, 203, 350, 185)), INK, 1)
shape(curve((672, 200), (694, 148, 710, 125, 713, 135), (735, 155, 724, 197, 700, 230),
            (693, 215, 682, 205, 672, 200)), INK, 1)

# Tiny feet first, so the front silhouette hides their attachment.
shape(curve((392, 734), (380, 776, 364, 802, 367, 817), (384, 842, 449, 837, 471, 819),
            (481, 804, 475, 767, 462, 732)), YELLOW)
shape(curve((558, 738), (551, 785, 555, 810, 568, 821), (596, 843, 657, 831, 665, 813),
            (667, 787, 649, 752, 633, 723)), YELLOW)

# Broad, near-abstract body with no clothing or fine detail.
shape(curve((332, 326), (268, 375, 264, 502, 287, 574), (269, 679, 335, 767, 426, 786),
            (523, 822, 678, 793, 713, 698), (751, 616, 721, 507, 680, 408),
            (639, 302, 445, 272, 332, 326)), YELLOW, 21)

# Nubby arms keep the body readable when scaled down.
shape(curve((301, 572), (258, 578, 244, 638, 257, 665), (268, 686, 297, 670, 324, 642)), YELLOW, 15)
shape(curve((703, 584), (755, 573, 773, 627, 762, 656), (751, 681, 723, 665, 697, 642)), YELLOW, 15)

# Two forward-looking eyes beneath thick low lids, followed by broad resigned mouth.
oval((365, 430, 476, 522), CREAM, width=11)
oval((550, 427, 661, 519), CREAM, width=11)
oval((417, 468, 448, 505), INK, outline=INK, width=1)
oval((584, 466, 615, 503), INK, outline=INK, width=1)
stroke(curve((365, 464), (390, 440, 443, 438, 477, 457)), width=20)
stroke(curve((549, 457), (583, 437, 633, 439, 663, 463)), width=20)
oval((314, 535, 381, 591), RED, outline=INK, width=9)
oval((648, 535, 715, 591), RED, outline=INK, width=9)
oval((489, 529, 501, 541), INK, outline=INK, width=1)
oval((525, 529, 537, 541), INK, outline=INK, width=1)
shape(curve((400, 608), (447, 584, 483, 588, 512, 593), (554, 587, 587, 585, 625, 608),
            (602, 626, 554, 627, 511, 623), (459, 627, 415, 624, 400, 608)), BROWN, 10)
stroke(curve((411, 606), (474, 600, 548, 601, 614, 606)), width=8)

image.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(Path(__file__).with_name("reference.png"))
