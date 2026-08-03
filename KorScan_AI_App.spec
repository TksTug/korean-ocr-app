# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\main_korscan.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\css', 'css'), ('C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\js', 'js'), ('C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\index.html', '.'), ('C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\app_avatar.gif', '.'), ('C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\cat_avatar.png', '.'), ('C:\\Users\\PC\\Downloads\\yyy\\korean-ocr-app\\korscan_vocab.json', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='KorScan_AI_App',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
