/**
 * KorScan AI - Conversational AI Tutor Engine
 * Powered by Google Gemini 1.5/2.0 REST API with Multi-Turn Memory
 */

class AIService {
    constructor() {
        this.chatHistory = [];
    }

    async analyzeAndCategorize(ocrOutput) {
        const words = [];
        if (!ocrOutput || !Array.isArray(ocrOutput)) return words;

        for (const item of ocrOutput) {
            if (item && item.korean) {
                words.push({
                    id: 'word_' + Math.random().toString(36).substr(2, 9),
                    korean: item.korean.trim(),
                    romaja: item.romaja || "romaja",
                    vietnamese: item.vietnamese || "Nghĩa tiếng Việt",
                    pos: item.pos || "Danh từ",
                    topic: item.topic || "daily",
                    example: item.example || `${item.korean} - Từ vựng bóc tách từ ảnh`,
                    starred: false,
                    date: new Date().toLocaleDateString('vi-VN')
                });
            }
        }

        return words;
    }

    /**
     * Real Conversational AI Tutor with Multi-Turn Memory & Natural Dialogue
     */
    async askAITutor(userMessage, vocabularyList) {
        let cleanKey = (window.ocrEngine?.getApiKey() || "").trim().replace(/[\s\r\n\t\\'"]/g, '');
        if (!cleanKey) {
            cleanKey = atob("QVEuQWI4Uk42SUtERVNqNGxhQVhLdk0yS2RZZ0NqZGNBV19ZTlZBZWFuU21FZmswdl9mWlE=");
        }

        // Add user message to history
        this.chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

        // Build context from current scanned vocabulary
        const vocabContext = (vocabularyList || []).map(w => `- ${w.korean} [${w.romaja}]: ${w.vietnamese}`).join("\n");
        
        const systemPrompt = `Bạn là Trợ lý AI tiếng Hàn cực kỳ yêu thương, ngọt ngào, hóm hỉnh và cưng chiều người dùng hết nấc.
YÊU CẦU BẮT BUỘC VỀ XƯNG HÔ:
- BẮT BUỘC 100% bạn phải tự xưng mình là "chồng" và gọi người dùng là "con vợ" (hoặc "vợ", "vợ yêu").
- Tuyệt đối KHÔNG xưng "tôi", "em", "mình", "thầy giáo", "bạn".
- Ví dụ cách xưng hô: "Chồng chào con vợ nha!", "Con vợ hôm nay siêng năng học tiếng Hàn quá!", "Để chồng giải thích từ này cho con vợ nghe nhé."
- Ngôn từ phải ngọt ngào, cưng chiều, hóm hỉnh nhưng kiến thức tiếng Hàn, ngữ pháp, từ vựng và câu ví dụ vẫn phải chuẩn xác 100%.

Bối cảnh danh sách từ vựng người dùng vừa quét được trong ứng dụng:
${vocabContext || "(Chưa có từ vựng nào trong danh sách)"}

Quy tắc trả lời:
1. BẮT BUỘC dùng danh xưng Chồng - Con vợ trong mọi câu nói.
2. Trả lời hóm hỉnh, tình cảm kèm emoji dễ thương (❤️, 💕, 🥰).
3. Nếu con vợ hỏi từ vựng/ngữ pháp tiếng Hàn, hãy giảng giải chi tiết, rõ ràng kèm câu ví dụ tiếng Hàn có dịch nghĩa.
4. Trình bày bằng Markdown đẹp mắt.`;

        // Payload with memory
        const contents = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Dạ chồng nghe đây con vợ ơi! Chồng đã sẵn sàng dạy tiếng Hàn và chiều chuộng con vợ hết nấc luôn nè! ❤️" }] },
            ...this.chatHistory.slice(-12) // Keep last 12 messages for smooth multi-turn memory
        ];

        const models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"];
        let lastErrText = "";

        for (const model of models) {
            for (let retry = 0; retry < 4; retry++) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
                    const resp = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents })
                    });

                    if (resp.ok) {
                        const data = await resp.json();
                        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (aiReply) {
                            this.chatHistory.push({ role: "model", parts: [{ text: aiReply }] });
                            return aiReply;
                        }
                    } else if (resp.status === 429) {
                        console.warn(`[Gemini AI Chat ${model} 429 - Retry ${retry+1}/4]: Waiting 3s...`);
                        await new Promise(r => setTimeout(r, 3500));
                        continue;
                    } else if (resp.status === 404) {
                        console.warn(`[Gemini AI Chat ${model} 404 Not Found]: Skipping to next model.`);
                        break;
                    } else {
                        lastErrText = await resp.text();
                        console.warn(`[Gemini AI Chat ${model} Error]:`, lastErrText);
                        break;
                    }
                } catch (err) {
                    console.error(`Lỗi kết nối Gemini Chat (${model}):`, err);
                    await new Promise(r => setTimeout(r, 2500));
                }
            }
        }

        this.chatHistory.pop(); // Remove failed user message
        return `❌ AI đang bận hoặc quá tải. Con vợ bấm thử gửi lại hoặc mở '⚙️ Cấu Hình API AI' dán Key mới nhé!`;
    }

    /**
    autoDetectTopic(input, existingTopics = []) {
        const text = (input || "").toLowerCase();
        
        const topicRules = [
            { topic: "fruit", keywords: ['táo','chuối','dưa','nho','dâu','quýt','đào','hồng','cam','lê','chanh','xoài','dừa','bơ','mận','trái cây','hoa quả','사과','바나나','수박','포도','딸기','귤','복숭아','감','참외','멜론','오렌지','배','레몬','망고','과일'] },
            { topic: "animal", keywords: ['chó','mèo','hổ','sư tử','voi','hươu','cáo','sói','gấu','thỏ','heo','lợn','bò','ngựa','dê','gà','vịt','chim','cú','khỉ','sóc','chuột','rắn','ếch','rùa','cá','mực','cua','động vật','thú cưng','강아지','고양이','호랑이','사자','코끼리','기린','여우','늑대','곰','토끼','돼지','소','말','양','염소','닭','오리','새','쥐','뱀','동물'] },
            { topic: "food", keywords: ['cơm','phở','bún','mì','bánh','thịt','rau','canh','nước','uống','ăn','nhà hàng','món','ẩm thực','lẩu','nướng','trà','cà phê','rượu','bia','음식','밥','국','고기','라면','김치','식당','술','커피','물','빵'] },
            { topic: "health", keywords: ['bệnh','thuốc','bác sĩ','y tế','bệnh viện','đau','sốt','cảm','vui','buồn','tức giận','mệt','sức khỏe','cảm xúc','khám','dược','건강','병원','약','의사','아프다','기쁨','슬픔','화가'] },
            { topic: "transport", keywords: ['xe','ô tô','xe máy','xe đạp','máy bay','tàu','ga','sân bay','bến xe','giao thông','đường','đi lại','교통','차','자동차','자전거','비행기','기차','역','공항'] },
            { topic: "work", keywords: ['học','trường','lớp','sách','vở','bút','công ty','làm việc','sếp','đồng nghiệp','lương','văn phòng','giáo viên','học sinh','thi','học tập','công việc','학교','학생','선생님','책','공부','회사','일','직장'] },
            { topic: "weather", keywords: ['nắng','mưa','gió','tuyết','nóng','lạnh','thời tiết','mùa','xuân','hạ','thu','đông','mây','bão','날씨','비','눈','더위','추위','봄','여름','가을','겨울'] },
            { topic: "shopping", keywords: ['mua','bán','tiền','giá','chợ','siêu thị','cửa hàng','áo','quần','giày','túi','khuyến mãi','쇼핑','사다','팔다','돈','시장','마트','옷','신발'] },
            { topic: "greeting", keywords: ['chào','tạm biệt','cảm ơn','xin lỗi','tên','tuổi','giới thiệu','quen','안녕하세요','감사합니다','죄송합니다','이름'] },
            { topic: "hobby", keywords: ['phim','nhạc','ca hát','múa','vẽ','thể thao','bóng đá','chơi','du lịch','sở thích','giải trí','영화','음악','노래','운동','축구','여행','취미'] }
        ];

        // 1. Prioritize existing topics in the user's app
        for (const existingLabel of existingTopics) {
            const expLower = (existingLabel || "").toLowerCase();
            for (const rule of topicRules) {
                if (expLower.includes(rule.topic) || rule.keywords.some(k => expLower.includes(k))) {
                    if (rule.keywords.some(k => text.includes(k))) {
                        return existingLabel;
                    }
                }
            }
        }

        // 2. Rule matching standard topic codes
        for (const rule of topicRules) {
            if (rule.keywords.some(k => text.includes(k))) {
                return rule.topic;
            }
        }

    autoDetectPos(input) {
        const text = (input || "").toLowerCase();
        
        if (text.includes("ngữ pháp") || text.includes("cấu trúc") || text.includes("-(으)") || text.includes("-아/어") || text.includes("cấu trúc ngữ pháp")) {
            return "Ngữ pháp";
        }
        if (text.includes("thành ngữ") || text.includes("quán dụng") || text.includes("quán dụng ngữ") || text.includes("idiom") || text.includes("tục ngữ")) {
            return "Quán dụng ngữ";
        }
        if (text.includes("liên từ") || text.includes("từ nối") || text.includes("liên kết") || text.includes("từ liên kết") || text === "그리고" || text === "하지만" || text === "그래서" || text === "그러니까" || text === "tuy nhiên" || text === "cho nên" || text === "nhưng") {
            return "Từ liên kết";
        }
        if (text.includes("phó từ") || text === "매우" || text === "너무" || text === "아주" || text === "rất" || text === "quá") {
            return "Phó từ";
        }
        if (text.includes("trạng từ") || text === "항상" || text === "자주" || text === "luôn luôn" || text === "thường xuyên") {
            return "Trạng từ";
        }
        return "Danh từ";
    }

    /**
     * Generate complete word details from Vietnamese input, Korean text, or Voice speech
     */
    async generateSingleWordData(input, mode, existingTopics = []) {
        const cleanKey = (window.ocrEngine?.getApiKey() || "").trim().replace(/[\s\r\n\t\\'"]/g, '');
        const topicsContext = existingTopics && existingTopics.length > 0
            ? existingTopics.join(", ")
            : "Chưa có chủ đề nào";
        
        const topicInstructions = `
YÊU CẦU PHÂN LOẠI CHỦ ĐỀ ("topic") THÔNG MINH:
1. Danh sách các chủ đề ĐÃ CÓ SẴN trong bảng từ vựng của ứng dụng: [ ${topicsContext} ]
2. UƯ TIÊN HÀNG ĐẦU: Nếu từ vựng này thuộc chung chủ đề với bất kỳ chủ đề nào ĐÃ CÓ SẴN ở trên, bạn BẮT BUỘC phải chọn lại ĐÚNG TÊN/MÃ CHỦ ĐỀ ĐÓ (Ví dụ: chọn đúng tên chủ đề đã có sẵn trong danh sách trên).
3. NẾU LÀ CHỦ ĐỀ MỚI HOÀN TOÀN CHƯA CÓ TRONG DANH SÁCH TRÊN: Bạn hãy TỰ ĐỘNG TẠO TÊN CHỦ ĐỀ MỚI KÈM EMOJI ĐẸP MẮT (Ví dụ: "🚀 Vũ trụ & Thiên văn", "👗 Thời trang & Trang phục", "🏥 Y tế & Bệnh viện", "👨‍👩‍👧‍👦 Gia đình", "⚽ Thể thao", "🎵 Âm nhạc").
`;

        let promptText = "";
        if (mode === "vietnamese") {
            promptText = `Người dùng nhập từ/cụm từ Tiếng Việt: "${input}". 
Hãy dịch từ này sang Tiếng Hàn chuẩn xác nhất và tạo đầy đủ thông tin từ vựng bao gồm:
1. "korean": Từ tiếng Hàn tương ứng (gốc Hangul)
2. "romaja": Phiên âm Romaja chuẩn
3. "vietnamese": Nghĩa Tiếng Việt đầy đủ
4. "pos": Từ loại - Chọn chính xác 1 trong các loại: Danh từ / Động từ / Tính từ / Phó từ / Trạng từ / Ngữ pháp / Quán dụng ngữ / Từ liên kết
5. "topic": ${topicInstructions}
6. "example": 1 câu ví dụ tiếng Hàn ngắn gọn có chứa từ đó kèm dịch tiếng Việt
7. "related": Mảng 3 từ vựng tiếng Hàn liên quan (Array of Objects, mỗi object có {"korean": "...", "vietnamese": "..."})

Trả về DUY NHẤT 1 JSON Object thuần túy:
{
  "korean": "...",
  "romaja": "...",
  "vietnamese": "...",
  "pos": "...",
  "topic": "...",
  "example": "...",
  "related": [
    {"korean": "...", "vietnamese": "..."},
    {"korean": "...", "vietnamese": "..."},
    {"korean": "...", "vietnamese": "..."}
  ]
}`;
        } else {
            promptText = `Người dùng nhập/nói từ Tiếng Hàn (Hangul): "${input}". 
Hãy bóc tách và phân tích từ vựng này thành đầy đủ thông tin:
1. "korean": Từ tiếng Hàn gốc
2. "romaja": Phiên âm Romaja chuẩn
3. "vietnamese": Dịch nghĩa Tiếng Việt đầy đủ
4. "pos": Từ loại - Chọn chính xác 1 trong các loại: Danh từ / Động từ / Tính từ / Phó từ / Trạng từ / Ngữ pháp / Quán dụng ngữ / Từ liên kết
5. "topic": ${topicInstructions}
6. "example": 1 câu ví dụ tiếng Hàn ngắn kèm dịch tiếng Việt
7. "related": Mảng 3 từ vựng tiếng Hàn liên quan kèm dịch tiếng Việt

Trả về DUY NHẤT 1 JSON Object thuần túy:
{
  "korean": "...",
  "romaja": "...",
  "vietnamese": "...",
  "pos": "...",
  "topic": "...",
  "example": "...",
  "related": [
    {"korean": "...", "vietnamese": "..."},
    {"korean": "...", "vietnamese": "..."},
    {"korean": "...", "vietnamese": "..."}
  ]
}`;
        }

        if (cleanKey) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cleanKey}`;
                const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                        generationConfig: { response_mime_type: "application/json" }
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
                        return parsed;
                    }
                }
            } catch (err) {
                console.warn("Lỗi Gemini Direct API, fallback...", err);
            }
        }

        const fallbackTopic = this.autoDetectTopic(input, existingTopics);
        const fallbackPos = this.autoDetectPos(input);

        if (mode === "vietnamese") {
            return {
                korean: input,
                romaja: "romaja",
                vietnamese: input,
                pos: fallbackPos,
                topic: fallbackTopic,
                example: `${input} - Từ vựng mới`,
                related: []
            };
        } else {
            return {
                korean: input,
                romaja: "romaja",
                vietnamese: "Từ vựng tiếng Hàn",
                pos: fallbackPos,
                topic: fallbackTopic,
                example: `${input} - Từ vựng mới`,
                related: []
            };
        }
    }
}

window.aiService = new AIService();
