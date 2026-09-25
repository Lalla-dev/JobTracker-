import os
from PIL import Image, ImageDraw

def create_icons():
    icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(icons_dir, exist_ok=True)
    
    # SVG Definition
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect x="8" y="8" width="112" height="112" rx="24" fill="#0f172a" />
  
  <!-- Briefcase Handle -->
  <path d="M48 42 V30 C48 24 53 20 60 20 H68 C75 20 80 24 80 30 V42" 
        fill="none" stroke="#60a5fa" stroke-width="8" stroke-linecap="round" />

  <!-- Briefcase Body -->
  <rect x="20" y="42" width="88" height="64" rx="14" fill="url(#bgGrad)" filter="url(#shadow)" />
  
  <!-- Horizontal seam -->
  <line x1="20" y1="62" x2="108" y2="62" stroke="#1e40af" stroke-width="3" opacity="0.8"/>

  <!-- Success Checkmark Badge -->
  <circle cx="64" cy="74" r="21" fill="#0f172a" />
  <path d="M54 74 L61 81 L75 67" 
        fill="none" stroke="url(#checkGrad)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>'''
    
    with open(os.path.join(icons_dir, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)
    print("Saved icon.svg")

    # Render PNGs at high supersampled resolution for sharpness
    sizes = [16, 48, 128]
    scale = 4  # 4x supersampling
    
    for size in sizes:
        dim = size * scale
        img = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Background dark rounded box
        bg_margin = int(dim * 0.06)
        radius = int(dim * 0.20)
        draw.rounded_rectangle(
            [bg_margin, bg_margin, dim - bg_margin, dim - bg_margin],
            radius=radius,
            fill=(15, 23, 42, 255)
        )
        
        # Briefcase handle (arc / box)
        h_left = int(dim * 0.36)
        h_right = int(dim * 0.64)
        h_top = int(dim * 0.16)
        h_bottom = int(dim * 0.38)
        h_stroke = max(2, int(dim * 0.065))
        
        draw.rounded_rectangle(
            [h_left, h_top, h_right, h_bottom],
            radius=max(2, int(dim * 0.08)),
            outline=(96, 165, 250, 255),
            width=h_stroke
        )
        # Clear out lower inside of handle so it connects into body
        draw.rectangle(
            [h_left + h_stroke, h_bottom - h_stroke, h_right - h_stroke, h_bottom + h_stroke * 2],
            fill=(15, 23, 42, 255)
        )
        
        # Briefcase body
        b_left = int(dim * 0.16)
        b_right = int(dim * 0.84)
        b_top = int(dim * 0.34)
        b_bottom = int(dim * 0.84)
        b_radius = max(2, int(dim * 0.11))
        
        draw.rounded_rectangle(
            [b_left, b_top, b_right, b_bottom],
            radius=b_radius,
            fill=(37, 99, 235, 255)
        )
        
        # Upper flap divider line
        line_y = int(dim * 0.50)
        draw.line([b_left, line_y, b_right, line_y], fill=(29, 78, 216, 255), width=max(1, int(dim * 0.025)))
        
        # Central Badge
        badge_r = int(dim * 0.17)
        cx, cy = dim // 2, int(dim * 0.59)
        draw.ellipse([cx - badge_r, cy - badge_r, cx + badge_r, cy + badge_r], fill=(15, 23, 42, 255))
        
        # Checkmark
        pts = [
            (int(cx - badge_r * 0.45), int(cy)),
            (int(cx - badge_r * 0.05), int(cy + badge_r * 0.45)),
            (int(cx + badge_r * 0.55), int(cy - badge_r * 0.35))
        ]
        chk_w = max(2, int(dim * 0.055))
        draw.line([pts[0], pts[1]], fill=(52, 211, 153, 255), width=chk_w)
        draw.line([pts[1], pts[2]], fill=(52, 211, 153, 255), width=chk_w)
        
        # Downsample with Lanczos for smooth antialiasing
        final_img = img.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(icons_dir, f"icon-{size}.png")
        final_img.save(out_path, "PNG")
        print(f"Generated {out_path} ({size}x{size})")

if __name__ == "__main__":
    create_icons()
