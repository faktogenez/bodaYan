"""
Генерация логотипа bodaYan Launcher с монограммой BDY.
Изометрический Minecraft-куб: трава сверху, земля по бокам,
на каждой грани — белая вставная панель с объёмной буквой (D/B/Y).
Вывод: assets/icon.png (512x512), assets/icon.ico (16..256), assets/logo.svg
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont

SIZE = 512
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT_DIR, exist_ok=True)

# Палитра
GRASS_GREEN = (90, 170, 60)
GRASS_DARK = (56, 120, 36)
GRASS_LIGHT = (130, 205, 85)
DIRT_BROWN = (134, 96, 67)
DIRT_DARK = (96, 66, 42)
DIRT_LIGHT = (160, 118, 82)
PANEL_WHITE = (245, 245, 240)
PANEL_SHADOW = (210, 210, 200)
PANEL_BORDER = (70, 50, 28)
LETTER_BROWN = (96, 62, 28)
LETTER_DARK = (58, 36, 14)
LETTER_LIGHT = (150, 100, 56)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

cx = SIZE // 2
cy = SIZE // 2 + 12
half = 148
top_h = 70

# Вершины граней куба
top = [
    (cx, cy - top_h - half),
    (cx + half, cy - top_h),
    (cx, cy - top_h + half),
    (cx - half, cy - top_h),
]
left_face = [
    (cx - half, cy - top_h),
    (cx, cy - top_h + half),
    (cx, cy + half),
    (cx - half, cy + half - top_h),
]
right_face = [
    (cx, cy - top_h + half),
    (cx + half, cy - top_h),
    (cx + half, cy + half - top_h),
    (cx, cy + half),
]

# Тень под кубом
shadow = [cx - half - 8, cy + half - top_h + 10,
          cx + half + 8, cy + half - top_h + 36]
draw.ellipse(shadow, fill=(0, 0, 0, 70))


def fill_polygon_with_texture(poly, base, dark, light, px=12, seed=1):
    """Залить многоугольник пиксельной текстурой (трава/земля)."""
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    tex = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    td = ImageDraw.Draw(tex)
    rng = random.Random(seed)
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    for y in range(int(min(ys)), int(max(ys)) + px, px):
        for x in range(int(min(xs)), int(max(xs)) + px, px):
            r = rng.random()
            if r < 0.22:
                c = dark
            elif r < 0.40:
                c = light
            else:
                c = base
            td.rectangle([x, y, x + px - 1, y + px - 1], fill=c)
    img.paste(tex, (0, 0), mask)


# Грани куба с текстурой
fill_polygon_with_texture(top, GRASS_GREEN, GRASS_DARK, GRASS_LIGHT, px=12, seed=7)
fill_polygon_with_texture(left_face, DIRT_BROWN, DIRT_DARK, DIRT_LIGHT, px=12, seed=11)
fill_polygon_with_texture(right_face, DIRT_BROWN, DIRT_DARK, DIRT_LIGHT, px=12, seed=13)

# Обводки граней
draw.polygon(top, outline=GRASS_DARK, width=3)
draw.polygon(left_face, outline=PANEL_BORDER, width=3)
draw.polygon(right_face, outline=PANEL_BORDER, width=3)


def inset_polygon(poly, inset):
    """Уменьшить многоугольник к центру на inset (приблизительно)."""
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    cpx = sum(xs) / len(xs)
    cpy = sum(ys) / len(ys)
    return [(cpx + (p[0] - cpx) * inset, cpy + (p[1] - cpy) * inset) for p in poly]


def draw_panel(poly, inset=0.58):
    """Нарисовать белую вставную панель на грани с лёгкой тенью."""
    inner = inset_polygon(poly, inset)
    # Тень панели (смещение вниз-вправо)
    shadow_inner = [(p[0] + 4, p[1] + 5) for p in inner]
    draw.polygon(shadow_inner, fill=(0, 0, 0, 60))
    # Сама панель
    draw.polygon(inner, fill=PANEL_WHITE)
    # Граница панели
    draw.polygon(inner, outline=PANEL_BORDER, width=3)
    # Внутренняя подсветка (сверху-слева) для объёма
    highlight = inset_polygon(inner, 0.96)
    draw.polygon(highlight, outline=(255, 255, 255, 120), width=1)
    return inner


def polygon_center(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def draw_3d_letter(text, center, font, fill=LETTER_BROWN, shadow=LETTER_DARK,
                   light=LETTER_LIGHT, depth=4):
    """Нарисовать букву с эффектом объёма (тень + световая кромка)."""
    cx0, cy0 = center
    # Тень (смещение вниз-вправо) — имитация выдавливания
    for i in range(depth, 0, -1):
        draw.text((cx0 + i, cy0 + i), text, font=font, fill=shadow, anchor="mm")
    # Световая кромка (сверху-слева)
    draw.text((cx0 - 1, cy0 - 1), text, font=font, fill=light, anchor="mm")
    # Основная буква
    draw.text((cx0, cy0), text, font=font, fill=fill, anchor="mm")


# Панели на каждой грани
top_panel = draw_panel(top, inset=0.50)
left_panel = draw_panel(left_face, inset=0.56)
right_panel = draw_panel(right_face, inset=0.56)

# Шрифты
try:
    font_path = "C:/Windows/Fonts/arialbd.ttf"
    font_side = ImageFont.truetype(font_path, 118)
    font_top = ImageFont.truetype(font_path, 92)
except Exception:
    font_side = ImageFont.load_default()
    font_top = ImageFont.load_default()

# Буквы: D (сверху), B (лево), Y (право)
draw_3d_letter("D", polygon_center(top_panel), font_top)
draw_3d_letter("B", polygon_center(left_panel), font_side)
draw_3d_letter("Y", polygon_center(right_panel), font_side)

# Сохранение PNG
png_path = os.path.join(OUT_DIR, "icon.png")
img.save(png_path, "PNG")
print(f"PNG: {png_path}")

# ICO (несколько размеров для разных разрешений экрана)
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_path = os.path.join(OUT_DIR, "icon.ico")
img.save(ico_path, format="ICO", sizes=ico_sizes)
print(f"ICO: {ico_path}")

# SVG-версия (векторная, без пиксельной текстуры — для чёткого масштабирования)
def svg_poly(poly):
    return " ".join(f"{p[0]:.1f},{p[1]:.1f}" for p in poly)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#82cd55"/>
      <stop offset="100%" stop-color="#5aa03c"/>
    </linearGradient>
    <linearGradient id="dirtLeft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9a6b47"/>
      <stop offset="100%" stop-color="#6e4a2c"/>
    </linearGradient>
    <linearGradient id="dirtRight" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8a5e3d"/>
      <stop offset="100%" stop-color="#604026"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e6e6e0"/>
    </linearGradient>
  </defs>
  <ellipse cx="256" cy="388" rx="156" ry="16" fill="rgba(0,0,0,0.28)"/>
  <polygon points="{svg_poly(top)}" fill="url(#grass)" stroke="{GRASS_DARK[0]:02x}{GRASS_DARK[1]:02x}{GRASS_DARK[2]:02x}" stroke-width="3"/>
  <polygon points="{svg_poly(left_face)}" fill="url(#dirtLeft)" stroke="{PANEL_BORDER[0]:02x}{PANEL_BORDER[1]:02x}{PANEL_BORDER[2]:02x}" stroke-width="3"/>
  <polygon points="{svg_poly(right_face)}" fill="url(#dirtRight)" stroke="{PANEL_BORDER[0]:02x}{PANEL_BORDER[1]:02x}{PANEL_BORDER[2]:02x}" stroke-width="3"/>
  <polygon points="{svg_poly(top_panel)}" fill="url(#panel)" stroke="{PANEL_BORDER[0]:02x}{PANEL_BORDER[1]:02x}{PANEL_BORDER[2]:02x}" stroke-width="3"/>
  <polygon points="{svg_poly(left_panel)}" fill="url(#panel)" stroke="{PANEL_BORDER[0]:02x}{PANEL_BORDER[1]:02x}{PANEL_BORDER[2]:02x}" stroke-width="3"/>
  <polygon points="{svg_poly(right_panel)}" fill="url(#panel)" stroke="{PANEL_BORDER[0]:02x}{PANEL_BORDER[1]:02x}{PANEL_BORDER[2]:02x}" stroke-width="3"/>
  <text x="{polygon_center(top_panel)[0]:.1f}" y="{polygon_center(top_panel)[1]+35:.1f}" font-family="Arial, sans-serif" font-size="92" font-weight="bold" fill="#603e1c" text-anchor="middle">D</text>
  <text x="{polygon_center(left_panel)[0]:.1f}" y="{polygon_center(left_panel)[1]+42:.1f}" font-family="Arial, sans-serif" font-size="118" font-weight="bold" fill="#603e1c" text-anchor="middle">B</text>
  <text x="{polygon_center(right_panel)[0]:.1f}" y="{polygon_center(right_panel)[1]+42:.1f}" font-family="Arial, sans-serif" font-size="118" font-weight="bold" fill="#603e1c" text-anchor="middle">Y</text>
</svg>'''
svg_path = os.path.join(OUT_DIR, "logo.svg")
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg)
print(f"SVG: {svg_path}")
print("Готово.")
