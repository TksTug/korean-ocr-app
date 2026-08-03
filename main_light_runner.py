import sys
import os
import threading
import socket
import http.server
import urllib.request
import urllib.parse
import json
import webbrowser

try:
    import webview
    HAS_WEBVIEW = True
except Exception as e:
    HAS_WEBVIEW = False
    print(f"[KorScan AI] pywebview not available: {e}")

if getattr(sys, 'frozen', False):
    BUNDLE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(os.path.expanduser("~"), ".korscan_ai")
os.makedirs(DATA_DIR, exist_ok=True)
VOCAB_FILE = os.path.join(DATA_DIR, "korscan_vocab.json")

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

APP_PORT = find_free_port()

class KorScanEmbeddedHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BUNDLE_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/vocab":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            if os.path.exists(VOCAB_FILE):
                with open(VOCAB_FILE, "r", encoding="utf-8") as f:
                    self.wfile.write(f.read().encode("utf-8"))
            else:
                bundled_vocab = os.path.join(BUNDLE_DIR, "korscan_vocab.json")
                if os.path.exists(bundled_vocab):
                    with open(bundled_vocab, "r", encoding="utf-8") as f:
                        content = f.read()
                        with open(VOCAB_FILE, "w", encoding="utf-8") as wf:
                            wf.write(content)
                        self.wfile.write(content.encode("utf-8"))
                else:
                    self.wfile.write(b"[]")
            return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/vocab":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                with open(VOCAB_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return
        super().do_POST()

def start_embedded_server():
    server = http.server.HTTPServer(('127.0.0.1', APP_PORT), KorScanEmbeddedHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()

def main():
    start_embedded_server()
    app_url = f"http://127.0.0.1:{APP_PORT}/"
    icon_path = os.path.join(BUNDLE_DIR, "app_logo.ico")
    
    if HAS_WEBVIEW:
        try:
            window = webview.create_window(
                "KorScan AI - Bóc Tách Từ Vựng & Trợ Lý Học Tiếng Hàn",
                app_url,
                width=1280,
                height=800,
                min_size=(900, 650),
                resizable=True
            )
            webview.start(private_mode=False)
        except Exception as e:
            print(f"[KorScan AI] Webview error: {e}")
            webbrowser.open(app_url)
            threading.Event().wait()
    else:
        webbrowser.open(app_url)
        threading.Event().wait()

if __name__ == "__main__":
    main()
