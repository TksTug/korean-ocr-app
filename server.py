import os
import sys
import json
import urllib.request
import urllib.error
import http.server
import socketserver

PORT = 8088
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

VOCAB_FILE = os.path.join(SCRIPT_DIR, "korscan_vocab.json")

class KorScanHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent browser caching during local development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        req_path = self.path.split('?')[0]
        if req_path == "/api/vocab":
            if os.path.exists(VOCAB_FILE):
                try:
                    with open(VOCAB_FILE, "r", encoding="utf-8") as f:
                        words = json.load(f)
                        self.send_json_response(200, {"success": True, "words": words})
                        return
                except Exception as e:
                    print("Error reading vocab file:", e)
            self.send_json_response(200, {"success": True, "words": []})
            return

        if req_path in ["/", "/index.html", ""]:
            index_path = os.path.join(SCRIPT_DIR, "index.html")
            if os.path.exists(index_path):
                try:
                    with open(index_path, "r", encoding="utf-8") as f:
                        html_content = f.read()

                    initial_vocab_json = "[]"
                    if os.path.exists(VOCAB_FILE):
                        with open(VOCAB_FILE, "r", encoding="utf-8") as vf:
                            initial_vocab_json = vf.read().strip() or "[]"

                    injected_script = f"<script>window.INITIAL_VOCAB_LIST = {initial_vocab_json};</script>\n</head>"
                    html_content = html_content.replace("</head>", injected_script, 1)

                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    self.send_header('Pragma', 'no-cache')
                    self.send_header('Expires', '0')
                    self.end_headers()
                    self.wfile.write(html_content.encode("utf-8"))
                    return
                except Exception as e:
                    print("Error serving index.html:", e)

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/vocab":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                words = data.get("words", [])
                with open(VOCAB_FILE, "w", encoding="utf-8") as f:
                    json.dump(words, f, ensure_ascii=False, indent=2)
                self.send_json_response(200, {"success": True})
            except Exception as e:
                self.send_error_response(500, str(e))
            return

        if self.path == "/api/gsheet_sync":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                webhook_url = data.get("webhook_url", "").strip()
                words_payload = data.get("words", [])

                if not webhook_url or not webhook_url.startswith("https://script.google.com"):
                    self.send_error_response(400, "Link Webhook Google Apps Script không hợp lệ. Link phải bắt đầu bằng: https://script.google.com/macros/s/.../exec")
                    return

                req = urllib.request.Request(
                    webhook_url,
                    data=json.dumps(words_payload, ensure_ascii=False).encode('utf-8'),
                    headers={"Content-Type": "text/plain;charset=utf-8"},
                    method="POST"
                )

                with urllib.request.urlopen(req, timeout=20) as resp:
                    resp_text = resp.read().decode('utf-8')
                    if "<html" in resp_text.lower() or "accounts.google.com" in resp_text:
                        self.send_error_response(401, "⚠️ Lỗi Yêu Cầu Đăng Nhập từ Google: Vui lòng vào trang Apps Script ➔ Bấm Triển khai (Deploy) ➔ Triển khai mới (New deployment) ➔ Đặt ô 'Thực thi dưới danh nghĩa' (Execute as) thành 'Tôi' (Me) chứ KHÔNG chọn 'Người dùng'!")
                        return

                    try:
                        resp_json = json.loads(resp_text)
                        if resp_json.get("result") == "error":
                            self.send_error_response(400, f"Lỗi từ Google Apps Script: {resp_json.get('error')}")
                            return
                    except Exception:
                        pass

                    self.send_json_response(200, {"success": True, "message": "Đã đồng bộ thành công sang Google Sheet!"})
            except urllib.error.HTTPError as e:
                if e.code in [401, 403]:
                    self.send_error_response(401, "⚠️ Lỗi 401/403 Quyền riêng tư Google: Vui lòng vào trang Apps Script ➔ Bấm Triển khai (Deploy) ➔ Triển khai mới (New deployment) ➔ Đặt 'Người có quyền truy cập' thành 'Tất cả mọi người' (Anyone)!")
                else:
                    self.send_error_response(e.code, f"Lỗi Google Apps Script ({e.code}): {e.reason}")
            except Exception as e:
                self.send_error_response(500, f"Lỗi đồng bộ Google Sheet: {str(e)}")
            return

        if self.path == "/api/scan":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                image_base64 = data.get("image_base64", "")
                api_key = data.get("api_key", "").strip() or os.getenv("GEMINI_API_KEY", "")

                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]

                prompt_text = """Bạn là chuyên gia OCR & Dịch thuật tiếng Hàn AI Vision.
Hãy đọc VÀ BÓC TÁCH CHÍNH XÁC TẤT CẢ các từ/cụm từ tiếng Hàn (Hangul) thực sự xuất hiện trong bức ảnh này.
YÊU CẦU QUAN TRỌNG:
1. Chỉ bóc tách ĐÚNG những từ thực tế có trong ảnh. Tuyệt đối KHÔNG được tự bịa ra từ khác không có trong ảnh.
2. Phân loại chủ đề ("topic") linh hoạt & thông minh:
   - Sử dụng các mã chủ đề quen thuộc như:
     "animal" (🐾 Động vật & Thú cưng), "food" (🍽️ Ẩm thực & Ăn uống), "greeting" (👋 Chào hỏi & Giới thiệu), 
     "daily" (⏰ Đời sống & Thời gian), "weather" (🌤️ Thời tiết & Mùa màng), "transport" (🚗 Giao thông & Phương tiện), 
     "work" (💼 Công việc & Học tập), "shopping" (🛍️ Mua sắm), "health" (💊 Sức khỏe & Cảm xúc), "hobby" (🎨 Sở thích & Giải trí).
   - ✨ ĐẶC BIỆT NẾU TỪ VỰNG THUỘC CHỦ ĐỀ MỚI: Nếu từ vựng không thuộc các nhóm trên (ví dụ: vũ trụ, thời trang, gia đình, công nghệ, âm nhạc, thể thao, luật pháp, y học...), BẠN HÃY TỰ ĐỘNG TẠO TÊN CHỦ ĐỀ MỚI KÈM ICON EMOJI ĐẸP MẮT (Ví dụ: "🚀 Vũ trụ & Thiên văn", "👗 Thời trang & Trang phục", "👨‍👩‍👧‍👦 Gia đình & Dòng họ", "💻 Công nghệ & Điện tử", "⚽ Thể thao", "🎵 Âm nhạc & Nghệ thuật"). Hạn chế tối đa việc chọn "Chủ đề khác".

3. Trả về duy nhất 1 JSON Array thuần túy (Array of Objects), KHÔNG kèm bất kỳ câu dẫn hay dấu markdown.
Mỗi phần tử trong mảng có cấu trúc:
{
  "korean": "Từ gốc tiếng Hàn trong ảnh",
  "romaja": "Phiên âm Romaja",
  "vietnamese": "Nghĩa tiếng Việt của từ đó",
  "pos": "Danh từ / Động từ / Tính từ / Trạng từ...",
  "topic": "Mã chủ đề hoặc Tên chủ đề mới tự tạo kèm Emoji (VD: 🚀 Vũ trụ & Thiên văn)",
  "example": "Ví dụ tiếng Hàn ngắn kèm dịch tiếng Việt"
}"""

                models = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"]
                last_err = ""
                parsed_words = None

                for model in models:
                    try:
                        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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
                            
                            clean_json_str = text_content.replace('```json', '').replace('```', '').strip()
                            print(f"[{model} Response]:", clean_json_str[:200])

                            try:
                                parsed = json.loads(clean_json_str)
                                if isinstance(parsed, list) and len(parsed) > 0:
                                    parsed_words = parsed
                                    break
                                elif isinstance(parsed, dict):
                                    for v in parsed.values():
                                        if isinstance(v, list) and len(v) > 0:
                                            parsed_words = v
                                            break
                                    if parsed_words:
                                        break
                            except Exception as parse_e:
                                print(f"Parse error for {model}: {parse_e}")
                    except urllib.error.HTTPError as e:
                        err_msg = e.read().decode('utf-8')
                        print(f"Gemini API HTTPError ({model}):", e.code, err_msg)
                        if e.code == 429:
                            last_err = "Google Gemini API đang bị giới hạn số lượt gọi miễn phí trong 1 phút (Free Tier Limit: 15 requests/phút). Vui lòng chờ 10 - 15 giây rồi bấm Quét lại!"
                            import time
                            time.sleep(2)
                        elif e.code == 401 or e.code == 403:
                            last_err = f"Lỗi xác thực API Key ({e.code}): Vui lòng kiểm tra lại Gemini API Key trên Google AI Studio."
                        else:
                            last_err = f"Google Gemini API Error ({e.code}): Vui lòng thử lại sau giây lát."
                    except Exception as e:
                        print(f"Model error ({model}):", str(e))
                        last_err = str(e)

                if parsed_words and len(parsed_words) > 0:
                    self.send_json_response(200, {"success": True, "words": parsed_words})
                else:
                    self.send_error_response(400, last_err or "Không trích xuất được từ vựng từ ảnh. Vui lòng kiểm tra độ rõ của ảnh hoặc API Key.")

            except Exception as e:
                print("Scan Error Exception:", str(e))
                self.send_error_response(500, f"Lỗi bóc tách ảnh: {str(e)}")
        else:
            self.send_error_response(404, "Endpoint không tồn tại")

    def send_json_response(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def send_error_response(self, code, message):
        self.send_json_response(code, {"success": False, "error": message})

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == "__main__":
    os.chdir(SCRIPT_DIR)
    ThreadingHTTPServer.allow_reuse_address = True
    print(f"Server started on http://localhost:{PORT}")
    with ThreadingHTTPServer(("", PORT), KorScanHTTPHandler) as httpd:
        httpd.serve_forever()
