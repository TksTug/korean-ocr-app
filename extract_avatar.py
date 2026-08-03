import os
import re

appdata = os.path.expanduser("~\\AppData\\Local")
found_avatars = []

print("Scanning browser LocalStorage for KORSCAN_CUSTOM_AVATAR...")
for root, dirs, files in os.walk(appdata):
    for file in files:
        if file.endswith((".log", ".ldb", ".localstorage", ".sqlite")):
            path = os.path.join(root, file)
            try:
                with open(path, "rb") as f:
                    content = f.read()
                    if b"KORSCAN_CUSTOM_AVATAR" in content:
                        print("Found key in:", path)
                        matches = re.findall(b"data:image/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+", content)
                        for m in matches:
                            found_avatars.append(m.decode("utf-8"))
            except Exception:
                pass

print("FOUND AVATARS COUNT:", len(found_avatars))
if found_avatars:
    data_url = found_avatars[0]
    print("Exact Avatar DataURL length:", len(data_url))
    app_dir = r"C:\Users\PC\Downloads\yyy\korean-ocr-app"
    js_path = os.path.join(app_dir, "js", "cat_avatar_base64.js")
    with open(js_path, "w", encoding="utf-8") as js_f:
        js_f.write(f'window.DEFAULT_CAT_AVATAR_BASE64 = "{data_url}";\n')
    print("SUCCESS! Updated cat_avatar_base64.js with EXACT avatar used on localhost!")
else:
    print("No custom avatar key found in browser storage.")
