import sys
import os
import threading
import socket
import http.server
import urllib.request
import urllib.parse
import json
import webbrowser
import io
import asyncio

try:
    from PyQt6.QtCore import QUrl
    from PyQt6.QtGui import QIcon
    from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    from PyQt6.QtWebEngineCore import QWebEngineSettings, QWebEngineProfile, QWebEnginePage
    HAS_PYQT = True
except Exception as e:
    HAS_PYQT = False
    print(f"[KorScan AI] PyQt6 not available: {e}")

# Determine bundle directory (PyInstaller _MEIPASS or current script dir)
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))

# Create persistent user data folder on user's hard drive
DATA_DIR = os.path.join(os.path.expanduser("~"), ".korscan_ai")
os.makedirs(DATA_DIR, exist_ok=True)
STORAGE_PATH = os.path.join(DATA_DIR, "web_profile")
os.makedirs(STORAGE_PATH, exist_ok=True)
VOCAB_FILE = os.path.join(DATA_DIR, "korscan_vocab.json")

# Find a free port for embedded server
def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

APP_PORT = find_free_port()

class KorScanEmbeddedHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress server logs

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]

        # ─── TTS Proxy: /api/tts?voice=female&text=... ───
        if path == '/api/tts':
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            voice = params.get('voice', ['female'])[0]
            text = params.get('text', [''])[0]
            if not text:
                self.send_response(400); self.end_headers(); return

            # ── Microsoft Neural TTS via edge-tts (miễn phí, giọng thật) ──
            # Nữ: ko-KR-SunHiNeural | Nam: ko-KR-InJoonNeural
            edge_voice = 'ko-KR-SunHiNeural' if voice == 'female' else 'ko-KR-InJoonNeural'

            try:
                import asyncio, io, tempfile, os as _os

                async def synthesize():
                    import edge_tts
                    communicate = edge_tts.Communicate(text, edge_voice)
                    buf = io.BytesIO()
                    async for chunk in communicate.stream():
                        if chunk['type'] == 'audio':
                            buf.write(chunk['data'])
                    return buf.getvalue()

                audio_data = asyncio.run(synthesize())

                if audio_data and len(audio_data) > 100:
                    self.send_response(200)
                    self.send_header('Content-Type', 'audio/mpeg')
                    self.send_header('Content-Length', str(len(audio_data)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(audio_data)
                    return
            except Exception as e_edge:
                print(f'[TTS] edge-tts error, falling back to Google: {e_edge}')

            # ── Fallback: Google TTS (female only) ──
            encoded = urllib.parse.quote(text)
            fallback_url = f'https://translate.google.com/translate_tts?ie=UTF-8&q={encoded}&tl=ko&client=tw-ob'
            try:
                req = urllib.request.Request(fallback_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://translate.google.com/',
                })
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = resp.read()
                    if len(data) > 100:
                        self.send_response(200)
                        self.send_header('Content-Type', 'audio/mpeg')
                        self.send_header('Content-Length', str(len(data)))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(data)
                        return
            except Exception:
                pass

            self.send_response(404); self.end_headers()
            return

        # ─── Vocab API ───
        if path == '/api/vocab':
            if os.path.exists(VOCAB_FILE):
                with open(VOCAB_FILE, 'r', encoding='utf-8') as f:
                    words = json.load(f)
                self._send_json(200, {'success': True, 'words': words})
            else:
                self._send_json(200, {'success': True, 'words': []})
            return

        # ─── Serve static files ───
        if path in ['/', '', '/index.html']:
            index_file = os.path.join(BUNDLE_DIR, 'index.html')
            try:
                with open(index_file, 'r', encoding='utf-8') as f:
                    html = f.read()

                # Inject vocab data
                vocab_json = '[]'
                if os.path.exists(VOCAB_FILE):
                    with open(VOCAB_FILE, 'r', encoding='utf-8') as vf:
                        vocab_json = vf.read().strip() or '[]'
                inject = f'<script>window.INITIAL_VOCAB_LIST = {vocab_json}; window.KORSCAN_TTS_PROXY = "http://localhost:{APP_PORT}/api/tts";</script>\n</head>'
                html = html.replace('</head>', inject, 1)

                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                self.wfile.write(html.encode('utf-8'))
                return
            except Exception as e:
                self.send_response(500); self.end_headers()
                return

        # Serve other static files (js, css, images)
        file_map = {
            '/css/': 'css',
            '/js/': 'js',
        }
        file_path = None
        if path.startswith('/css/') or path.startswith('/js/'):
            file_path = os.path.join(BUNDLE_DIR, path.lstrip('/'))
        elif '.' in path.split('/')[-1]:
            file_path = os.path.join(BUNDLE_DIR, path.lstrip('/'))

        if file_path and os.path.exists(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            mime = {
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.json': 'application/json',
                '.mp3': 'audio/mpeg',
            }.get(ext, 'application/octet-stream')
            with open(file_path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_response(404); self.end_headers()

    def do_POST(self):
        path = self.path.split('?')[0]
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        if path == '/api/vocab':
            try:
                data = json.loads(post_data.decode('utf-8'))
                words = data.get('words', [])
                with open(VOCAB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(words, f, ensure_ascii=False, indent=2)
                self._send_json(200, {'success': True})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        self._send_json(404, {'success': False, 'error': 'Not found'})

    def _send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)


def start_embedded_server():
    import socketserver
    class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    server = ThreadingServer(('127.0.0.1', APP_PORT), KorScanEmbeddedHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    print(f"[KorScan] Embedded server started on http://127.0.0.1:{APP_PORT}")


class KorScanMainWindow(QMainWindow):
    def __init__(self, app_instance):
        super().__init__()
        self.setWindowTitle("KorScan")
        self.resize(1280, 800)
        self.setMinimumSize(900, 650)

        icon_path = os.path.join(BUNDLE_DIR, "app_logo.ico")
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)

        self.web_view = QWebEngineView()

        # Configure Persistent Qt WebEngine Profile
        self.profile = QWebEngineProfile("KorScanPersistentProfile", app_instance)
        self.profile.setPersistentStoragePath(STORAGE_PATH)
        self.profile.setCachePath(STORAGE_PATH)
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)

        self.page = QWebEnginePage(self.profile, self.web_view)
        self.web_view.setPage(self.page)

        settings = self.page.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, True)

        # Load via embedded HTTP server (not file://) so audio requests work!
        self.web_view.setUrl(QUrl(f"http://127.0.0.1:{APP_PORT}/"))
        layout.addWidget(self.web_view)


def main():
    # Set Chromium GPU flags for ultra-smooth 60fps rendering without micro-stutters
    os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist"

    start_embedded_server()
    if HAS_PYQT:
        try:
            app = QApplication(sys.argv)
            window = KorScanMainWindow(app)
            window.show()
            sys.exit(app.exec())
        except Exception as e:
            print(f"[KorScan AI] PyQt Window failed: {e}. Opening in system browser...")
            webbrowser.open(f"http://127.0.0.1:{APP_PORT}/")
            threading.Event().wait()
    else:
        print(f"[KorScan AI] Opening on http://127.0.0.1:{APP_PORT}/ in system browser...")
        webbrowser.open(f"http://127.0.0.1:{APP_PORT}/")
        threading.Event().wait()

if __name__ == "__main__":
    main()
