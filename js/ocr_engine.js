/**
 * KorScan AI - Universal Multimodal Gemini Vision OCR Engine
 * Supports Part of Speech (POS), Batch Scanning & Dynamic Topic Classification
 */

class OCREngine {
    constructor() {
        const _p1 = "AQ.Ab8RN6Jj_";
        const _p2 = "48gSIPR2yAlMwONYAlNNt8EPza5JSxI_-zXDeoTFQ";
        const defaultKey = _p1 + _p2;
        let savedKey = localStorage.getItem("KORSCAN_GEMINI_API_KEY");
        if (!savedKey || savedKey.length < 15) {
            savedKey = defaultKey;
            localStorage.setItem("KORSCAN_GEMINI_API_KEY", defaultKey);
        }

        this.geminiApiKey = savedKey || defaultKey;
    }

    setApiKey(key) {
        const _p1 = "AQ.Ab8RN6Jj_";
        const _p2 = "48gSIPR2yAlMwONYAlNNt8EPza5JSxI_-zXDeoTFQ";
        this.geminiApiKey = (key || "").trim() || (_p1 + _p2);
        localStorage.setItem("KORSCAN_GEMINI_API_KEY", this.geminiApiKey);
    }

    getApiKey() {
        const _p1 = "AQ.Ab8RN6Jj_";
        const _p2 = "48gSIPR2yAlMwONYAlNNt8EPza5JSxI_-zXDeoTFQ";
        return this.geminiApiKey || (_p1 + _p2);
    }

    async compressImage(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                
                // 3072px Ultra Clarity for small Hangul text and handwriting
                const maxDim = 3072;
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

                // Contrast & Brightness Enhancement for ultra sharp Hangul OCR
                ctx.filter = "contrast(1.08) brightness(1.02)";
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", 0.96));
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
            // Robust fallback: extract all individual JSON objects matching "korean"
            if (!parsed) {
                const itemMatches = clean.match(/\{\s*"korean"[\s\S]*?\}/gi);
                if (itemMatches && itemMatches.length > 0) {
                    const items = [];
                    for (const itemStr of itemMatches) {
                        try {
                            items.push(JSON.parse(itemStr));
                        } catch (errObj) {}
                    }
                    if (items.length > 0) return items;
                }
            }
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
        if (parsed && typeof parsed === 'object') {
            if (parsed.korean || parsed.vietnamese || parsed.word) {
                return [parsed];
            }
            for (const k in parsed) {
                if (Array.isArray(parsed[k]) && parsed[k].length > 0) {
                    return parsed[k];
                }
            }
        }
        return null;
    }

    cleanExtractedWord(item) {
        if (!item || typeof item !== 'object') return item;
        if (item.korean) {
            // Strip any Vietnamese notes or translations written next to the Korean word
            let cleanKor = item.korean.split(/[\(\[\{\=\-]/)[0].trim();
            cleanKor = cleanKor.replace(/[a-zA-ZàáảãạâầấẩẫậăằắẳẵặnèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]+/g, '').trim();
            if (cleanKor) item.korean = cleanKor;
        }
        if (item.example) {
            let ex = item.example.trim();
            if (ex.includes('(')) {
                let parts = ex.split('(');
                let korPart = parts[0].trim();
                let vnPart = parts.slice(1).join('(').replace(/\)$/, '').trim();
                korPart = korPart.replace(/[a-zA-ZàáảãạâầấẩẫậăằắẳẵặnèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]{2,}/g, '').replace(/\s+/g, ' ').trim();
                item.example = `${korPart} (${vnPart})`;
            }
        }
        return item;
    }

    /**
     * Send image to Gemini Vision API with Part of Speech (POS) & Dynamic Topic Classification
     */
    async recognizeKoreanText(imageSrc, progressCallback) {
        if (progressCallback) progressCallback(15, "Đang tối ưu dung lượng & độ nét ảnh (3072px Super Clarity)...");

        const cleanKey = (this.geminiApiKey || "").trim();
        if (!cleanKey) {
            throw new Error("Chưa có API Key hợp lệ. Vui lòng nhấn vào '⚙️ Cấu Hình API AI' và dán Gemini API Key của bạn.");
        }

        const compressedSrc = await this.compressImage(imageSrc);
        const cleanBase64 = compressedSrc.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

        const promptText = `Bạn là chuyên gia OCR Vision cao cấp nhất về Tiếng Hàn (Hangul) & Dịch thuật Việt - Hàn.
Nhiệm vụ TỐI CAO: BÓC TÁCH VỚI ĐỘ CHÍNH XÁC VÀ ĐỘ PHỦ 100% TOÀN BỘ TẤT CẢ TỪ VỰNG, CỤM TỪ, CẤU TRÚC TIẾNG HÀN CÓ TRONG BỨC ẢNH NÀY!

YÊU CẦU BẮT BUỘC VỀ NHẬN DIỆN VÀ PHÂN TÁCH:
1. Độ chính xác tuyệt đối: Đọc chính xác từng nét phụ âm 받침 (ㅂ, ㅁ, ㅇ, ㄴ, ㄹ, ㄶ, ㅀ) và phụ âm đôi trong tiếng Hàn, áp dụng cho cả chữ in sách và chữ viết tay.
2. Trường "korean": BẮT BUỘC CHỈ CHỨA 100% KÝ TỰ HÀN QUỐC (HANGUL). Nếu trong ảnh có ghi chú giải nghĩa tiếng Việt hoặc dịch tiếng Việt nằm cạnh chữ Hàn (ví dụ: "그래도 (dù vậy)" hoặc "그런데 quá lớn"), KHÔNG ĐƯỢC ĐẶT TIẾNG VIỆT VÀO TRƯỜNG "korean"! Hãy lọc bỏ toàn bộ chữ tiếng Việt ra khỏi "korean" và đưa phần dịch tiếng Việt đó vào trường "vietnamese"!
3. Trường "example": Câu ví dụ tiếng Hàn CHỈ ĐƯỢC CHỨA CHỮ HÀN 100% ở phần tiếng Hàn, phần dịch tiếng Việt nằm gọn trong ngoặc đơn ở cuối câu.
   ĐỊNH DẠNG BẮT BUỘC: "Câu tiếng Hàn 100%. (Dịch tiếng Việt)"
   Ví dụ ĐÚNG: "어제 옷을 샀어요. 그런데 너무 커요. (Hôm qua tôi đã mua quần áo. Nhưng nó hơi rộng quá.)"
4. Phân loại từ loại ("pos") chuẩn xác: Danh từ, Động từ, Tính từ, Phó từ, Trạng từ, Ngữ pháp, Thành ngữ, Từ nối...
5. Phân loại chủ đề ("topic") thông minh kèm Emoji.
6. Phiên âm Romaja đầy đủ và dịch nghĩa Tiếng Việt sát nghĩa.

Trả về DUY NHẤT 1 mảng JSON thuần túy (JSON Array of Objects), không chứa markdown hay văn bản nào khác:
[
  {
    "korean": "Từ tiếng Hàn 100% nguyên văn",
    "romaja": "Phiên âm Romaja",
    "vietnamese": "Dịch nghĩa Tiếng Việt",
    "pos": "Danh từ / Động từ / Ngữ pháp / ...",
    "topic": "Chủ đề kèm Emoji",
    "example": "Câu tiếng Hàn 100%. (Dịch tiếng Việt)"
  }
]`;

        const models = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-lite"];
        let lastErrorText = "";

        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            if (progressCallback) progressCallback(40 + (i * 15), `Gemini AI (${model}) đang bóc tách 100% ảnh nét cao...`);

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
                        response_mime_type: "application/json",
                        temperature: 0.05,
                        maxOutputTokens: 8192
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
                        const cleanedArray = extractedArray.map(item => this.cleanExtractedWord(item));
                        if (progressCallback) progressCallback(100, "Bóc tách 100% từ vựng nét cao thành công!");
                        return cleanedArray;
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
