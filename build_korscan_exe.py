import os
import sys
import subprocess

def build_exe():
    print("Building KorScan AI into a SINGLE standalone .exe file...")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(script_dir, "main_korscan.py")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        "--name", "KorScan_AI_App",
        "--add-data", f"{os.path.join(script_dir, 'css')};css",
        "--add-data", f"{os.path.join(script_dir, 'js')};js",
        "--add-data", f"{os.path.join(script_dir, 'index.html')};.",
        "--add-data", f"{os.path.join(script_dir, 'app_avatar.gif')};.",
        "--add-data", f"{os.path.join(script_dir, 'cat_avatar.png')};.",
        "--add-data", f"{os.path.join(script_dir, 'korscan_vocab.json')};.",
        "--clean",
        main_script
    ]

    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=script_dir)

    if result.returncode == 0:
        dist_exe = os.path.join(script_dir, "dist", "KorScan_AI_App.exe")
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        desktop_exe = os.path.join(desktop, "KorScan_AI_App.exe")
        
        subprocess.run(["cmd", "/c", "copy", "/y", dist_exe, desktop_exe])
        print(f"\nSUCCESS! Single file executable created at '{desktop_exe}'")
    else:
        print(f"\nBUILD FAILED with exit code: {result.returncode}")

if __name__ == "__main__":
    build_exe()
