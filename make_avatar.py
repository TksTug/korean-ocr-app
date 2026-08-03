import os
import base64
from PIL import Image

src_jpg = r"C:\Users\PC\.gemini\antigravity\brain\f8f20fe6-d4e0-49eb-8f34-db4c6934f457\cute_cat_korean_avatar_1785742828930.jpg"
app_dir = r"C:\Users\PC\Downloads\yyy\korean-ocr-app"

img = Image.open(src_jpg)
img_small = img.resize((256, 256), Image.Resampling.LANCZOS)

# Save real valid GIF & PNG files
img_small.save(os.path.join(app_dir, "cat_avatar.gif"), format="GIF")
img_small.save(os.path.join(app_dir, "app_avatar.gif"), format="GIF")
img_small.save(os.path.join(app_dir, "cat_avatar.png"), format="PNG")
img_small.save(os.path.join(app_dir, "app_avatar.png"), format="PNG")

with open(os.path.join(app_dir, "cat_avatar.png"), "rb") as f:
    b64_str = "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")

js_path = os.path.join(app_dir, "js", "cat_avatar_base64.js")
with open(js_path, "w", encoding="utf-8") as js_f:
    js_f.write(f'window.DEFAULT_CAT_AVATAR_BASE64 = "{b64_str}";\n')

print("Base64 JS file created successfully at:", js_path)
