# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the diarize sidecar (run from sidecars/diarize/).

block_cipher = None

a = Analysis(
    ['diarize.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'pyannote.audio',
        'torch',
        'soundfile',
        'sklearn.utils._weight_vector',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='diarize',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
