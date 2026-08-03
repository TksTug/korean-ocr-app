/**
 * KorScan AI - Google Sheet Exporter & Live Webhook Direct Sync Engine
 */

class SheetExporter {
    constructor() {
        this.webhookUrl = localStorage.getItem("KORSCAN_GSHEET_WEBHOOK_URL") || "";
    }

    setWebhookUrl(url) {
        const cleanUrl = (url || "").trim();
        if (cleanUrl.includes("docs.google.com/spreadsheets")) {
            throw new Error("⚠️ Bạn đang dán link xem Google Sheet trên trình duyệt (docs.google.com).\n\nVui lòng dán Link Web App thu được sau khi Deploy trên Apps Script (Link có đuôi /exec dạng: https://script.google.com/macros/s/.../exec)!");
        }
        if (cleanUrl && !cleanUrl.includes("script.google.com")) {
            throw new Error("⚠️ Link Webhook không hợp lệ. Link phải bắt đầu bằng: https://script.google.com/macros/s/.../exec");
        }
        this.webhookUrl = cleanUrl;
        localStorage.setItem("KORSCAN_GSHEET_WEBHOOK_URL", this.webhookUrl);
    }

    getWebhookUrl() {
        return this.webhookUrl;
    }

    /**
     * Live sync vocabulary directly into a fixed Google Sheet via Google Apps Script Webhook
     */
    async syncToLiveGoogleSheet(wordsList, progressCallback) {
        const url = this.getWebhookUrl();
        if (!url) {
            throw new Error("⚠️ Bạn chưa dán Link Webhook Google Sheet! Vui lòng bấm '🔗 Kết Nối Google Sheet' để dán link.");
        }

        if (!wordsList || wordsList.length === 0) {
            throw new Error("Không có từ vựng nào trong danh sách để đồng bộ!");
        }

        if (progressCallback) progressCallback(30, "Đang kết nối tới Google Sheet cố định...");

        const payload = wordsList.map(w => ({
            korean: w.korean,
            romaja: w.romaja,
            pos: w.pos || "Danh từ",
            vietnamese: w.vietnamese,
            topic: this.getTopicLabel(w.topic),
            example: w.example,
            date: w.date || new Date().toLocaleDateString('vi-VN')
        }));

        try {
            const resp = await fetch("/api/gsheet_sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    webhook_url: url,
                    words: payload
                })
            });

            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.error || "Lỗi đồng bộ Google Sheet.");
            }

            if (progressCallback) progressCallback(100, "Đã gửi dữ liệu sang Google Sheet thành công!");
            return true;
        } catch (err) {
            console.error("Lỗi đồng bộ Google Sheet:", err);
            throw new Error(err.message || "Lỗi kết nối đồng bộ Google Sheet.");
        }
    }

    exportToCSV(wordsList) {
        if (!wordsList || wordsList.length === 0) {
            alert("Không có từ vựng nào để xuất file!");
            return;
        }

        let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
        csvContent += "STT,Từ Tiếng Hàn,Phiên Âm Romaja,Từ Loại,Nghĩa Tiếng Việt,Nhóm Chủ Đề,Ví Dụ Mẫu,Ngày Thêm\n";

        wordsList.forEach((w, idx) => {
            const stt = idx + 1;
            const korean = `"${(w.korean || '').replace(/"/g, '""')}"`;
            const romaja = `"${(w.romaja || '').replace(/"/g, '""')}"`;
            const pos = `"${(w.pos || 'Danh từ').replace(/"/g, '""')}"`;
            const vietnamese = `"${(w.vietnamese || '').replace(/"/g, '""')}"`;
            const topic = `"${this.getTopicLabel(w.topic)}"`;
            const example = `"${(w.example || '').replace(/"/g, '""')}"`;
            const date = `"${(w.date || new Date().toLocaleDateString('vi-VN')).replace(/"/g, '""')}"`;
            csvContent += `${stt},${korean},${romaja},${pos},${vietnamese},${topic},${example},${date}\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `TuVung_TiengHan_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    copyForGoogleSheet(wordsList) {
        if (!wordsList || wordsList.length === 0) {
            alert("Không có từ vựng nào để copy!");
            return;
        }

        let tsvContent = "STT\tTừ Tiếng Hàn\tPhiên Âm Romaja\tTừ Loại\tNghĩa Tiếng Việt\tNhóm Chủ Đề\tVí Dụ Mẫu\tNgày Thêm\n";

        wordsList.forEach((w, idx) => {
            tsvContent += `${idx + 1}\t${w.korean || ''}\t${w.romaja || ''}\t${w.pos || 'Danh từ'}\t${w.vietnamese || ''}\t${this.getTopicLabel(w.topic)}\t${w.example || ''}\t${w.date || ''}\n`;
        });

        navigator.clipboard.writeText(tsvContent).then(() => {
            alert(`✅ Đã copy thành công toàn bộ ${wordsList.length} từ vựng!\n\nBây giờ bạn sang tab Google Sheet "Tài liệu Lil Tâm", nhấp chuột chọn ô A1 rồi bấm nút Ctrl + V để dán nhé!`);
        }).catch(err => {
            console.error("Lỗi copy:", err);
            alert("Không thể copy tự động, vui lòng kiểm tra quyền trình duyệt!");
        });
    }

    getTopicLabel(topic) {
        if (!topic) return "👋 Chào hỏi & Giới thiệu";
        const lower = topic.toLowerCase();
        
        if (lower.includes("greeting") || lower.includes("chào") || lower.includes("인사")) 
            return "👋 Chào hỏi & Giới thiệu";
        if (lower.includes("daily") || lower.includes("sinh hoạt") || lower.includes("thời gian") || lower.includes("일상")) 
            return "⏰ Đời sống & Thời gian";
        if (lower.includes("food") || lower.includes("ẩm thực") || lower.includes("ăn") || lower.includes("음식") || lower.includes("restaurant")) 
            return "🍽️ Ẩm thực & Ăn uống";
        if (lower.includes("weather") || lower.includes("thời tiết") || lower.includes("mùa") || lower.includes("날씨")) 
            return "🌤️ Thời tiết & Mùa màng";
        if (lower.includes("transport") || lower.includes("giao thông") || lower.includes("đường") || lower.includes("교통")) 
            return "🚗 Giao thông & Phương tiện";
        if (lower.includes("work") || lower.includes("công việc") || lower.includes("học") || lower.includes("직장")) 
            return "💼 Công việc & Học tập";
        if (lower.includes("shopping") || lower.includes("mua sắm") || lower.includes("쇼핑")) 
            return "🛍️ Mua sắm";
        if (lower.includes("health") || lower.includes("sức khỏe") || lower.includes("cảm xúc") || lower.includes("건강")) 
            return "💊 Sức khỏe & Cảm xúc";
        if (lower.includes("hobby") || lower.includes("sở thích") || lower.includes("giải trí") || lower.includes("취미")) 
            return "🎨 Sở thích & Giải trí";
        if (lower.includes("fruit") || lower.includes("trái cây") || lower.includes("hoa quả") || lower.includes("과일")) 
            return "🍎 Trái cây & Hoa quả";
        if (lower.includes("animal") || lower.includes("động vật") || lower.includes("thú cưng") || lower.includes("동물")) 
            return "🐾 Động vật & Thú cưng";
        if (lower.includes("other") || lower.includes("khác") || lower.includes("기타")) 
            return "💬 Chủ đề khác (기타)";

        return topic;
    }
}

window.sheetExporter = new SheetExporter();
