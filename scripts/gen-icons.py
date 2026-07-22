#!/usr/bin/env python3
"""Generate snowpub app icons: PNG / ICNS / ICO / favicon.

Design: WeChat-green rounded square + white snowflake (snow heritage + publish vibe).
"""
import os
import math
import shutil
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
# macOS Big Sur 规范：1024 画布上图标内容占约 824（~80%），外围留透明 padding
ICON_CONTENT = 824
ICON_OFFSET = (SIZE - ICON_CONTENT) // 2  # 100
OUT_PNG = 'build/icon.png'
OUT_ICNS = 'build/icon.icns'
OUT_ICO = 'build/icon.ico'
OUT_FAVICON = 'public/favicon.ico'

# WeChat green
GREEN = (7, 193, 96, 255)
GREEN_DARK = (6, 173, 86, 255)
WHITE = (255, 255, 255, 255)


def make_base(size: int) -> Image.Image:
    """Draw the icon at given size."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # macOS Big Sur: 图标内容占画布约 80%，居中放置
    content_size = int(size * ICON_CONTENT / SIZE)
    offset = (size - content_size) // 2

    # Rounded square background with subtle vertical gradient
    radius = int(content_size * 0.223)  # Apple squircle radius ≈ 22.3%
    grad = Image.new('RGBA', (content_size, content_size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grad)
    for y in range(content_size):
        t = y / content_size
        r = int(GREEN[0] * (1 - t) + GREEN_DARK[0] * t)
        g = int(GREEN[1] * (1 - t) + GREEN_DARK[1] * t)
        b = int(GREEN[2] * (1 - t) + GREEN_DARK[2] * t)
        gdraw.line([(0, y), (content_size, y)], fill=(r, g, b, 255))
    # Mask with rounded square
    mask = Image.new('L', (content_size, content_size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, content_size - 1, content_size - 1], radius=radius, fill=255)
    img.paste(grad, (offset, offset), mask)

    # ── 雪花绘制（基于 content 区域中心）──
    cx = size // 2
    cy = size // 2
    arm_len = int(content_size * 0.32)
    arm_width = max(int(content_size * 0.035), 6)
    branch_len = int(content_size * 0.13)
    branch_width = max(int(content_size * 0.022), 4)
    branch_at = 0.55

    for i in range(6):
        angle = i * 60
        rad = math.radians(angle)
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        x2 = cx + arm_len * cos_a
        y2 = cy + arm_len * sin_a
        draw.line([(cx, cy), (x2, y2)], fill=WHITE, width=arm_width, joint='curve')
        sx = cx + arm_len * branch_at * cos_a
        sy = cy + arm_len * branch_at * sin_a
        for sign in (-1, 1):
            ba = math.radians(angle + sign * 60)
            bx = sx + branch_len * math.cos(ba)
            by = sy + branch_len * math.sin(ba)
            draw.line([(sx, sy), (bx, by)], fill=WHITE, width=branch_width, joint='curve')

    # Center dot for visual weight
    dot_r = int(content_size * 0.045)
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=WHITE)

    return img


def main():
    os.makedirs('build', exist_ok=True)
    os.makedirs('public', exist_ok=True)

    base = make_base(SIZE)
    base.save(OUT_PNG)
    print(f'Wrote {OUT_PNG}')

    # ── macOS .icns via iconutil ──
    iconset = 'build/icon.iconset'
    if os.path.exists(iconset):
        shutil.rmtree(iconset)
    os.makedirs(iconset)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in sizes:
        im = make_base(s)
        im.save(f'{iconset}/icon_{s}x{s}.png')
        if s <= 512:
            im2 = make_base(s * 2)
            im2.save(f'{iconset}/icon_{s}x{s}@2x.png')
    ret = os.system(f'iconutil -c icns "{iconset}" -o "{OUT_ICNS}"')
    if ret == 0:
        print(f'Wrote {OUT_ICNS}')
    else:
        print(f'iconutil failed (ret={ret})')

    # ── Windows .ico via PIL ──
    ico_sizes = [16, 32, 48, 64, 128, 256]
    base.save(OUT_ICO, sizes=[(s, s) for s in ico_sizes])
    print(f'Wrote {OUT_ICO}')

    # ── Favicon ──
    base.save(OUT_FAVICON, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f'Wrote {OUT_FAVICON}')


if __name__ == '__main__':
    main()
