"""
MCGI Icon Generator - DPI-Aware, 8x Supersampled, Razor-Sharp
Generates exact-pixel-size frames for every Windows DPI scaling level.
"""
import os
from PIL import Image, ImageDraw, ImageFont

def get_bold_font(size):
    for font_path in [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\calibrib.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            continue
    return ImageFont.load_default()

def render_mcgi_icon(target_px):
    """
    Renders a crisp MCGI icon at exactly target_px x target_px.
    Uses 8x supersampling for sub-pixel precision, Lanczos downsampled.
    """
    SS = 8      # supersampling factor
    C  = target_px * SS   # canvas size in super-resolution

    img = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    # --- Tile background & gold border ---
    pad    = max(SS, int(C * 0.06))
    radius = int(C * 0.20)
    bw     = max(SS, int(C * 0.06))

    d.rounded_rectangle(
        [pad, pad, C - pad, C - pad],
        radius=radius,
        fill=(8, 8, 12, 255),
        outline=(245, 158, 11, 255),
        width=bw
    )

    # Subtle inner rim for depth
    inner_pad = pad + bw + max(1, int(C * 0.012))
    if inner_pad < C / 2:
        d.rounded_rectangle(
            [inner_pad, inner_pad, C - inner_pad, C - inner_pad],
            radius=max(2, radius - bw),
            outline=(251, 191, 36, 65),
            width=max(1, int(SS * 0.6))
        )

    # --- Fit 'MCGI' bold text tightly inside ---
    usable   = C - 2 * (pad + bw)
    target_w = usable * 0.84

    fs = int(C * 0.45)
    while fs > SS:
        f  = get_bold_font(fs)
        bb = d.textbbox((0, 0), "MCGI", font=f)
        if (bb[2] - bb[0]) <= target_w:
            break
        fs -= 1

    font = get_bold_font(fs)
    bb   = d.textbbox((0, 0), "MCGI", font=font)
    tw   = bb[2] - bb[0]
    th   = bb[3] - bb[1]

    # Optical center (shift up slightly so gold bar balances below)
    cx = C / 2
    cy = C / 2 - int(C * 0.03)
    tx = cx - tw / 2 - bb[0]
    ty = cy - th / 2 - bb[1]

    # Amber drop-shadow
    so = max(1, int(SS * 1.0))
    d.text((tx + so, ty + so), "MCGI", font=font, fill=(160, 70, 5, 220))
    # Brilliant white text
    d.text((tx, ty), "MCGI", font=font, fill=(255, 255, 255, 255))

    # --- Gold accent underline bar ---
    bar_w = int(tw * 0.90)
    bar_x = cx - bar_w / 2
    bar_y = ty + th + int(C * 0.055)
    bar_h = max(SS, int(C * 0.045))
    bottom_limit = C - pad - bw - int(C * 0.04)

    if bar_y + bar_h <= bottom_limit:
        d.rounded_rectangle(
            [bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
            radius=max(1, int(SS * 0.6)),
            fill=(251, 191, 36, 255)
        )

    # Lanczos downsample to exact target size
    return img.resize((target_px, target_px), Image.Resampling.LANCZOS)

def generate_all_icons():
    project_dir = os.path.dirname(os.path.abspath(__file__))

    # DPI-exact sizes covering 100%, 125%, 150%, 175%, 200% Windows scaling:
    #   Taskbar physical px:  16 (100%), 20 (125%), 24 (150%), 28 (175%), 32 (200%)
    #   App-mode taskbar px:  32 (100%), 40 (125%), 48 (150%), 56 (175%), 64 (200%)
    all_sizes = [512, 256, 192, 128, 64, 56, 48, 40, 32, 28, 24, 20, 16]
    rendered  = {}

    for s in all_sizes:
        rendered[s] = render_mcgi_icon(s)
        print(f"  Rendered {s}x{s}")

    # Individual PNG assets for HTML <link> tags
    rendered[512].save(os.path.join(project_dir, 'logo.png'),     format='PNG')
    rendered[192].save(os.path.join(project_dir, 'logo-192.png'), format='PNG')
    rendered[48].save( os.path.join(project_dir, 'logo-48.png'),  format='PNG')
    rendered[40].save( os.path.join(project_dir, 'logo-40.png'),  format='PNG')
    rendered[32].save( os.path.join(project_dir, 'logo-32.png'),  format='PNG')
    rendered[24].save( os.path.join(project_dir, 'logo-24.png'),  format='PNG')
    rendered[20].save( os.path.join(project_dir, 'logo-20.png'),  format='PNG')
    rendered[16].save( os.path.join(project_dir, 'logo-16.png'),  format='PNG')

    # Multi-resolution .ico – covers every Windows DPI slot
    ico_sizes  = [256, 128, 64, 56, 48, 40, 32, 28, 24, 20, 16]
    ico_images = [rendered[s] for s in ico_sizes]

    ico_path = os.path.join(project_dir, 'app_icon.ico')
    ico_images[0].save(
        ico_path, format='ICO',
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )

    favicon_path = os.path.join(project_dir, 'favicon.ico')
    ico_images[0].save(
        favicon_path, format='ICO',
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )

    print("\nAll DPI-exact icon frames generated successfully.")

if __name__ == '__main__':
    generate_all_icons()
