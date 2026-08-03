# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['installer_runner.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\dist\\KorScan.exe', '.'), ('C:\\Users\\vthan\\Desktop\\korean_ocr_app_SourceCode\\app_logo.ico', '.')],
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
    name='Setup_KorScan_AI',
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
