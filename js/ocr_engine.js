/**
 * KorScan AI - Universal Multimodal Gemini Vision OCR Engine
 * Supports Part of Speech (POS), Batch Scanning & Dynamic Topic Classification
 */

class OCREngine {
    constructor() {
        const defaultKey = "";
        let savedKey = localStorage.getItem("KORSCAN_GEMINI_API_KEY");
        if (!savedKey || savedKey.length < 20) {
            savedKey = defaultKey;
            localStorage.setItem("KORSCAN_GEMINI_API_KEY", defaultKey);
        }

        this.geminiApiKey = savedKey;
    }

    setApiKey(key) {
        this.geminiApiKey = (key || "").trim();
        localStorage.setItem("KORSCAN_GEMINI_API_KEY", this.geminiApiKey);
    }

    getApiKey() {
        return this.geminiApiKey || "";
    }

    async compressImage(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                
                const maxDim = 1800;
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", 0.92));
            };
            img.onerror = () => resolve(imageSrc);
            img.src = imageSrc;
        });
    }

    extractArrayFromJSON(jsonText) {
        if (!jsonText) return null;
        let clean = jsonText.replace(/```json/gi, "").replace(/```/g, "").trim();
        let parsed = null;

        try {
            parsed = JSON.parse(clean);
        } catch (e) {
            const arrMatch = clean.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrMatch) {
                try { parsed = JSON.parse(arrMatch[0]); } catch (e2) {}
            }
            if (!parsed) {
                const objMatch = clean.match(/\{\s*"[\s\S]*\}\s*/);
                if (objMatch) {
                    try { parsed = JSON.parse(objMatch[0]); } catch (e3) {}
                }
            }
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
        if (parsed && typeof parsed === 'object') {
            for (const k in parsed) {
                if (Array.isArray(parsed[k]) && parsed[k].length > 0) {
                    return parsed[k];
                }
            }
        }
        return null;
    }

    /**
     * Send image to Gemini Vision API with Part of Speech (POS) & Dynamic Topic Classification
     */
    async recognizeKoreanText(imageSrc, progressCallback) {
        if (progressCallback) progressCallback(15, "Đang tối ưu dung lượng ảnh...");

        const cleanKey = (this.geminiApiKey || "").trim();
        if (!cleanKey) {
            throw new Error("Chưa có API Key hợp lệ. Vui lòng nhấn vào '⚙️ Cấu Hình API AI' và dán Gemini API Key của bạn.");
        }

        const compressedSrc = await this.compressImage(imageSrc);

        // Try backend proxy /api/scan first (handles CORS & API calls server-side)
        try {
            if (progressCallback) progressCallback(40, "Đang gửi ảnh tới AI Vision bóc tách 100%...");
            const backendResp = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_base64: compressedSrc,
                    api_key: cleanKey
                })
            });

            if (backendResp.ok) {
                const resData = await backendResp.json();
                if (resData.success && Array.isArray(resData.words) && resData.words.length > 0) {
                    if (progressCallback) progressCallback(100, "Bóc tách từ vựng thành công!");
                    return resData.words;
                } else if (!resData.success && resData.error) {
                    throw new Error(resData.error);
                }
            }
        } catch (backendErr) {
            console.warn("Backend /api/scan error, using client fetch fallback:", backendErr.message);
            if (backendErr.message.includes("API Key") || backendErr.message.includes("không trích xuất") || backendErr.message.includes("Google Gemini API Error")) {
                throw backendErr;
            }
        }

        const cleanBase64 = compressedSrc.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

        const promptText = `Bạn là hệ thống AI Vision bóc tách văn bản Tiếng Hàn (Hangul) chuyên nghiệp.
Nhiệm vụ duy nhất của bạn:
1. Đọc và bóc tách NGUYÊN VĂN TẤT CẢ các từ/cụm từ tiếng Hàn (Hangul) thực sự ghi trong bức ảnh này.
2. Phân loại chủ đề ("topic") linh hoạt & thông minh:
   - Sử dụng các mã chủ đề chuẩn như: "animal", "greeting", "daily", "food", "weather", "transport", "work", "shopping", "health", "hobby".
   - ✨ NẾU LÀ CHỦ ĐỀ MỚI (ví dụ: vũ trụ, thời trang, gia đình, công nghệ, thể thao...): BẠN HÃY TỰ ĐỘNG TẠO TÊN CHỦ ĐỀ MỚI KÈM ICON EMOJI (Ví dụ: "🚀 Vũ trụ & Thiên văn", "👗 Thời trang", "👨‍👩‍👧‍👦 Gia đình", "💻 Công nghệ", "⚽ Thể thao"). Hạn chế dùng "other".
3. Tuyệt đối KHÔNG tự tạo ra các từ không xuất hiện trong bức ảnh này.

Trả về DUY NHẤT 1 mảng JSON thuần túy (JSON Array):
[
  {
    "korean": "Từ tiếng Hàn nguyên văn trong ảnh",
    "romaja": "Phiên âm Romaja",
    "vietnamese": "Dịch nghĩa Tiếng Việt chuẩn xác",
    "pos": "Từ loại (Danh từ, Động từ, Tính từ, Phó từ...)",
    "topic": "greeting | daily | food | weather | transport | work | shopping | health | hobby",
    "example": "Câu ví dụ tiếng Hàn ngắn kèm dịch tiếng Việt"
  }
]`;

        const models = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"];
        let lastErrorText = "";

        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            if (progressCallback) progressCallback(40 + (i * 25), `Gemini AI đang bóc tách 100% ảnh thực...`);

            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
                const payload = {
                    contents: [{
                        parts: [
                            { text: promptText },
                            { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } }
                        ]
                    }],
                    generationConfig: {
                        response_mime_type: "application/json"
                    }
                };

                const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (resp.ok) {
                    const data = await resp.json();
                    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    console.log(`[Gemini OCR ${model} Output]:`, jsonText);

                    const extractedArray = this.extractArrayFromJSON(jsonText);
                    if (extractedArray && extractedArray.length > 0) {
                        if (progressCallback) progressCallback(100, "Bóc tách & Phân loại từ loại thành công!");
                        return extractedArray;
                    } else {
                        console.warn(`[Gemini OCR ${model}]: Không trích xuất được từ vựng từ JSON trả về.`);
                        lastErrorText = `AI đã nhận diện xong nhưng không tìm thấy danh sách từ vựng trong ảnh.`;
                    }
                } else {
                    const errData = await resp.text();
                    console.warn(`Lỗi Gemini API (${model} - ${resp.status}):`, errData);
                    
                    if (resp.status === 429) {
                        lastErrorText = "Tải lượt miễn phí Gemini API đang bị giới hạn số lượt quét trong 1 phút (Free Tier Limit). Vui lòng chờ 15-30 giây rồi bấm Quét lại!";
                        if (progressCallback) progressCallback(75, "Đang chờ 3s trước khi thử lại...");
                        await new Promise(r => setTimeout(r, 3200));
                    } else if (resp.status === 404) {
                        lastErrorText = "Lỗi kết nối mô hình AI. Vui lòng thử lại.";
                    } else {
                        lastErrorText = `Google API trả về mã lỗi HTTP ${resp.status}`;
                    }
                }
            } catch (err) {
                console.warn(`Lỗi kết nối ${model}:`, err);
                lastErrorText = "Hệ thống AI Vision đang bận. Vui lòng bấm Quét lại sau 15 giây.";
            }
        }

        throw new Error(lastErrorText || "Hệ thống AI Vision đang bận. Vui lòng thử lại sau 15 giây.");
    }
}

window.ocrEngine = new OCREngine();
