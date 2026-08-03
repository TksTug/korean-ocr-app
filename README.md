# 🇰🇷 KorScan AI - Quét Tiếng Hàn Viết Tay & Đồng Bộ Google Sheet

Ứng dụng web & công cụ máy tính tích hợp **Google Gemini AI Vision** giúp bóc tách chữ tiếng Hàn viết tay từ ảnh, dịch nghĩa tiếng Việt, phân loại Từ Loại & Chủ Đề linh hoạt, chấm điểm phát âm tiếng Hàn AI và tự động đồng bộ sang Google Sheet cố định.

---

## ✨ Tính Năng Nổi Bật

1. **📷 Quét Hàng Loạt Ảnh Chữ Hàn Viết Tay (Batch OCR)**:
   - Sử dụng công nghệ **Google Gemini AI Vision (gemini-flash-latest)** bóc tách 100% chữ viết tay thực tế.
   - Hỗ trợ chọn hoặc kéo thả nhiều ảnh vở cùng lúc để bóc tách hàng loạt.

2. **📌 Phân Loại Từ Loại & Chủ Đề Linh Hoạt**:
   - Nhận diện loại từ: Danh từ, Động từ, Tính từ, Phó từ, Trạng từ...
   - Tự động tạo nhóm chủ đề mới kèm Icon tương ứng (Y tế, Gia đình, Thời tiết, Công việc...).

3. **🎙️ Chấm Điểm Phát Âm Tiếng Hàn AI (Voice Coach)**:
   - Thu âm trực tiếp bằng Micro ➔ AI phân tích giọng nói và chấm điểm % phát âm chuẩn giọng Seoul.

4. **📊 Đồng Bộ 1-Click Sang Google Sheet Cố Định**:
   - Tích hợp Google Apps Script Webhook ➔ Đẩy toàn bộ danh sách từ vựng thẳng vào trang Google Sheet chỉ định 24/7.

5. **🎮 Mini-Game Nối Từ Hàn - Việt & 🎴 Thẻ Ôn Tập Flashcard**:
   - Trò chơi nối từ giải trí tính điểm và thời gian.
   - Bộ thẻ ôn tập thông minh hỗ trợ lật thẻ xem phiên âm & nghĩa tiếng Việt.

---

## 🛠️ Cấu Trúc Dự Án

- `index.html`: Giao diện ứng dụng web chuẩn Pastel Blue.
- `css/style.css`: Hệ thống giao diện responsive, glassmorphism cao cấp.
- `js/ocr_engine.js`: Bộ máy nhận diện ảnh Gemini Vision REST API.
- `js/ai_service.js`: Trợ lý Thầy giáo AI trò chuyện đa lượt (Multi-Turn Chatbot).
- `js/sheet_exporter.js`: Bộ máy xuất CSV & đồng bộ Google Sheet Webhook.
- `js/app.js`: Bộ điều khiển trung tâm (Store LocalStorage, Filter Chips, Mini-Game, Pronunciation Coach).
- `main_korscan.py`: Lớp vỏ ứng dụng PyQt6 WebEngine chạy trên máy tính.
- `build_korscan_exe.py`: Kịch bản PyInstaller đóng gói thành file `.exe` duy nhất.

---

## 🚀 Hướng Dẫn Chạy & Đóng Gói EXE

```bash
# Chạy Server Web thử nghiệm:
python -m http.server 8088

# Chạy ứng dụng máy tính PyQt6:
python main_korscan.py

# Đóng gói thành file KorScan_AI_App.exe duy nhất:
python build_korscan_exe.py
```
