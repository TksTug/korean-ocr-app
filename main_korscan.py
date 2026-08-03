import sys
import os
import json
import urllib.request
import urllib.error
import http.server
import socketserver
import threading
from PyQt6.QtCore import QUrl
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PyQt6.QtWebEngineWidgets import QWebEngineView

PORT = 8089
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

class KorScanHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/scan":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                image_base64 = data.get("image_base64", "")
                api_key = data.get("api_key", "").strip() or os.getenv("GEMINI_API_KEY", "")

                # Clean Base64 prefix if present
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]

                prompt_text = """Bạn là chuyên gia OCR & Dịch thuật tiếng Hàn AI Vision.
Hãy đọc VÀ BÓC TÁCH CHÍNH XÁC TẤT CẢ các từ/cụm từ tiếng Hàn (Hangul) thực sự xuất hiện trong bức ảnh này.
YÊU CẦU QUAN TRỌNG:
1. Chỉ bóc tách ĐÚNG những từ thực tế có trong ảnh. Tuyệt đối KHÔNG được tự bịa ra từ khác không có trong ảnh.
2. Với mỗi từ đọc được, hãy phân loại chính xác vào 1 trong 9 chủ đề sau ("topic"):
   - "greeting": Chào hỏi và Giới thiệu bản thân (인사 및 자기소개)
   - "daily": Đời sống sinh hoạt và Thời gian (일상생활과 시간)
   - "food": Ẩm thực và Ăn uống (음식과 식사)
   - "weather": Thời tiết và Mùa màng (날씨와 계절)
   - "transport": Giao thông và Phương tiện đi lại (교통과 길 찾기)
   - "work": Công việc và Học tập (직장 및 학업)
   - "shopping": Mua sắm (쇼핑)
   - "health": Sức khỏe và Cảm xúc (건강과 감정)
   - "hobby": Sở thích và Giải trí (취미와 여가)
3. Trả về duy nhất 1 JSON Array thuần túy (Array of Objects), KHÔNG kèm bất kỳ câu dẫn hay dấu markdown.
Mỗi phần tử trong mảng có cấu trúc:
{
  "korean": "Từ gốc tiếng Hàn trong ảnh",
  "romaja": "Phiên âm Romaja",
  "vietnamese": "Nghĩa tiếng Việt của từ đó",
  "pos": "Danh từ / Động từ / Tính từ / Trạng từ...",
  "topic": "greeting | daily | food | weather | transport | work | shopping | health | hobby",
  "example": "Ví dụ tiếng Hàn ngắn kèm dịch tiếng Việt"
}"""

                # Call Google Gemini 1.5 Flash Vision REST API directly from Python (No CORS restrictions)
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
                
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [
                            {"text": prompt_text},
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": image_base64
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "response_mime_type": "application/json"
                    }
                }

                req_data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(gemini_url, data=req_data, headers={'Content-Type': 'application/json'})

                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_body = resp.read().decode('utf-8')
                    resp_json = json.loads(resp_body)
                    
                    text_content = resp_json.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    
                    # Clean markdown formatting if present
                    clean_json_str = text_content.replace('```json', '').replace('```', '').trim() if hasattr(text_content, 'trim') else text_content.replace('```json', '').replace('```', '').strip()
                    parsed_words = json.loads(clean_json_str)

                    self.send_json_response(200, {"success": True, "words": parsed_words})

            except urllib.error.HTTPError as e:
                err_msg = e.read().decode('utf-8')
                print("Gemini API Error:", e.code, err_msg)
                self.send_error_response(e.code, f"Lỗi từ Google Gemini API ({e.code}): Hãy kiểm tra lại API Key trên Google AI Studio.")
            except Exception as e:
                print("Scan Error Exception:", str(e))
                self.send_error_response(500, f"Lỗi bóc tách ảnh: {str(e)}")
        else:
            super().do_POST()

    def send_json_response(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def send_error_response(self, code, message):
        self.send_json_response(code, {"success": False, "error": message})

def start_server():
    os.chdir(SCRIPT_DIR)
    handler = KorScanHTTPHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        httpd.serve_forever()

class KorScanMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("KorScan AI - Quét Tiếng Hàn Viết Tay, Dịch & Phân Loại Sheet bằng Gemini AI Vision")
        self.resize(1280, 800)
        self.setMinimumSize(900, 650)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)

        self.web_view = QWebEngineView()
        self.web_view.setUrl(QUrl(f"http://localhost:{PORT}/index.html"))
        layout.addWidget(self.web_view)

def main():
    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    app = QApplication(sys.argv)
    window = KorScanMainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
