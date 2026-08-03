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
        const cleanKey = (window.ocrEngine?.getApiKey() || "").trim().replace(/[\s\r\n\t\\'"]/g, '');

        if (!cleanKey) {
            return "⚠️ Bạn chưa cấu hình Gemini API Key. Vui lòng bấm '⚙️ Cấu Hình API AI' và dán Key của bạn để trò chuyện trực tiếp cùng AI nhé!";
        }

        // Add user message to history
        this.chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

        // Build context from current scanned vocabulary
        const vocabContext = (vocabularyList || []).map(w => `- ${w.korean} [${w.romaja}]: ${w.vietnamese}`).join("\n");
        
        const systemPrompt = `Bạn là một AI Trợ lý & Thầy giáo tiếng Hàn Quốc thông minh, tự nhiên, thân thiện và linh hoạt như người thật.
Bạn có khả năng trò chuyện tự nhiên, ghi nhớ danh xưng người dùng tự xưng (ví dụ: anh Tùng, chị Lan, em...), giải đáp mọi thắc mắc tiếng Hàn, ngữ pháp, dịch thuật, đặt câu, hoặc trò chuyện phiếm.

Bối cảnh danh sách từ vựng người dùng vừa quét được trong ứng dụng:
${vocabContext || "(Chưa có từ vựng nào trong danh sách)"}

Quy tắc trò chuyện:
1. Trả lời bằng tiếng Việt tự nhiên, lịch sự và đúng danh xưng người dùng mong muốn.
2. Nếu người dùng chào hỏi hoặc nói chuyện phiếm, hãy đáp lại thân thiện như một người bạn/người thầy thật sự.
3. Nếu người dùng hỏi về từ vựng, ngữ pháp tiếng Hàn, hãy giải thích chi tiết, ngắn gọn kèm câu ví dụ dễ hiểu.
4. Trình bày bằng Markdown đẹp mắt.`;

        // Payload with memory
        const contents = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Vâng! Tôi đã sẵn sàng trò chuyện tự nhiên và hỗ trợ bạn học tiếng Hàn tốt nhất." }] },
            ...this.chatHistory.slice(-12) // Keep last 12 messages for smooth multi-turn memory
        ];

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cleanKey}`;
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
            } else {
                const errTxt = await resp.text();
                console.warn("Lỗi Gemini Chat API:", errTxt);
                this.chatHistory.pop(); // Remove failed user message
                return `❌ Google AI trả về lỗi (${resp.status}): Hãy kiểm tra lại Gemini API Key trong phần '⚙️ Cấu Hình API AI'.`;
            }
        } catch (err) {
            console.error("Lỗi kết nối Gemini Chat:", err);
            this.chatHistory.pop();
            return `❌ Lỗi kết nối tới AI: ${err.message}`;
        }
    }

    /**
     * Generate complete word details from Vietnamese input, Korean text, or Voice speech
     */
    async generateSingleWordData(input, mode) {
        const cleanKey = (window.ocrEngine?.getApiKey() || "").trim().replace(/[\s\r\n\t\\'"]/g, '');
        
        let promptText = "";
        if (mode === "vietnamese") {
            promptText = `Người dùng nhập từ/cụm từ Tiếng Việt: "${input}". 
Hãy dịch từ này sang Tiếng Hàn chuẩn xác nhất và tạo đầy đủ thông tin từ vựng bao gồm:
1. "korean": Từ tiếng Hàn tương ứng (gốc Hangul)
2. "romaja": Phiên âm Romaja chuẩn
3. "vietnamese": Nghĩa Tiếng Việt đầy đủ
4. "pos": Từ loại (Danh từ / Động từ / Tính từ / Trạng từ...)
5. "topic": Chọn 1 mã chủ đề phù hợp trong các mã sau: animal, food, greeting, daily, weather, transport, work, shopping, health, hobby HOẶC tự tạo mã chủ đề mới kèm Emoji nếu không thuộc nhóm trên (VD: 🚀 Vũ trụ & Thiên văn)
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
4. "pos": Từ loại (Danh từ / Động từ / Tính từ / Trạng từ...)
5. "topic": Chọn mã chủ đề phù hợp hoặc tự tạo mã chủ đề mới kèm Emoji (VD: 🚀 Vũ trụ & Thiên văn)
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

        if (mode === "vietnamese") {
            return {
                korean: input,
                romaja: "romaja",
                vietnamese: input,
                pos: "Danh từ",
                topic: "daily",
                example: `${input} - Từ vựng mới`,
                related: []
            };
        } else {
            return {
                korean: input,
                romaja: "romaja",
                vietnamese: "Từ vựng tiếng Hàn",
                pos: "Danh từ",
                topic: "daily",
                example: `${input} - Từ vựng mới`,
                related: []
            };
        }
    }
}

window.aiService = new AIService();
