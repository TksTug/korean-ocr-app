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
        if (lower.includes("time_numbers") || lower.includes("số") || lower.includes("ngày")) 
            return "⏰ Thời gian & Con số";
        if (lower.includes("daily_family") || lower.includes("gia đình")) 
            return "🏠 Gia đình & Đời sống";
        if (lower.includes("daily") || lower.includes("sinh hoạt") || lower.includes("일상")) 
            return "⏰ Đời sống & Thời gian";
        if (lower.includes("food_dining") || lower.includes("food") || lower.includes("ẩm thực") || lower.includes("음식")) 
            return "🍽️ Ẩm thực & Ăn uống";
        if (lower.includes("weather_nature") || lower.includes("weather") || lower.includes("thời tiết") || lower.includes("날씨")) 
            return "🌤️ Thời tiết & Tự nhiên";
        if (lower.includes("transport") || lower.includes("giao thông") || lower.includes("교통")) 
            return "🚗 Giao thông & Phương tiện";
        if (lower.includes("shopping") || lower.includes("mua sắm") || lower.includes("쇼핑")) 
            return "🛍️ Mua sắm & Giá cả";
        if (lower.includes("school") || lower.includes("giáo dục") || lower.includes("trường")) 
            return "🏫 Trường học & Giáo dục";
        if (lower.includes("work_business") || lower.includes("work") || lower.includes("công việc") || lower.includes("직장")) 
            return "💼 Công sở & Kinh tế";
        if (lower.includes("travel_leisure") || lower.includes("travel") || lower.includes("du lịch")) 
            return "🏖️ Du lịch & Giải trí";
        if (lower.includes("health_medical") || lower.includes("health") || lower.includes("y tế") || lower.includes("건강")) 
            return "🩺 Y tế & Sức khỏe";
        if (lower.includes("emotion_personality") || lower.includes("emotion") || lower.includes("cảm xúc")) 
            return "❤️ Cảm xúc & Tính cách";
        if (lower.includes("tech_media") || lower.includes("công nghệ")) 
            return "💻 Công nghệ & Truyền thông";
        if (lower.includes("law_society") || lower.includes("pháp luật")) 
            return "⚖️ Pháp luật & Xã hội";
        if (lower.includes("art_culture") || lower.includes("văn hóa")) 
            return "🎨 Nghệ thuật & Văn hóa";
        if (lower.includes("grammar_connectors") || lower.includes("ngữ pháp")) 
            return "🔗 Ngữ pháp & Từ nối";

        return topic;
    }
}

window.sheetExporter = new SheetExporter();
