/**
 * KorScan AI - Main Application Controller
 * Features: Part of Speech (POS), Batch Image OCR Scanning, AI Pronunciation Coach, Word Matching Game, Learning Streak Analytics
 */

class KorScanApp {
    constructor() {
        let initialList = [];
        const saved = localStorage.getItem("KORSCAN_VOCAB_LIST");
        if (saved) {
            try {
                initialList = JSON.parse(saved);
            } catch (e) {
                initialList = [];
            }
        }

        // If local storage is empty, fallback to INITIAL_VOCAB_LIST injected from server disk
        if ((!initialList || initialList.length === 0) && Array.isArray(window.INITIAL_VOCAB_LIST) && window.INITIAL_VOCAB_LIST.length > 0) {
            initialList = window.INITIAL_VOCAB_LIST;
            this.isDiskSynced = true;
            localStorage.setItem("KORSCAN_VOCAB_LIST", JSON.stringify(initialList));
        }

        this.vocabularyList = Array.isArray(initialList) ? initialList : [];

        this.currentFilter = 'all';
        this.searchQuery = '';
        this.batchImages = [];
        this.currentFlashcardIndex = 0;
        this.visibleLimit = 16;

        // Mini Game States
        this.selectedKorean = null;
        this.selectedVietnamese = null;
        this.gameScore = 0;
        this.gameTimer = 0;
        this.gameInterval = null;

        this.initDOM();
        this.bindEvents();
        this.autoClassifySpecialCategories();
        this.updateStreakData();
        this.renderCategoryChips();
        this.renderVocabularyGrid();
        this.checkAPIKeyStatus();
        this.syncVocabWithDisk();
    }

    async syncVocabWithDisk(userClicked = false) {
        try {
            const resp = await fetch("/api/vocab?t=" + Date.now(), { cache: "no-store" });
            if (resp.ok) {
                const data = await resp.json();
                if (data.success && Array.isArray(data.words) && data.words.length > 0) {
                    const wordMap = new Map();
                    data.words.forEach(w => {
                        if (w && w.korean) wordMap.set(w.korean.trim(), w);
                    });
                    this.vocabularyList.forEach(w => {
                        if (w && w.korean) wordMap.set(w.korean.trim(), w);
                    });

                    this.vocabularyList = Array.from(wordMap.values());
                    this.isDiskSynced = true;
                    localStorage.setItem("KORSCAN_VOCAB_LIST", JSON.stringify(this.vocabularyList));
                    this.renderCategoryChips();
                    this.renderVocabularyGrid();
                    this.updateStreakData();
                    if (userClicked) alert("🎉 Khôi phục dữ liệu thành công!\n\nĐã tải đầy đủ toàn bộ từ vựng vào bảng học tập của bạn.");
                } else {
                    this.isDiskSynced = true;
                    if (userClicked) alert("⚠️ Chưa tìm thấy từ vựng nào được sao lưu.");
                }
            }
        } catch (err) {
            this.isDiskSynced = true;
            console.warn("Chế độ lưu file ổ đĩa chưa bật:", err);
            if (userClicked) alert("⚠️ Không thể kết nối dữ liệu sao lưu.");
        }
    }

    saveVocabToStorage() {
        localStorage.setItem("KORSCAN_VOCAB_LIST", JSON.stringify(this.vocabularyList));
        this.updateStreakData();

        if (this.isDiskSynced || this.vocabularyList.length > 0) {
            try {
                fetch("/api/vocab", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ words: this.vocabularyList })
                }).catch(e => {});
            } catch (e) {}
        }
    }

    updateStreakData() {
        const todayStr = new Date().toISOString().slice(0, 10);
        let streakObj = { lastDate: '', count: 0 };
        const savedStreak = localStorage.getItem("KORSCAN_STREAK");
        
        if (savedStreak) {
            try { streakObj = JSON.parse(savedStreak); } catch(e){}
        }

        if (streakObj.lastDate !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);

            if (streakObj.lastDate === yesterdayStr) {
                streakObj.count += 1;
            } else if (streakObj.lastDate !== todayStr) {
                streakObj.count = 1;
            }
            streakObj.lastDate = todayStr;
            localStorage.setItem("KORSCAN_STREAK", JSON.stringify(streakObj));
        }

        const streakLabel = document.getElementById('streakLabel');
        const totalWordsLabel = document.getElementById('totalWordsLabel');
        const starredWordsLabel = document.getElementById('starredWordsLabel');

        if (streakLabel) streakLabel.innerHTML = `🔥 Chuỗi học: <b>${streakObj.count || 1} Ngày</b>`;
        if (totalWordsLabel) totalWordsLabel.innerHTML = `📊 Tổng tích lũy: <b>${this.vocabularyList.length} từ</b>`;
        if (starredWordsLabel) starredWordsLabel.innerHTML = `⭐ Từ yêu thích: <b>${this.vocabularyList.filter(w => w.starred).length} từ</b>`;
    }

    initDOM() {
        this.dropzone = document.getElementById('dropzone');
        this.fileInput = document.getElementById('fileInput');
        this.cameraInput = document.getElementById('cameraInput');
        this.btnSelectFile = document.getElementById('btnSelectFile');
        this.btnCamera = document.getElementById('btnCamera');

        this.batchPreviewGrid = document.getElementById('batchPreviewGrid');
        this.previewContainer = document.getElementById('previewContainer');
        this.previewImg = document.getElementById('previewImg');
        this.scanLine = document.getElementById('scanLine');
        this.btnScanAI = document.getElementById('btnScanAI');
        this.aiEngineStatus = document.getElementById('aiEngineStatus');

        this.wordGrid = document.getElementById('wordGrid');
        this.searchInput = document.getElementById('searchInput');
        this.filtersBar = document.getElementById('filtersBar');
        this.wordCountLabel = document.getElementById('wordCountLabel');

        this.btnExportSheet = document.getElementById('btnExportSheet');
        this.btnCopySheet = document.getElementById('btnCopySheet');
        this.btnStudyFlashcards = document.getElementById('btnStudyFlashcards');
        this.btnClearAll = document.getElementById('btnClearAll');

        this.btnConnectGSheet = document.getElementById('btnConnectGSheet');
        this.btnSyncGSheet = document.getElementById('btnSyncGSheet');
        this.gsheetModal = document.getElementById('gsheetModal');
        this.btnCloseGSheet = document.getElementById('btnCloseGSheet');
        this.btnCancelGSheet = document.getElementById('btnCancelGSheet');
        this.btnSaveGSheet = document.getElementById('btnSaveGSheet');
        this.gsheetWebhookInput = document.getElementById('gsheetWebhookInput');

        this.btnOpenGame = document.getElementById('btnOpenGame');
        this.gameModal = document.getElementById('gameModal');
        this.btnCloseGame = document.getElementById('btnCloseGame');
        this.btnRestartGame = document.getElementById('btnRestartGame');
        this.gameKoreanCol = document.getElementById('gameKoreanCol');
        this.gameVietnameseCol = document.getElementById('gameVietnameseCol');
        this.gameScoreLabel = document.getElementById('gameScoreLabel');
        this.gameTimerLabel = document.getElementById('gameTimerLabel');

        this.btnOpenSettings = document.getElementById('btnOpenSettings');
        this.settingsModal = document.getElementById('settingsModal');
        this.btnCloseSettings = document.getElementById('btnCloseSettings');
        this.btnSaveSettings = document.getElementById('btnSaveSettings');
        this.geminiApiKeyInput = document.getElementById('geminiApiKeyInput');

        this.flashcardModal = document.getElementById('flashcardModal');
        this.flashcardBox = document.getElementById('flashcardBox');
        this.flashcardKorean = document.getElementById('flashcardKorean');
        this.flashcardRomaja = document.getElementById('flashcardRomaja');
        this.flashcardVietnamese = document.getElementById('flashcardVietnamese');
        this.flashcardExample = document.getElementById('flashcardExample');
        this.flashcardTopicBadge = document.getElementById('flashcardTopicBadge');
        this.flashcardCounter = document.getElementById('flashcardCounter');
        this.btnPrevCard = document.getElementById('btnPrevCard');
        this.btnNextCard = document.getElementById('btnNextCard');
        this.btnCloseModal = document.getElementById('btnCloseModal');

        this.btnToggleAIChat = document.getElementById('btnToggleAIChat');
        this.aiDrawer = document.getElementById('aiDrawer');
        this.btnCloseAIDrawer = document.getElementById('btnCloseAIDrawer');
        this.aiChatInput = document.getElementById('aiChatInput');
        this.btnSendAIChat = document.getElementById('btnSendAIChat');
        this.aiChatMessages = document.getElementById('aiChatMessages');

        // Smart Creator & Confirm Modal Elements
        this.tabModeViet = document.getElementById('tabModeViet');
        this.tabModeVoice = document.getElementById('tabModeVoice');
        this.tabModeKor = document.getElementById('tabModeKor');
        this.creatorInput = document.getElementById('creatorInput');
        this.btnCreateWordAI = document.getElementById('btnCreateWordAI');
        this.voiceStatusText = document.getElementById('voiceStatusText');

        this.confirmWordModal = document.getElementById('confirmWordModal');
        this.modalKorean = document.getElementById('modalKorean');
        this.modalVietnamese = document.getElementById('modalVietnamese');
        this.modalRomaja = document.getElementById('modalRomaja');
        this.modalPos = document.getElementById('modalPos');
        this.modalTopic = document.getElementById('modalTopic');
        this.modalExample = document.getElementById('modalExample');
        this.relatedWordsContainer = document.getElementById('relatedWordsContainer');
        this.relatedWordsChips = document.getElementById('relatedWordsChips');
        this.btnCloseConfirmWord = document.getElementById('btnCloseConfirmWord');
        this.btnCancelConfirmWord = document.getElementById('btnCancelConfirmWord');
        this.btnSaveConfirmWord = document.getElementById('btnSaveConfirmWord');

        this.creatorMode = 'vietnamese';
    }

    bindEvents() {
        if (this.dropzone) {
            this.dropzone.addEventListener('click', () => this.fileInput && this.fileInput.click());
            this.dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.dropzone.classList.add('dragover');
            });
            this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('dragover'));
            this.dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.dropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleMultipleFilesSelect(Array.from(e.dataTransfer.files));
                }
            });
        }

        if (this.btnSelectFile) this.btnSelectFile.addEventListener('click', () => this.fileInput && this.fileInput.click());
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) this.handleMultipleFilesSelect(Array.from(e.target.files));
            });
        }

        if (this.btnCamera) this.btnCamera.addEventListener('click', () => this.cameraInput && this.cameraInput.click());
        if (this.cameraInput) {
            this.cameraInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) this.handleMultipleFilesSelect(Array.from(e.target.files));
            });
        }

        if (this.btnScanAI) this.btnScanAI.addEventListener('click', () => this.performBatchAIScan());

        if (this.btnClearAll) {
            this.btnClearAll.addEventListener('click', () => {
                if (confirm('Bạn có chắc muốn xóa sạch toàn bộ danh sách từ vựng hiện tại?')) {
                    this.vocabularyList = [];
                    this.visibleLimit = 16;
                    this.saveVocabToStorage();
                    this.renderCategoryChips();
                    this.renderVocabularyGrid();
                }
            });
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.visibleLimit = 16;
                this.renderVocabularyGrid();
            });
        }

        if (this.btnExportSheet) this.btnExportSheet.addEventListener('click', () => window.sheetExporter.exportToCSV(this.filteredWords));
        if (this.btnCopySheet) this.btnCopySheet.addEventListener('click', () => window.sheetExporter.copyForGoogleSheet(this.filteredWords));

        if (this.btnConnectGSheet) {
            this.btnConnectGSheet.addEventListener('click', () => {
                if (this.gsheetWebhookInput) this.gsheetWebhookInput.value = window.sheetExporter.getWebhookUrl();
                if (this.gsheetModal) this.gsheetModal.style.display = 'flex';
            });
        }
        if (this.btnCloseGSheet) this.btnCloseGSheet.addEventListener('click', () => this.gsheetModal && (this.gsheetModal.style.display = 'none'));
        if (this.btnCancelGSheet) this.btnCancelGSheet.addEventListener('click', () => this.gsheetModal && (this.gsheetModal.style.display = 'none'));
        if (this.btnSaveGSheet) {
            this.btnSaveGSheet.addEventListener('click', () => {
                try {
                    const url = this.gsheetWebhookInput ? this.gsheetWebhookInput.value.trim() : '';
                    window.sheetExporter.setWebhookUrl(url);
                    if (this.gsheetModal) this.gsheetModal.style.display = 'none';
                    alert('✅ Đã lưu kết nối Google Sheet cố định!');
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        if (this.btnSyncGSheet) {
            this.btnSyncGSheet.addEventListener('click', async () => {
                try {
                    this.btnSyncGSheet.disabled = true;
                    this.btnSyncGSheet.innerText = '⏳ Đang đồng bộ...';
                    await window.sheetExporter.syncToLiveGoogleSheet(this.filteredWords, (percent, msg) => {
                        this.btnSyncGSheet.innerText = `⏳ ${msg}`;
                    });
                    alert('🎉 Đã đồng bộ thành công toàn bộ từ vựng sang Google Sheet cố định của bạn!');
                } catch (err) {
                    alert(err.message);
                } finally {
                    this.btnSyncGSheet.disabled = false;
                    this.btnSyncGSheet.innerText = '📊 Đồng Bộ Google Sheet';
                }
            });
        }

        if (this.btnOpenGame) this.btnOpenGame.addEventListener('click', () => this.openGameModal());
        if (this.btnCloseGame) this.btnCloseGame.addEventListener('click', () => this.closeGameModal());
        if (this.btnRestartGame) this.btnRestartGame.addEventListener('click', () => this.startMatchingGame());

        if (this.btnOpenSettings) {
            this.btnOpenSettings.addEventListener('click', () => {
                if (this.geminiApiKeyInput) this.geminiApiKeyInput.value = window.ocrEngine.getApiKey();
                if (this.settingsModal) this.settingsModal.style.display = 'flex';
            });
        }
        if (this.btnCloseSettings) this.btnCloseSettings.addEventListener('click', () => this.settingsModal && (this.settingsModal.style.display = 'none'));
        if (this.btnSaveSettings) {
            this.btnSaveSettings.addEventListener('click', () => {
                const key = this.geminiApiKeyInput ? this.geminiApiKeyInput.value.trim() : '';
                window.ocrEngine.setApiKey(key);
                this.checkAPIKeyStatus();
                if (this.settingsModal) this.settingsModal.style.display = 'none';
                alert('✅ Đã lưu Gemini API Key! Trợ lý Chatbot AI đã sẵn sàng trò chuyện cùng bạn!');
            });
        }

        if (this.btnStudyFlashcards) this.btnStudyFlashcards.addEventListener('click', () => this.openFlashcardsModal());
        if (this.flashcardBox) this.flashcardBox.addEventListener('click', () => this.flashcardBox.classList.toggle('flipped'));
        if (this.btnPrevCard) {
            this.btnPrevCard.addEventListener('click', (e) => {
                e.stopPropagation();
                this.prevFlashcard();
            });
        }
        if (this.btnNextCard) {
            this.btnNextCard.addEventListener('click', (e) => {
                e.stopPropagation();
                this.nextFlashcard();
            });
        }
        if (this.btnCloseModal) this.btnCloseModal.addEventListener('click', () => this.flashcardModal && (this.flashcardModal.style.display = 'none'));

        if (this.btnToggleAIChat) this.btnToggleAIChat.addEventListener('click', () => this.aiDrawer && (this.aiDrawer.style.display = 'flex'));
        if (this.btnCloseAIDrawer) this.btnCloseAIDrawer.addEventListener('click', () => this.aiDrawer && (this.aiDrawer.style.display = 'none'));
        if (this.btnSendAIChat) this.btnSendAIChat.addEventListener('click', () => this.handleAISubmit());
        if (this.aiChatInput) {
            this.aiChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAISubmit();
            });
        }

        // Smart Creator & Confirm Modal Event Listeners
        if (this.tabModeViet) this.tabModeViet.addEventListener('click', () => this.setCreatorMode('vietnamese'));
        if (this.tabModeVoice) this.tabModeVoice.addEventListener('click', () => this.setCreatorMode('voice'));
        if (this.tabModeKor) this.tabModeKor.addEventListener('click', () => this.setCreatorMode('korean'));

        if (this.btnCreateWordAI) this.btnCreateWordAI.addEventListener('click', () => this.handleSmartWordCreation());
        if (this.creatorInput) {
            this.creatorInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSmartWordCreation();
            });
        }

        if (this.btnCloseConfirmWord) this.btnCloseConfirmWord.addEventListener('click', () => this.confirmWordModal && (this.confirmWordModal.style.display = 'none'));
        if (this.btnCancelConfirmWord) this.btnCancelConfirmWord.addEventListener('click', () => this.confirmWordModal && (this.confirmWordModal.style.display = 'none'));
        if (this.btnSaveConfirmWord) this.btnSaveConfirmWord.addEventListener('click', () => this.saveConfirmedWord());
    }

    handleMultipleFilesSelect(files) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert('Vui lòng chọn các file hình ảnh!');
            return;
        }

        let loadedCount = 0;
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.batchImages.push(e.target.result);
                loadedCount++;
                if (loadedCount === imageFiles.length) {
                    this.renderBatchPreviews();
                }
            };
            reader.readAsDataURL(file);
        });
    }

    renderBatchPreviews() {
        if (this.batchImages.length === 0) {
            this.batchPreviewGrid.style.display = 'none';
            this.previewContainer.style.display = 'none';
            this.btnScanAI.style.display = 'none';
            return;
        }

        if (this.batchImages.length === 1) {
            this.batchPreviewGrid.style.display = 'none';
            this.previewImg.src = this.batchImages[0];
            this.previewContainer.style.display = 'block';
        } else {
            this.previewContainer.style.display = 'none';
            this.batchPreviewGrid.style.display = 'grid';
            this.batchPreviewGrid.innerHTML = this.batchImages.map((src, idx) => `
                <div class="batch-thumb-item">
                    <img src="${src}" class="batch-thumb-img">
                    <button class="batch-thumb-remove" onclick="app.removeBatchImage(${idx})">✕</button>
                </div>
            `).join('');
        }

        this.btnScanAI.disabled = false;
        this.btnScanAI.style.display = 'flex';
        this.btnScanAI.innerText = `⚡ Bắt đầu Quét Hàng Loạt (${this.batchImages.length} ảnh)`;
    }

    removeBatchImage(index) {
        this.batchImages.splice(index, 1);
        this.renderBatchPreviews();
    }

    async performBatchAIScan() {
        if (this.batchImages.length === 0) return;

        const key = window.ocrEngine.getApiKey();
        if (!key) {
            this.geminiApiKeyInput.value = '';
            this.settingsModal.style.display = 'flex';
            alert('🔑 Bạn chưa có Gemini API Key! Vui lòng nhấn vào "⚙️ Cấu Hình API AI" và dán API Key Gemini của bạn.');
            return;
        }

        this.btnScanAI.disabled = true;
        this.scanLine.style.display = 'block';

        let totalNewWords = 0;
        let totalExtractedCount = 0;
        let errorCount = 0;
        let lastErrorMessage = '';
        const totalImages = this.batchImages.length;

        for (let i = 0; i < totalImages; i++) {
            const imgSrc = this.batchImages[i];
            this.btnScanAI.innerText = `⏳ Đang quét ảnh ${i + 1}/${totalImages}...`;

            try {
                const rawText = await window.ocrEngine.recognizeKoreanText(imgSrc, (percent, msg) => {
                    this.btnScanAI.innerText = `⏳ Đang bóc tách ảnh ${i + 1}/${totalImages} (${percent}%)`;
                });

                const newWords = await window.aiService.analyzeAndCategorize(rawText);

                if (!newWords || newWords.length === 0) {
                    throw new Error("AI không trích xuất được từ vựng nào từ ảnh này. Vui lòng dán lại Gemini API Key chuẩn hoặc thử ảnh rõ nét hơn.");
                }

                totalExtractedCount += newWords.length;

                for (const nw of newWords) {
                    const existingIdx = this.vocabularyList.findIndex(w => w.korean === nw.korean);
                    if (existingIdx >= 0) {
                        this.vocabularyList[existingIdx] = nw;
                    } else {
                        this.vocabularyList.unshift(nw);
                        totalNewWords++;
                    }
                }
            } catch (err) {
                console.error(`Lỗi bóc tách ảnh ${i + 1}:`, err);
                errorCount++;
                lastErrorMessage = err.message || err.toString();
            }
        }

        this.saveVocabToStorage();
        this.renderCategoryChips();
        this.renderVocabularyGrid();

        if (errorCount > 0 && totalExtractedCount === 0) {
            alert(`⚠️ Lỗi bóc tách ảnh:\n${lastErrorMessage}`);
        } else if (errorCount > 0) {
            alert(`🎉 Đã bóc tách thành công ${totalExtractedCount} từ vựng từ ${totalImages} trang ảnh!\n(Thêm mới: ${totalNewWords} từ, Cập nhật: ${totalExtractedCount - totalNewWords} từ).\nCó ${errorCount} ảnh gặp sự cố.`);
        } else {
            alert(`🎉 Đã bóc tách thành công ${totalExtractedCount} từ vựng từ ${totalImages} trang ảnh!\n(Thêm mới: ${totalNewWords} từ mới, Cập nhật: ${totalExtractedCount - totalNewWords} từ đã có sẵn vào bảng).`);
        }

        this.batchImages = [];
        this.renderBatchPreviews();
        this.scanLine.style.display = 'none';
    }

    autoClassifySpecialCategories() {
        const fruitKr = ['과일','사과','바나나','수박','포도','딸기','귤','복숭아','감','참외','멜론','오렌지','배','레몬','망고','코코넛','아보카도','자두','체리','토마토','라임','파인애플','탄제린'];
        const fruitVn = ['táo','chuối','dưa hấu','dưa lưới','dưa','nho','dâu tây','dâu','quýt','đào','hồng','cam','lê','chanh','xoài','dừa','bơ','mận','vải','nhãn','sầu riêng','măng cụt','đu đủ','ổi','dứa','thơm','trái cây','hoa quả','anh đào'];

        const animalKr = ['동물','강아지','고양이','호랑이','사자','코끼리','기린','여우','늑대','곰','토끼','돼지','소','말','양','염소','닭','오리','새','비둘기','독수리','부엉이','올빼미','원숭이','다람쥐','쥐','뱀','개구리','거북이','악어','고래','돌고래','상어','오징어','문어','게','공작','코알라','갈매기','펭귄'];
        const animalVn = ['chó','mèo','hổ','sư tử','voi','hươu','cáo','sói','gấu','thỏ','heo','lợn','bò','ngựa','dê','gà','vịt','chim','bồ câu','đại bàng','cú','khỉ','sóc','chuột','rắn','ếch','rùa','cá sấu','cá voi','cá heo','cá mập','mực','bạch tuộc','cua','chim công','gấu koala','hải âu','cánh cụt'];

        let count = 0;
        this.vocabularyList.forEach(w => {
            const kr = (w.korean || '').toLowerCase();
            const vn = (w.vietnamese || '').toLowerCase();

            if (fruitKr.some(k => kr.includes(k)) || fruitVn.some(v => vn.includes(v))) {
                if (!vn.includes('công trường') && !vn.includes('cùng tuổi') && !vn.includes('cách tân')) {
                    if (w.topic !== 'fruit') {
                        w.topic = 'fruit';
                        count++;
                    }
                }
            } else if (animalKr.some(k => kr.includes(k)) || animalVn.some(v => vn.includes(v))) {
                if (w.topic !== 'animal') {
                    w.topic = 'animal';
                    count++;
                }
            }
        });

        if (count > 0) {
            this.saveVocabToStorage();
        }
    }

    renderCategoryChips() {
        const labelSet = new Set();
        this.vocabularyList.forEach(w => {
            if (w.topic) {
                const label = window.sheetExporter.getTopicLabel(w.topic).trim();
                labelSet.add(label);
            }
        });

        const labels = Array.from(labelSet);

        let html = `<button class="chip ${this.currentFilter === 'all' ? 'active' : ''}" data-category="all">🌐 Tất cả chủ đề</button>`;
        html += `<button class="chip ${this.currentFilter === 'starred' ? 'active' : ''}" data-category="starred">⭐ Từ yêu thích</button>`;

        labels.forEach(label => {
            html += `<button class="chip ${this.currentFilter === label ? 'active' : ''}" data-category="${label}">${label}</button>`;
        });

        this.filtersBar.innerHTML = html;

        const chips = this.filtersBar.querySelectorAll('.chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentFilter = chip.getAttribute('data-category');
                this.visibleLimit = 16;
                this.renderVocabularyGrid();
            });
        });
    }

    checkAPIKeyStatus() {
        const key = window.ocrEngine.getApiKey();
        if (key) {
            this.aiEngineStatus.innerText = '⚡ Gemini 1.5 Flash API Connected';
            this.aiEngineStatus.style.color = '#10B981';
        } else {
            this.aiEngineStatus.innerText = '⚙️ Nhấp "Cấu Hình API AI" để bóc tách 100% ảnh thực';
            this.aiEngineStatus.style.color = '#F59E0B';
        }
    }

    get filteredWords() {
        return this.vocabularyList.filter(w => {
            const wordTopicLabel = window.sheetExporter.getTopicLabel(w.topic).trim();
            const matchesCategory = this.currentFilter === 'all' || 
                (this.currentFilter === 'starred' && w.starred) || 
                wordTopicLabel === this.currentFilter ||
                w.topic === this.currentFilter;

            const matchesSearch = !this.searchQuery || 
                w.korean.toLowerCase().includes(this.searchQuery) ||
                w.vietnamese.toLowerCase().includes(this.searchQuery) ||
                (w.pos && w.pos.toLowerCase().includes(this.searchQuery)) ||
                w.romaja.toLowerCase().includes(this.searchQuery);

            return matchesCategory && matchesSearch;
        });
    }

    getPosClass(pos) {
        if (!pos) return 'pos-noun';
        const lower = pos.toLowerCase();
        if (lower.includes('động') || lower.includes('verb')) return 'pos-verb';
        if (lower.includes('tính') || lower.includes('adj')) return 'pos-adj';
        if (lower.includes('phó') || lower.includes('trạng') || lower.includes('adv')) return 'pos-adv';
        return 'pos-noun';
    }

    renderVocabularyGrid() {
        if (this.vocabularyList.length === 0 && Array.isArray(window.INITIAL_VOCAB_LIST) && window.INITIAL_VOCAB_LIST.length > 0) {
            this.vocabularyList = window.INITIAL_VOCAB_LIST;
            this.renderCategoryChips();
        }

        const allFiltered = this.filteredWords;
        this.wordCountLabel.innerText = `(${allFiltered.length} từ vựng)`;

        if (allFiltered.length === 0) {
            this.wordGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h3>Chưa có từ vựng nào trong danh mục này</h3>
                    <p style="margin-bottom: 14px;">Hãy chọn ảnh mới và bấm nút <b>"⚡ Bắt đầu Quét Hàng Loạt"</b> hoặc bấm nút nạp bên dưới!</p>
                    <button class="btn btn-primary" onclick="app.syncVocabWithDisk(true)" style="padding: 10px 20px; font-size: 13.5px;">🔄 Tải Lại Dữ Liệu Từ Ổ Đĩa</button>
                </div>
            `;
            return;
        }

        const visibleWords = allFiltered.slice(0, this.visibleLimit);
        const remainingCount = allFiltered.length - visibleWords.length;

        let gridHtml = visibleWords.map(w => `
            <div class="word-card">
                <div class="word-header">
                    <div>
                        <div class="word-korean">${w.korean}</div>
                        <div class="word-romaja">[${w.romaja}]</div>
                    </div>
                    <div class="card-actions">
                        <button class="action-icon star ${w.starred ? 'active' : ''}" onclick="app.toggleStar('${w.id}')">★</button>
                        <button class="action-icon mic" title="Thu âm chấm điểm phát âm AI" onclick="app.testPronunciation('${w.korean}', this)">🎙️</button>
                        <button class="action-icon" onclick="app.speakKorean('${w.korean}')">🔊</button>
                        <button class="action-icon" onclick="app.deleteWord('${w.id}')">🗑️</button>
                    </div>
                </div>
                <div class="word-vietnamese">👉 ${w.vietnamese}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span class="pos-badge ${this.getPosClass(w.pos)}">${w.pos || 'Danh từ'}</span>
                    <span class="topic-badge badge-daily">${window.sheetExporter.getTopicLabel(w.topic)}</span>
                </div>
            </div>
        `).join('');

        if (remainingCount > 0) {
            gridHtml += `
                <div class="load-more-container">
                    <button class="btn btn-soft" style="padding: 10px 24px; font-size: 14px;" onclick="app.loadMoreWords()">
                        👇 Xem Thêm ${Math.min(16, remainingCount)} Từ Vựng Nữa (Còn ${remainingCount} từ)
                    </button>
                </div>
            `;
        }

        this.wordGrid.innerHTML = gridHtml;
    }

    loadMoreWords() {
        this.visibleLimit += 16;
        this.renderVocabularyGrid();
    }

    calculateSimilarity(target, spoken) {
        const cleanTarget = target.replace(/[\s\?\.\!\,\-]/g, '').toLowerCase();
        const cleanSpoken = spoken.replace(/[\s\?\.\!\,\-]/g, '').toLowerCase();

        if (!cleanSpoken || !cleanTarget) return 0;
        if (cleanTarget === cleanSpoken) return 100;

        let matchCount = 0;
        for (let char of cleanSpoken) {
            if (cleanTarget.includes(char)) matchCount++;
        }
        if (matchCount === 0) return 0;

        const track = Array(cleanSpoken.length + 1).fill(null).map(() =>
            Array(cleanTarget.length + 1).fill(null));
        for (let i = 0; i <= cleanTarget.length; i += 1) track[0][i] = i;
        for (let j = 0; j <= cleanSpoken.length; j += 1) track[j][0] = j;
        for (let j = 1; j <= cleanSpoken.length; j += 1) {
            for (let i = 1; i <= cleanTarget.length; i += 1) {
                const indicator = cleanTarget[i - 1] === cleanSpoken[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1,
                    track[j - 1][i] + 1,
                    track[j - 1][i - 1] + indicator,
                );
            }
        }
        const distance = track[cleanSpoken.length][cleanTarget.length];
        const maxLength = Math.max(cleanTarget.length, cleanSpoken.length);
        const similarity = Math.max(0, Math.round((1 - distance / maxLength) * 100));

        return similarity;
    }

    testPronunciation(targetKorean, btnElem) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('⚠️ Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói SpeechRecognition!');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        btnElem.classList.add('recording');
        btnElem.innerText = '🔴 (Đang nghe...)';

        recognition.onresult = (event) => {
            btnElem.classList.remove('recording');
            btnElem.innerText = '🎙️';

            const spokenText = event.results[0][0].transcript.trim();
            const score = this.calculateSimilarity(targetKorean, spokenText);

            if (score >= 90) {
                alert(`🌟 CHẤM ĐIỂM PHÁT ÂM AI: ${score}%\n\n🎯 Từ mẫu: "${targetKorean}"\n🗣️ Giọng của bạn: "${spokenText}"\n\n👉 Đánh giá: Phát âm xuất sắc chuẩn 100% giọng Hàn Quốc!`);
            } else if (score >= 60) {
                alert(`👍 CHẤM ĐIỂM PHÁT ÂM AI: ${score}%\n\n🎯 Từ mẫu: "${targetKorean}"\n🗣️ Giọng của bạn: "${spokenText}"\n\n👉 Đánh giá: Phát âm tương đối tốt! Nhấn nút 🔊 nghe lại mẫu và phát âm rõ hơn nhé.`);
            } else if (score > 0) {
                alert(`💪 CHẤM ĐIỂM PHÁT ÂM AI: ${score}%\n\n🎯 Từ mẫu: "${targetKorean}"\n🗣️ Giọng của bạn: "${spokenText}"\n\n👉 Đánh giá: Phát âm chưa chính xác âm tiết. Nhấn nút 🔊 nghe mẫu và thử lại nhé!`);
            } else {
                alert(`❌ CHẤM ĐIỂM PHÁT ÂM AI: 0%\n\n🎯 Từ chuẩn: "${targetKorean}"\n🗣️ Giọng thu được: "${spokenText}"\n\n👉 Đánh giá: Bạn phát âm nhầm sang từ khác! Hãy nhấn 🔊 nghe kỹ từ chuẩn và thử lại nhé.`);
            }
        };

        recognition.onerror = (err) => {
            btnElem.classList.remove('recording');
            btnElem.innerText = '🎙️';
            alert(`Lỗi nhận diện micro: ${err.error || 'Vui lòng cho phép truy cập Micro!'}`);
        };

        recognition.onend = () => {
            btnElem.classList.remove('recording');
            btnElem.innerText = '🎙️';
        };

        recognition.start();
    }

    openGameModal() {
        if (this.vocabularyList.length < 4) {
            alert('⚠️ Bạn cần bóc tách ít nhất 4 từ vựng để bắt đầu Mini-Game Nối Từ!');
            return;
        }
        this.gameModal.style.display = 'flex';
        this.startMatchingGame();
    }

    closeGameModal() {
        this.gameModal.style.display = 'none';
        if (this.gameInterval) clearInterval(this.gameInterval);
    }

    startMatchingGame() {
        if (this.gameInterval) clearInterval(this.gameInterval);
        this.selectedKorean = null;
        this.selectedVietnamese = null;
        this.gameScore = 0;
        this.gameTimer = 0;
        this.gameScoreLabel.innerText = `🏆 Điểm số: 0`;
        this.gameTimerLabel.innerText = `⏱️ Thời gian: 0s`;

        this.gameInterval = setInterval(() => {
            this.gameTimer++;
            this.gameTimerLabel.innerText = `⏱️ Thời gian: ${this.gameTimer}s`;
        }, 1000);

        const shuffled = [...this.vocabularyList].sort(() => 0.5 - Math.random());
        const gameWords = shuffled.slice(0, 4);

        const koreanList = [...gameWords].sort(() => 0.5 - Math.random());
        const vietList = [...gameWords].sort(() => 0.5 - Math.random());

        this.gameKoreanCol.innerHTML = koreanList.map(w => `
            <div class="game-card" data-id="${w.id}" data-korean="${w.korean}" onclick="app.selectKoreanCard(this)">
                🇰🇷 ${w.korean}
            </div>
        `).join('');

        this.gameVietnameseCol.innerHTML = vietList.map(w => `
            <div class="game-card" data-id="${w.id}" data-vietnamese="${w.vietnamese}" onclick="app.selectVietnameseCard(this)">
                🇻🇳 ${w.vietnamese}
            </div>
        `).join('');
    }

    selectKoreanCard(elem) {
        if (elem.classList.contains('matched')) return;
        this.gameKoreanCol.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
        elem.classList.add('selected');
        this.selectedKorean = elem;
        this.checkMatchPair();
    }

    selectVietnameseCard(elem) {
        if (elem.classList.contains('matched')) return;
        this.gameVietnameseCol.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
        elem.classList.add('selected');
        this.selectedVietnamese = elem;
        this.checkMatchPair();
    }

    checkMatchPair() {
        if (this.selectedKorean && this.selectedVietnamese) {
            const idKor = this.selectedKorean.getAttribute('data-id');
            const idViet = this.selectedVietnamese.getAttribute('data-id');

            if (idKor === idViet) {
                this.selectedKorean.classList.remove('selected');
                this.selectedVietnamese.classList.remove('selected');
                this.selectedKorean.classList.add('matched');
                this.selectedVietnamese.classList.add('matched');

                this.selectedKorean = null;
                this.selectedVietnamese = null;
                this.gameScore += 25;
                this.gameScoreLabel.innerText = `🏆 Điểm số: ${this.gameScore}`;

                if (this.gameScore === 100) {
                    clearInterval(this.gameInterval);
                    setTimeout(() => {
                        alert(`🎉 XUẤT SẮC! BẠN ĐÃ THẮNG TRÒ CHƠI NỐI TỪ!\n⏱️ Thời gian hoàn thành: ${this.gameTimer} giây!\n🏆 Điểm tuyệt đối: 100 Điểm!`);
                    }, 200);
                }
            } else {
                const kor = this.selectedKorean;
                const viet = this.selectedVietnamese;
                kor.classList.add('wrong');
                viet.classList.add('wrong');

                setTimeout(() => {
                    kor.classList.remove('wrong', 'selected');
                    viet.classList.remove('wrong', 'selected');
                }, 400);

                this.selectedKorean = null;
                this.selectedVietnamese = null;
            }
        }
    }

    toggleStar(id) {
        const word = this.vocabularyList.find(w => w.id === id);
        if (word) {
            word.starred = !word.starred;
            this.saveVocabToStorage();
            this.renderVocabularyGrid();
        }
    }

    deleteWord(id) {
        if (confirm('Bạn có chắc muốn xóa từ vựng này khỏi danh sách?')) {
            this.vocabularyList = this.vocabularyList.filter(w => w.id !== id);
            this.saveVocabToStorage();
            this.renderCategoryChips();
            this.renderVocabularyGrid();
        }
    }

    speakKorean(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Trình duyệt của bạn không hỗ trợ phát âm tự động!');
        }
    }

    openFlashcardsModal() {
        const words = this.filteredWords;
        if (words.length === 0) {
            alert('Không có từ vựng nào trong danh sách để ôn tập!');
            return;
        }
        this.currentFlashcardIndex = 0;
        this.renderFlashcard();
        this.flashcardModal.style.display = 'flex';
    }

    renderFlashcard() {
        const words = this.filteredWords;
        const current = words[this.currentFlashcardIndex];
        if (!current) return;

        this.flashcardBox.classList.remove('flipped');
        this.flashcardKorean.innerText = current.korean;
        this.flashcardRomaja.innerText = `[${current.romaja}]`;
        this.flashcardVietnamese.innerText = current.vietnamese;
        this.flashcardExample.innerText = current.example;
        this.flashcardTopicBadge.innerText = window.sheetExporter.getTopicLabel(current.topic);
        this.flashcardTopicBadge.className = `topic-badge badge-daily`;

        this.flashcardCounter.innerText = `${this.currentFlashcardIndex + 1} / ${words.length}`;
    }

    prevFlashcard() {
        const words = this.filteredWords;
        this.currentFlashcardIndex = (this.currentFlashcardIndex - 1 + words.length) % words.length;
        this.renderFlashcard();
    }

    nextFlashcard() {
        const words = this.filteredWords;
        this.currentFlashcardIndex = (this.currentFlashcardIndex + 1) % words.length;
        this.renderFlashcard();
    }

    formatMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/\\n/g, '\n')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br/>');
    }

    async handleAISubmit() {
        const text = this.aiChatInput.value.trim();
        if (!text) return;

        this.appendChatMessage('user', text);
        this.aiChatInput.value = '';

        const loadingId = this.appendChatMessage('bot', '⏳ Thầy giáo AI Gemini đang soạn câu trả lời...');
        const aiResponse = await window.aiService.askAITutor(text, this.vocabularyList);
        
        const loadingElem = document.getElementById(loadingId);
        if (loadingElem) {
            loadingElem.innerHTML = this.formatMarkdown(aiResponse);
        }
    }

    appendChatMessage(sender, text) {
        const msgId = 'msg_' + Math.random().toString(36).substr(2, 9);
        const div = document.createElement('div');
        div.id = msgId;
        div.style.padding = '10px 14px';
        div.style.borderRadius = '12px';
        div.style.marginBottom = '10px';
        div.style.fontSize = '13px';
        div.style.lineHeight = '1.5';

        if (sender === 'user') {
            div.style.background = 'rgba(56, 189, 248, 0.2)';
            div.style.color = '#F9FAFB';
            div.style.alignSelf = 'flex-end';
            div.style.marginLeft = '30px';
        } else {
            div.style.background = 'rgba(30, 41, 59, 0.8)';
            div.style.color = '#E2E8F0';
            div.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            div.style.marginRight = '30px';
        }

        div.innerHTML = this.formatMarkdown(text);
        this.aiChatMessages.appendChild(div);
        this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;

        return msgId;
    }

    setCreatorMode(mode) {
        this.creatorMode = mode;
        const tabs = [this.tabModeViet, this.tabModeVoice, this.tabModeKor];
        tabs.forEach(tab => {
            if (tab) {
                tab.classList.remove('active');
                tab.style.background = 'transparent';
                tab.style.color = 'var(--text-dim)';
            }
        });

        if (mode === 'vietnamese' && this.tabModeViet) {
            this.tabModeViet.classList.add('active');
            this.tabModeViet.style.background = 'var(--primary-color)';
            this.tabModeViet.style.color = 'var(--text-main)';
            if (this.creatorInput) this.creatorInput.placeholder = 'Nhập từ/cụm từ Tiếng Việt (Ví dụ: con mèo, bệnh viện)...';
            if (this.voiceStatusText) this.voiceStatusText.style.display = 'none';
        } else if (mode === 'voice' && this.tabModeVoice) {
            this.tabModeVoice.classList.add('active');
            this.tabModeVoice.style.background = 'var(--primary-color)';
            this.tabModeVoice.style.color = 'var(--text-main)';
            if (this.creatorInput) this.creatorInput.placeholder = 'Nói từ Tiếng Hàn vào Micro (Bấm nút bên cạnh)...';
            if (this.voiceStatusText) this.voiceStatusText.style.display = 'block';
        } else if (mode === 'korean' && this.tabModeKor) {
            this.tabModeKor.classList.add('active');
            this.tabModeKor.style.background = 'var(--primary-color)';
            this.tabModeKor.style.color = 'var(--text-main)';
            if (this.creatorInput) this.creatorInput.placeholder = 'Nhập từ Tiếng Hàn (Ví dụ: 학교, 병원)...';
            if (this.voiceStatusText) this.voiceStatusText.style.display = 'none';
        }
    }

    async handleSmartWordCreation() {
        if (this.creatorMode === 'voice') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('⚠️ Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói SpeechRecognition!');
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.interimResults = false;

            if (this.btnCreateWordAI) {
                this.btnCreateWordAI.disabled = true;
                this.btnCreateWordAI.innerText = '🔴 Đang nghe...';
            }

            recognition.onresult = async (event) => {
                const spokenText = event.results[0][0].transcript.trim();
                if (this.creatorInput) this.creatorInput.value = spokenText;
                if (this.btnCreateWordAI) this.btnCreateWordAI.innerText = '⚡ AI Đang Phân Tích...';
                
                try {
                    const data = await window.aiService.generateSingleWordData(spokenText, 'korean');
                    this.openConfirmWordModal(data);
                } catch (err) {
                    alert('Lỗi tạo từ vựng: ' + err.message);
                } finally {
                    if (this.btnCreateWordAI) {
                        this.btnCreateWordAI.disabled = false;
                        this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
                    }
                }
            };

            recognition.onerror = (err) => {
                if (this.btnCreateWordAI) {
                    this.btnCreateWordAI.disabled = false;
                    this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
                }
                alert('Lỗi nhận diện giọng nói: ' + (err.error || 'Vui lòng kiểm tra Micro!'));
            };

            recognition.start();
            return;
        }

        const text = this.creatorInput ? this.creatorInput.value.trim() : '';
        if (!text) {
            alert('Vui lòng nhập từ vựng trước khi tạo!');
            return;
        }

        if (this.btnCreateWordAI) {
            this.btnCreateWordAI.disabled = true;
            this.btnCreateWordAI.innerText = '⚡ AI Đang Xử Lý...';
        }

        try {
            const data = await window.aiService.generateSingleWordData(text, this.creatorMode);
            this.openConfirmWordModal(data);
        } catch (err) {
            alert('Lỗi tạo từ vựng: ' + err.message);
        } finally {
            if (this.btnCreateWordAI) {
                this.btnCreateWordAI.disabled = false;
                this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
            }
        }
    }

    openConfirmWordModal(data) {
        if (!data) return;

        if (this.modalKorean) this.modalKorean.value = data.korean || '';
        if (this.modalVietnamese) this.modalVietnamese.value = data.vietnamese || '';
        if (this.modalRomaja) this.modalRomaja.value = data.romaja || '';
        if (this.modalPos) this.modalPos.value = data.pos || 'Danh từ';
        if (this.modalTopic) this.modalTopic.value = window.sheetExporter.getTopicLabel(data.topic || 'daily');
        if (this.modalExample) this.modalExample.value = data.example || '';

        // Render Related Words suggestions
        if (Array.isArray(data.related) && data.related.length > 0) {
            if (this.relatedWordsContainer) this.relatedWordsContainer.style.display = 'block';
            if (this.relatedWordsChips) {
                this.relatedWordsChips.innerHTML = data.related.map(r => `
                    <button class="chip" style="font-size: 11.5px; padding: 4px 10px; background: rgba(30, 58, 138, 0.4); border: 1px solid var(--primary-light);" onclick="app.addSuggestedRelatedWord('${r.korean}', '${r.vietnamese}')">
                        ➕ ${r.korean} (${r.vietnamese})
                    </button>
                `).join('');
            }
        } else {
            if (this.relatedWordsContainer) this.relatedWordsContainer.style.display = 'none';
        }

        if (this.confirmWordModal) this.confirmWordModal.style.display = 'flex';
    }

    async addSuggestedRelatedWord(korean, vietnamese) {
        if (this.confirmWordModal) this.confirmWordModal.style.display = 'none';
        try {
            const data = await window.aiService.generateSingleWordData(korean, 'korean');
            this.openConfirmWordModal(data);
        } catch (err) {
            alert('Lỗi tạo từ vựng gợi ý: ' + err.message);
        }
    }

    saveConfirmedWord() {
        const korean = this.modalKorean ? this.modalKorean.value.trim() : '';
        const vietnamese = this.modalVietnamese ? this.modalVietnamese.value.trim() : '';

        if (!korean || !vietnamese) {
            alert('Từ tiếng Hàn và nghĩa tiếng Việt không được để trống!');
            return;
        }

        const newWord = {
            id: 'word_' + Math.random().toString(36).substr(2, 9),
            korean: korean,
            romaja: this.modalRomaja ? this.modalRomaja.value.trim() : 'romaja',
            vietnamese: vietnamese,
            pos: this.modalPos ? this.modalPos.value.trim() : 'Danh từ',
            topic: this.modalTopic ? this.modalTopic.value.trim() : 'daily',
            example: this.modalExample ? this.modalExample.value.trim() : `${korean} - ${vietnamese}`,
            starred: false,
            date: new Date().toLocaleDateString('vi-VN')
        };

        this.vocabularyList.unshift(newWord);
        this.saveVocabToStorage();
        this.autoClassifySpecialCategories();
        this.renderCategoryChips();
        this.renderVocabularyGrid();

        if (this.confirmWordModal) this.confirmWordModal.style.display = 'none';
        if (this.creatorInput) this.creatorInput.value = '';

        alert('🎉 Đã xác nhận và thêm từ vựng mới vào bảng thành công!');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new KorScanApp();
});
