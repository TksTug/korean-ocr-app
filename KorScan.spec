# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\main_korscan.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\css', 'css'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\js', 'js'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\index.html', '.'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\app_logo.png', '.'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\app_logo.ico', '.'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\app_avatar.gif', '.'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\cat_avatar.png', '.'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\korscan_vocab.json', '.')],
    hiddenimports=['edge_tts', 'asyncio', 'PyQt6', 'PyQt6.QtCore', 'PyQt6.QtWidgets', 'PyQt6.QtWebEngineWidgets', 'PyQt6.QtWebEngineCore'],
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
    name='KorScan',
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
    icon=['C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\app_logo.ico'],
)
