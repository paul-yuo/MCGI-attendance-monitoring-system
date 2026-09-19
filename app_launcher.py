"""
MCGI PRODUCTION MONITORING SYSTEM - Native Desktop Application Launcher
Starts the local server and launches the app in standalone native app mode.
Sets the Windows taskbar icon explicitly so it matches app_icon.ico (not the browser favicon).
"""
import os
import sys
import time
import ctypes
import socket
import struct
import threading
import subprocess
import http.server
import socketserver

PORT        = 8080
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ICON_PATH   = os.path.join(PROJECT_DIR, 'app_icon.ico')
APP_ID      = 'MCGI.Production.Attendance.System.1.0'

# ─── HTTP Server ─────────────────────────────────────────────────────────────

class NoCacheHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma',        'no-cache')
        self.send_header('Expires',       '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass   # suppress noisy output in app mode

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_server(port):
    with socketserver.TCPServer(('127.0.0.1', port), NoCacheHTTPHandler) as httpd:
        httpd.serve_forever()

# ─── Browser Finder ──────────────────────────────────────────────────────────

def find_browser_app_executable():
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None

# ─── Windows AppUserModelID ───────────────────────────────────────────────────

def set_app_user_model_id():
    """
    Tells Windows to group this process under our app ID.
    Combined with the matching AppUserModelID on the shortcut, Windows will
    use the shortcut's .ico instead of the browser's favicon for the taskbar.
    """
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)
    except Exception:
        pass

# ─── Taskbar Icon Injector ─────────────────────────────────────────────────────

def inject_icon_into_browser_windows(icon_path, retries=12, delay=1.0):
    """
    After the browser launches, find all its top-level windows and forcefully
    set their small-icon (taskbar icon) to our crisp app_icon.ico using
    WM_SETICON. Retries until the window appears or gives up.
    """
    if not os.path.exists(icon_path):
        return

    # Load the .ico as a HICON at the exact system small-icon size
    SM_CXSMICON = ctypes.windll.user32.GetSystemMetrics(49)
    SM_CYSMICON = ctypes.windll.user32.GetSystemMetrics(50)

    IMAGE_ICON   = 1
    LR_LOADFROMFILE  = 0x00000010
    LR_DEFAULTSIZE   = 0x00000040

    # Load small icon (taskbar size)
    hicon_small = ctypes.windll.user32.LoadImageW(
        None,
        icon_path,
        IMAGE_ICON,
        SM_CXSMICON,
        SM_CYSMICON,
        LR_LOADFROMFILE
    )
    # Load big icon (alt-tab / title bar)
    hicon_big = ctypes.windll.user32.LoadImageW(
        None,
        icon_path,
        IMAGE_ICON,
        0, 0,
        LR_LOADFROMFILE | LR_DEFAULTSIZE
    )

    if not hicon_small or not hicon_big:
        return

    WM_SETICON  = 0x0080
    ICON_SMALL  = 0
    ICON_BIG    = 1
    GW_OWNER    = 4

    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

    injected = []

    def set_icon_if_browser(hwnd, _):
        # Only target top-level windows with no owner (i.e. real app windows)
        if ctypes.windll.user32.GetWindow(hwnd, GW_OWNER) != 0:
            return True
        if not ctypes.windll.user32.IsWindowVisible(hwnd):
            return True
        buf = ctypes.create_unicode_buffer(260)
        ctypes.windll.user32.GetClassNameW(hwnd, buf, 260)
        class_name = buf.value
        # Edge/Chrome app window class names
        if class_name in ('Chrome_WidgetWin_1', 'Chrome_WidgetWin_0',
                          'MicrosoftEdge_0', 'BrowserWindowClass'):
            ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon_small)
            ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG,   hicon_big)
            injected.append(hwnd)
        return True

    for attempt in range(retries):
        time.sleep(delay)
        ctypes.windll.user32.EnumWindows(EnumWindowsProc(set_icon_if_browser), 0)
        if injected:
            break   # success

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    set_app_user_model_id()
    os.chdir(PROJECT_DIR)

    # Always launch at the Three-Card Selection Screen
    app_url = f'http://localhost:{PORT}/login.html'

    # Start HTTP server if not already running
    if not is_port_in_use(PORT):
        t = threading.Thread(target=start_server, args=(PORT,), daemon=True)
        t.start()
        time.sleep(0.4)

    browser_exe  = find_browser_app_executable()
    user_data_dir = os.path.join(os.environ.get('TEMP', r'C:\Temp'), 'MCGI_Prod_Desktop_Profile')

    if browser_exe:
        cmd = [
            browser_exe,
            f'--app={app_url}',
            f'--user-data-dir={user_data_dir}',
            '--disable-extensions',
            '--disable-plugins',
        ]

        # Start browser, then immediately inject our crisp icon into its window
        proc = subprocess.Popen(cmd)

        # Run icon injection in background thread so we don't block
        injector = threading.Thread(
            target=inject_icon_into_browser_windows,
            args=(ICON_PATH,),
            daemon=True
        )
        injector.start()

        proc.wait()   # wait for the browser window to close
    else:
        import webbrowser
        webbrowser.open(app_url)
        # Keep server alive while browser is open
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    main()
