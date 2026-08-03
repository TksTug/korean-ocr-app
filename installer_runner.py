import os
import sys
import shutil
import subprocess

def main():
    bundle_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(os.path.expanduser("~"), "AppData", "Local", "KorScanAI")
    os.makedirs(target_dir, exist_ok=True)

    src_exe = os.path.join(bundle_dir, "KorScan.exe")
    src_icon = os.path.join(bundle_dir, "app_logo.ico")

    target_exe = os.path.join(target_dir, "KorScan.exe")
    target_icon = os.path.join(target_dir, "app_logo.ico")

    if os.path.exists(src_exe):
        shutil.copy2(src_exe, target_exe)
    if os.path.exists(src_icon):
        shutil.copy2(src_icon, target_icon)

    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    shortcut_path = os.path.join(desktop, "KorScan AI.lnk")
    
    # Create Desktop shortcut via PowerShell
    ps_script = f"""
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
    $Shortcut.TargetPath = '{target_exe}'
    $Shortcut.WorkingDirectory = '{target_dir}'
    $Shortcut.IconLocation = '{target_icon}'
    $Shortcut.Save()
    """
    subprocess.run(["powershell", "-Command", ps_script], capture_output=True)

    # Launch app immediately for user
    subprocess.Popen([target_exe], cwd=target_dir)

if __name__ == "__main__":
    main()
