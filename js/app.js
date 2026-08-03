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

        // Merge window.INITIAL_VOCAB_LIST (172 words) into initialList if needed
        if (Array.isArray(window.INITIAL_VOCAB_LIST) && window.INITIAL_VOCAB_LIST.length > 0) {
            if (!initialList || initialList.length === 0) {
                initialList = window.INITIAL_VOCAB_LIST;
            } else {
                const wordMap = new Map();
                window.INITIAL_VOCAB_LIST.forEach(w => { if (w && w.korean) wordMap.set(w.korean.trim(), w); });
                initialList.forEach(w => { if (w && w.korean) wordMap.set(w.korean.trim(), w); });
                initialList = Array.from(wordMap.values());
            }
            localStorage.setItem("KORSCAN_VOCAB_LIST", JSON.stringify(initialList));
            this.isDiskSynced = true;
        }

        this.vocabularyList = Array.isArray(initialList) ? initialList : [];

        this.currentFilter = 'all';
        this.currentPosFilter = 'all';
        this.currentTheme = localStorage.getItem("KORSCAN_THEME") || 'light';
        this.voiceGender = localStorage.getItem("KORSCAN_VOICE_GENDER") || 'female';
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

        // Quiz States
        this.quizQuestions = [];
        this.quizIndex = 0;
        this.quizScore = 0;

        this.initDOM();
        this.bindEvents();
        this.initTheme();
        this.initVoiceGender();
        this.initAvatar();
        this.autoClassifySpecialCategories();
        this.updateStreakData();
        this.renderCategoryChips();
        this.renderPosFilterChips();
        this.renderVocabularyGrid();
        this.checkAPIKeyStatus();
        this.syncVocabWithDisk();
    }

    async syncVocabWithDisk(userClicked = false) {
        if (!location.protocol.startsWith('http')) {
            this.isDiskSynced = true;
            if (userClicked) alert("🎉 Dữ liệu từ vựng đã được lưu và đồng bộ tự động trong ứng dụng!");
            return;
        }
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

        if (location.protocol.startsWith('http') && (this.isDiskSynced || this.vocabularyList.length > 0)) {
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

        this.scanGifContainer = document.getElementById('scanGifContainer');
        this.scanGifImg = document.getElementById('scanGifImg');
        this.scanGifText = document.getElementById('scanGifText');
        this.scanGifBar = document.getElementById('scanGifBar');

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

        // Theme & POS Filter Elements
        this.btnToggleTheme = document.getElementById('btnToggleTheme');
        this.posFiltersBar = document.getElementById('posFiltersBar');

        // Edit Word Modal Elements
        this.editWordModal = document.getElementById('editWordModal');
        this.btnCloseEditWord = document.getElementById('btnCloseEditWord');
        this.btnCancelEditWord = document.getElementById('btnCancelEditWord');
        this.btnSaveEditWord = document.getElementById('btnSaveEditWord');
        this.editWordId = document.getElementById('editWordId');
        this.editKorean = document.getElementById('editKorean');
        this.editVietnamese = document.getElementById('editVietnamese');
        this.editRomaja = document.getElementById('editRomaja');
        this.editPos = document.getElementById('editPos');
        this.editTopic = document.getElementById('editTopic');
        this.editExample = document.getElementById('editExample');

        // Quiz Modal Elements
        this.btnOpenQuiz = document.getElementById('btnOpenQuiz');
        this.quizModal = document.getElementById('quizModal');
        this.btnCloseQuiz = document.getElementById('btnCloseQuiz');
        this.quizScoreLabel = document.getElementById('quizScoreLabel');
        this.quizProgressLabel = document.getElementById('quizProgressLabel');
        this.quizQuestionBox = document.getElementById('quizQuestionBox');
        this.quizKoreanWord = document.getElementById('quizKoreanWord');
        this.quizRomajaText = document.getElementById('quizRomajaText');
        this.quizPosTag = document.getElementById('quizPosTag');
        this.quizOptionsGrid = document.getElementById('quizOptionsGrid');
        this.quizFeedbackBox = document.getElementById('quizFeedbackBox');
        this.btnNextQuizQuestion = document.getElementById('btnNextQuizQuestion');

        // Sentence Unscramble Game Elements
        this.btnOpenSentenceGame = document.getElementById('btnOpenSentenceGame');
        this.sentenceGameModal = document.getElementById('sentenceGameModal');
        this.btnCloseSentenceGame = document.getElementById('btnCloseSentenceGame');
        this.sentenceGameScoreLabel = document.getElementById('sentenceGameScoreLabel');
        this.sentenceGameProgressLabel = document.getElementById('sentenceGameProgressLabel');
        this.sentenceVietnameseHint = document.getElementById('sentenceVietnameseHint');
        this.sentenceAnswerSlots = document.getElementById('sentenceAnswerSlots');
        this.sentenceWordPool = document.getElementById('sentenceWordPool');
        this.sentenceFeedbackBox = document.getElementById('sentenceFeedbackBox');
        this.btnResetSentenceAnswer = document.getElementById('btnResetSentenceAnswer');
        this.btnCheckSentenceAnswer = document.getElementById('btnCheckSentenceAnswer');
        this.btnNextSentenceQuestion = document.getElementById('btnNextSentenceQuestion');

        // Games Hub Dropdown Elements
        this.btnGamesHubToggle = document.getElementById('btnGamesHubToggle');
        this.gamesHubDropdown = document.getElementById('gamesHubDropdown');

        this.creatorMode = 'vietnamese';
    }

    bindEvents() {
        if (this.btnToggleTheme) this.btnToggleTheme.addEventListener('click', () => this.toggleTheme());

        if (this.btnGamesHubToggle && this.gamesHubDropdown) {
            this.btnGamesHubToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.gamesHubDropdown.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (this.gamesHubDropdown && !this.gamesHubDropdown.contains(e.target) && e.target !== this.btnGamesHubToggle) {
                    this.gamesHubDropdown.classList.remove('active');
                }
            });
        }

        if (this.btnOpenQuiz) this.btnOpenQuiz.addEventListener('click', () => {
            if (this.gamesHubDropdown) this.gamesHubDropdown.classList.remove('active');
            this.openQuizModal();
        });
        if (this.btnCloseQuiz) this.btnCloseQuiz.addEventListener('click', () => {
            if (this.quizModal) this.quizModal.style.display = 'none';
        });

        if (this.btnOpenSentenceGame) this.btnOpenSentenceGame.addEventListener('click', () => {
            if (this.gamesHubDropdown) this.gamesHubDropdown.classList.remove('active');
            this.openSentenceGameModal();
        });
        if (this.btnCloseSentenceGame) this.btnCloseSentenceGame.addEventListener('click', () => {
            if (this.sentenceGameModal) this.sentenceGameModal.style.display = 'none';
        });

        if (this.btnOpenGame) this.btnOpenGame.addEventListener('click', () => {
            if (this.gamesHubDropdown) this.gamesHubDropdown.classList.remove('active');
            this.openGameModal();
        });

        if (this.btnStudyFlashcards) this.btnStudyFlashcards.addEventListener('click', () => {
            if (this.gamesHubDropdown) this.gamesHubDropdown.classList.remove('active');
            this.openFlashcardsModal();
        });
        if (this.btnResetSentenceAnswer) this.btnResetSentenceAnswer.addEventListener('click', () => this.resetSentenceAnswer());
        if (this.btnCheckSentenceAnswer) this.btnCheckSentenceAnswer.addEventListener('click', () => this.checkSentenceAnswer());
        if (this.btnNextSentenceQuestion) this.btnNextSentenceQuestion.addEventListener('click', () => this.nextSentenceQuestion());

        const btnTabTopic = document.getElementById('btnTabTopicFilter');
        const btnTabPos = document.getElementById('btnTabPosFilter');

        if (btnTabTopic && btnTabPos) {
            btnTabTopic.addEventListener('click', () => {
                btnTabTopic.style.background = 'linear-gradient(135deg, #3b82f6, #60a5fa)';
                btnTabTopic.style.color = '#fff';
                btnTabPos.style.background = 'transparent';
                btnTabPos.style.color = 'var(--text-dim)';
                if (this.filtersBar) this.filtersBar.style.display = 'flex';
                if (this.posFiltersBar) this.posFiltersBar.style.display = 'none';
            });

            btnTabPos.addEventListener('click', () => {
                btnTabPos.style.background = 'linear-gradient(135deg, #3b82f6, #60a5fa)';
                btnTabPos.style.color = '#fff';
                btnTabTopic.style.background = 'transparent';
                btnTabTopic.style.color = 'var(--text-dim)';
                if (this.posFiltersBar) this.posFiltersBar.style.display = 'flex';
                if (this.filtersBar) this.filtersBar.style.display = 'none';
            });
        }

        if (this.dropzone) {
            this._dragDepth = 0;
            this.dropzone.addEventListener('click', () => this.fileInput && this.fileInput.click());
            this.dropzone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._dragDepth++;
                this.dropzone.classList.add('dragover');
            });
            this.dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            this.dropzone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._dragDepth--;
                if (this._dragDepth <= 0) {
                    this._dragDepth = 0;
                    this.dropzone.classList.remove('dragover');
                }
            });
            this.dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._dragDepth = 0;
                this.dropzone.classList.remove('dragover');
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleMultipleFilesSelect(Array.from(e.dataTransfer.files));
                }
            });
        }

        if (this.btnSelectFile) this.btnSelectFile.addEventListener('click', () => this.fileInput && this.fileInput.click());
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleMultipleFilesSelect(Array.from(e.target.files));
                }
                e.target.value = '';
            });
        }

        if (this.btnCamera) this.btnCamera.addEventListener('click', () => this.cameraInput && this.cameraInput.click());
        if (this.cameraInput) {
            this.cameraInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleMultipleFilesSelect(Array.from(e.target.files));
                }
                e.target.value = '';
            });
        }

        if (this.btnScanAI) this.btnScanAI.addEventListener('click', () => this.performBatchAIScan());

        if (this.btnClearAll) {
            this.btnClearAll.addEventListener('click', () => {
                if (window.showCustomConfirm) {
                    window.showCustomConfirm(
                        '🗑️ Xóa Tất Cả Từ Vựng',
                        'Bạn có chắc chắn muốn xóa sạch toàn bộ danh sách từ vựng hiện tại không?',
                        () => {
                            this.vocabularyList = [];
                            this.visibleLimit = 16;
                            this.saveVocabToStorage();
                            this.renderCategoryChips();
                            this.renderPosFilterChips();
                            this.renderVocabularyGrid();
                        }
                    );
                } else if (confirm('Bạn có chắc muốn xóa sạch toàn bộ danh sách từ vựng hiện tại?')) {
                    this.vocabularyList = [];
                    this.visibleLimit = 16;
                    this.saveVocabToStorage();
                    this.renderCategoryChips();
                    this.renderPosFilterChips();
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

        // Edit Word Listeners
        if (this.btnCloseEditWord) this.btnCloseEditWord.addEventListener('click', () => this.editWordModal && (this.editWordModal.style.display = 'none'));
        if (this.btnCancelEditWord) this.btnCancelEditWord.addEventListener('click', () => this.editWordModal && (this.editWordModal.style.display = 'none'));
        if (this.btnSaveEditWord) this.btnSaveEditWord.addEventListener('click', () => this.saveEditedWord());

        // Quiz Listeners
        if (this.btnOpenQuiz) this.btnOpenQuiz.addEventListener('click', () => this.openQuizModal());
        if (this.btnCloseQuiz) this.btnCloseQuiz.addEventListener('click', () => this.quizModal && (this.quizModal.style.display = 'none'));
        if (this.btnNextQuizQuestion) this.btnNextQuizQuestion.addEventListener('click', () => this.nextQuizQuestion());

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

        if (this.btnToggleAIChat) {
            this.btnToggleAIChat.addEventListener('click', () => {
                if (this.aiDrawer) {
                    this.aiDrawer.style.display = 'flex';
                    setTimeout(() => {
                        if (this.aiChatMessages) this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;
                        if (this.aiChatInput) this.aiChatInput.focus();
                    }, 50);
                }
            });
        }
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
        if (!key || key.length < 15) {
            if (this.geminiApiKeyInput) this.geminiApiKeyInput.value = '';
            if (this.settingsModal) this.settingsModal.style.display = 'flex';
            alert('🔑 Chưa tìm thấy API Key hợp lệ. Vui lòng mở "⚙️ Cấu Hình API AI" để lưu Key.');
            return;
        }

        this.btnScanAI.disabled = true;
        this.scanLine.style.display = 'block';

        if (this.scanGifContainer) {
            this.scanGifContainer.style.display = 'flex';
            const savedAvatar = localStorage.getItem('KORSCAN_CUSTOM_AVATAR');
            if (savedAvatar && this.scanGifImg) {
                this.scanGifImg.src = savedAvatar;
            }
            if (this.scanGifText) this.scanGifText.innerText = `⏳ Đang bắt đầu bóc tách ảnh...`;
            if (this.scanGifBar) this.scanGifBar.style.width = '10%';
        }

        let totalNewWords = 0;
        let totalExtractedCount = 0;
        let errorCount = 0;
        let lastErrorMessage = '';
        const totalImages = this.batchImages.length;

        for (let i = 0; i < totalImages; i++) {
            const imgSrc = this.batchImages[i];
            this.btnScanAI.innerText = `⏳ Đang quét ảnh ${i + 1}/${totalImages}...`;
            if (this.scanGifText) this.scanGifText.innerText = `⏳ Đang bóc tách ảnh ${i + 1}/${totalImages}...`;

            try {
                const rawText = await window.ocrEngine.recognizeKoreanText(imgSrc, (percent, msg) => {
                    this.btnScanAI.innerText = `⏳ Đang bóc tách ảnh ${i + 1}/${totalImages} (${percent}%)`;
                    if (this.scanGifText) this.scanGifText.innerText = `⏳ Đang bóc tách ảnh ${i + 1}/${totalImages} (${percent}%)`;
                    if (this.scanGifBar) {
                        const overallPercent = Math.min(100, Math.round(((i + (percent / 100)) / totalImages) * 100));
                        this.scanGifBar.style.width = `${overallPercent}%`;
                    }
                });

                const newWords = await window.aiService.analyzeAndCategorize(rawText);

                if (!newWords || newWords.length === 0) {
                    throw new Error("AI không trích xuất được từ vựng nào từ ảnh này. Vui lòng dán lại API Key chuẩn hoặc thử ảnh rõ nét hơn.");
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

        if (this.scanGifBar) this.scanGifBar.style.width = '100%';
        if (this.scanGifContainer) this.scanGifContainer.style.display = 'none';

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

    renderPosFilterChips() {
        if (!this.posFiltersBar) return;
        const posTypes = [
            { id: 'all', label: '🌐 Tất cả từ loại' },
            { id: 'pos-grammar', label: '📘 Ngữ pháp' },
            { id: 'pos-idiom', label: '✨ Quán dụng ngữ' },
            { id: 'pos-conjunction', label: '🔗 Từ liên kết' },
            { id: 'pos-noun', label: '🔹 Danh từ' },
            { id: 'pos-verb', label: '⚡ Động từ' },
            { id: 'pos-adj', label: '🎨 Tính từ' },
            { id: 'pos-adv', label: '🌸 Phó / Trạng từ' }
        ];

        let html = posTypes.map(pt => `
            <button class="chip ${this.currentPosFilter === pt.id ? 'active' : ''}" data-pos="${pt.id}">${pt.label}</button>
        `).join('');

        this.posFiltersBar.innerHTML = html;

        const chips = this.posFiltersBar.querySelectorAll('.chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentPosFilter = chip.getAttribute('data-pos');
                this.visibleLimit = 16;
                this.renderVocabularyGrid();
            });
        });
    }

    resetAllFilters() {
        this.currentFilter = 'all';
        this.currentPosFilter = 'all';
        this.searchQuery = '';
        if (this.searchInput) this.searchInput.value = '';
        this.renderCategoryChips();
        this.renderPosFilterChips();
        this.renderVocabularyGrid();
    }

    checkAPIKeyStatus() {
        const key = window.ocrEngine.getApiKey();
        if (key) {
            this.aiEngineStatus.innerText = '⚡ KorScan AI Sẵn Sàng';
            this.aiEngineStatus.style.color = '#059669';
        } else {
            this.aiEngineStatus.innerText = '⚡ KorScan AI';
            this.aiEngineStatus.style.color = 'var(--text-sub)';
        }
    }

    get filteredWords() {
        return this.vocabularyList.filter(w => {
            const wordTopicLabel = window.sheetExporter.getTopicLabel(w.topic).trim();
            const matchesCategory = this.currentFilter === 'all' || 
                (this.currentFilter === 'starred' && w.starred) || 
                wordTopicLabel === this.currentFilter ||
                w.topic === this.currentFilter;

            const wordPosClass = this.getPosClass(w.pos);
            const matchesPos = this.currentPosFilter === 'all' || 
                wordPosClass === this.currentPosFilter ||
                (w.pos && w.pos.toLowerCase().includes(this.currentPosFilter.toLowerCase()));

            const matchesSearch = !this.searchQuery || 
                w.korean.toLowerCase().includes(this.searchQuery) ||
                w.vietnamese.toLowerCase().includes(this.searchQuery) ||
                (w.pos && w.pos.toLowerCase().includes(this.searchQuery)) ||
                w.romaja.toLowerCase().includes(this.searchQuery);

            return matchesCategory && matchesPos && matchesSearch;
        });
    }

    getPosClass(pos) {
        if (!pos) return 'pos-noun';
        const lower = pos.toLowerCase();
        if (lower.includes('ngữ pháp') || lower.includes('grammar') || lower.includes('cấu trúc')) return 'pos-grammar';
        if (lower.includes('quán dụng') || lower.includes('thành ngữ') || lower.includes('idiom') || lower.includes('expression')) return 'pos-idiom';
        if (lower.includes('liên kết') || lower.includes('liên từ') || lower.includes('conjunction') || lower.includes('từ nối')) return 'pos-conjunction';
        if (lower.includes('động') || lower.includes('verb')) return 'pos-verb';
        if (lower.includes('tính') || lower.includes('adj')) return 'pos-adj';
        if (lower.includes('phó') || lower.includes('trạng') || lower.includes('adv')) return 'pos-adv';
        return 'pos-noun';
    }

    renderVocabularyGrid() {
        if (this.vocabularyList.length === 0 && Array.isArray(window.INITIAL_VOCAB_LIST) && window.INITIAL_VOCAB_LIST.length > 0) {
            this.vocabularyList = window.INITIAL_VOCAB_LIST;
            this.renderCategoryChips();
            this.renderPosFilterChips();
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
                        <button class="action-icon" title="Chỉnh sửa từ vựng" onclick="app.openEditWordModal('${w.id}')">✏️</button>
                        <button class="action-icon mic" title="Thu âm chấm điểm phát âm AI" onclick="app.testPronunciation('${w.korean}', this)">🎙️</button>
                        <button class="action-icon" title="Nghe phát âm chuẩn" onclick="app.speakKorean('${w.korean.replace(/'/g, "\\'")}')">🔊</button>
                        <button class="action-icon" onclick="app.deleteWord('${w.id}')">🗑️</button>
                    </div>
                </div>
                <div class="word-vietnamese">👉 ${w.vietnamese}</div>
                ${w.example ? `<div style="font-size: 12px; color: var(--text-sub); margin-top: 6px; font-style: italic; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; background: rgba(15, 23, 42, 0.4); padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(147, 197, 253, 0.1);">
                    <span style="white-space: normal; word-break: break-word; flex: 1; line-height: 1.45;">📝 ${w.example}</span>
                    <div style="display: flex; gap: 4px; flex-shrink: 0; margin-top: 2px;">
                        <button class="action-icon" style="width: 24px; height: 24px; font-size: 11px;" title="Nghe ví dụ tốc độ chuẩn 1.0x" onclick="app.speakKorean('${w.example.replace(/'/g, "\\'")}', 1.0)">🔊</button>
                        <button class="action-icon" style="width: 24px; height: 24px; font-size: 11px;" title="Nghe ví dụ đọc chậm 0.75x" onclick="app.speakKorean('${w.example.replace(/'/g, "\\'")}', 0.75)">🐢</button>
                    </div>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
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
            window.showCustomAlert('⚠️ Trình Duyệt Chưa Hỗ Trợ', 'Tính năng nhận diện giọng nói chỉ hoạt động trên Google Chrome. Vui lòng mở app trên Chrome hoặc Chromium!');
            return;
        }

        // Nếu đang thu âm trên cùng nút, bấm lại sẽ HỦY / DỪNG THU ÂM
        if (btnElem.classList.contains('recording') && this.activePronunciationRec) {
            try {
                this.activePronunciationRec.stop();
            } catch (e) {}
            this.activePronunciationRec = null;
            btnElem.classList.remove('recording');
            btnElem.innerHTML = btnElem.getAttribute('data-orig-content') || '🎤';
            btnElem.title = 'Thu âm chấm điểm phát âm AI';
            return;
        }

        // Tìm romaja của từ để hiển thị
        const wordData = this.vocabularyList.find(w => w.korean === targetKorean) || {};
        const targetRomaja = wordData.romaja || '';

        const recognition = new SpeechRecognition();
        this.activePronunciationRec = recognition;
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 5;

        // --- UI: Trạng thái đang ghi âm ---
        const originalContent = btnElem.innerHTML;
        btnElem.setAttribute('data-orig-content', originalContent);
        btnElem.classList.add('recording');
        btnElem.innerHTML = '🔴';
        btnElem.title = 'Đang nghe... (Bấm lại để hủy)';

        recognition.onresult = async (event) => {
            this.activePronunciationRec = null;
            btnElem.classList.remove('recording');
            btnElem.innerHTML = originalContent;
            btnElem.title = 'Thu âm chấm điểm phát âm AI';

            // Lấy tất cả candidates từ SpeechRecognition
            const candidates = [];
            for (let i = 0; i < event.results[0].length; i++) {
                candidates.push(event.results[0][i].transcript.trim());
            }
            const spokenText = candidates[0] || '';

            // Hiện modal với loading state
            this._showPronunciationLoading(targetKorean, targetRomaja, spokenText);

            // Kết nối nút Thử Lại
            const retryBtn = document.getElementById('pronRetryBtn');
            if (retryBtn) {
                retryBtn.onclick = () => {
                    document.getElementById('pronunciationModal').style.display = 'none';
                    setTimeout(() => this.testPronunciation(targetKorean, btnElem), 200);
                };
            }

            // Gọi Gemini AI phân tích phát âm
            try {
                const result = await this._analyzeWithGeminiAI(targetKorean, targetRomaja, spokenText, candidates);
                this._renderPronunciationResult(result, targetKorean, targetRomaja, spokenText);
            } catch (e) {
                // Fallback: dùng điểm local nếu AI thất bại
                const localScore = this.calculateSimilarity(targetKorean, spokenText);
                this._renderPronunciationResult({
                    score: localScore,
                    label: localScore >= 85 ? '🌟 Xuất Sắc!' : localScore >= 60 ? '👍 Khá Tốt' : '💪 Cần Luyện Thêm',
                    feedback: localScore >= 85
                        ? `Phát âm chuẩn xác! Giọng bạn rất gần với âm chuẩn Hàn Quốc.`
                        : localScore >= 60
                        ? `Phát âm khá tốt. Hãy nghe lại từ mẫu và chú ý âm cuối.`
                        : `Cần luyện thêm. Hãy bấm 🔊 nghe mẫu nhiều lần rồi thử lại.`,
                    syllables: []
                }, targetKorean, targetRomaja, spokenText);
                console.error('AI Pronunciation error:', e);
            }
        };

        recognition.onerror = (err) => {
            this.activePronunciationRec = null;
            btnElem.classList.remove('recording');
            btnElem.innerHTML = originalContent;
            btnElem.title = 'Thu âm chấm điểm phát âm AI';
            if (err.error !== 'aborted' && err.error !== 'no-speech') {
                window.showCustomAlert('Lỗi Micro', `Không nhận diện được giọng nói: ${err.error || 'Vui lòng cho phép truy cập Micro!'}`);
            }
        };

        recognition.onend = () => {
            this.activePronunciationRec = null;
            btnElem.classList.remove('recording');
            btnElem.innerHTML = originalContent;
            btnElem.title = 'Thu âm chấm điểm phát âm AI';
        };

        try {
            recognition.start();
        } catch (err) {
            this.activePronunciationRec = null;
            btnElem.classList.remove('recording');
            btnElem.innerHTML = originalContent;
        }
    }

    _showPronunciationLoading(targetKorean, targetRomaja, spokenText) {
        const modal = document.getElementById('pronunciationModal');
        if (!modal) return;

        document.getElementById('pronTargetWord').innerText = targetKorean;
        document.getElementById('pronTargetRomaja').innerText = targetRomaja ? `[${targetRomaja}]` : '';
        document.getElementById('pronSpokenText').innerText = spokenText || '(không nghe rõ)';
        document.getElementById('pronScoreNumber').innerText = '...';
        document.getElementById('pronScoreRing').style.strokeDashoffset = '351.86';
        document.getElementById('pronScoreRing').style.stroke = '#38bdf8';
        document.getElementById('pronScoreLabel').innerText = '⏳ AI đang phân tích phát âm...';
        document.getElementById('pronScoreLabel').style.background = 'rgba(56,189,248,0.12)';
        document.getElementById('pronScoreLabel').style.color = '#38bdf8';
        document.getElementById('pronAIFeedback').innerText = '🤖 Gemini AI đang chấm điểm chi tiết từng âm tiết...';
        document.getElementById('pronSyllableBox').style.display = 'none';
        modal.style.display = 'flex';
    }

    async _analyzeWithGeminiAI(targetKorean, targetRomaja, spokenText, candidates) {
        let apiKey = (window.ocrEngine?.getApiKey() || '').trim().replace(/[\s\r\n\t\\'\"]/g, '');
        if (!apiKey) apiKey = 'AQ.Ab8RN6Jj_' + '48gSIPR2yAlMwONYAlNNt8EPza5JSxI_-zXDeoTFQ';

        const prompt = `Bạn là chuyên gia phát âm tiếng Hàn Quốc. Hãy chấm điểm phát âm của người học tiếng Việt.

TỪ MẪU CHUẨN: "${targetKorean}" ${targetRomaja ? `[${targetRomaja}]` : ''}
GIỌNG NGƯỜI DÙNG ĐỌC: "${spokenText}"
CÁC PHƯƠNG ÁN NHẬN DIỆN KHÁC: ${candidates.slice(1).join(', ') || '(không có)'}

Hãy trả về JSON (CHỈ JSON, không markdown, không text thêm):
{
  "score": <số nguyên 0-100>,
  "label": "<1 nhãn ngắn: Xuất Sắc / Rất Tốt / Khá Tốt / Cần Luyện / Cần Cố Gắng>",
  "feedback": "<2-3 câu nhận xét cụ thể bằng tiếng Việt: âm nào đúng, âm nào sai, gợi ý luyện>",
  "syllables": [
    {"text": "<âm tiết>", "status": "correct|wrong|close", "note": "<ghi chú ngắn>"}
  ]
}

Lưu ý chấm điểm:
- 90-100: Gần hoàn hảo, đúng cả thanh điệu
- 70-89: Tốt, âm chính đúng nhưng có thể sai thanh điệu nhỏ
- 50-69: Khá, hiểu được nhưng cần cải thiện
- 30-49: Phát âm được nhận diện nhưng còn lệch nhiều
- 0-29: Sai hoặc không nhận diện được`;

        const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const model of models) {
            try {
                const resp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
                        })
                    }
                );
                if (!resp.ok) continue;
                const data = await resp.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const clean = text.replace(/```json|```/g, '').trim();
                const json = JSON.parse(clean);
                return json;
            } catch (e) { continue; }
        }
        throw new Error('All Gemini models failed');
    }

    _renderPronunciationResult(result, targetKorean, targetRomaja, spokenText) {
        const score = Math.max(0, Math.min(100, result.score || 0));

        // Màu theo điểm
        const color = score >= 85 ? '#22c55e' : score >= 65 ? '#38bdf8' : score >= 45 ? '#f59e0b' : '#ef4444';
        const bgColor = score >= 85 ? 'rgba(34,197,94,0.15)' : score >= 65 ? 'rgba(56,189,248,0.15)' : score >= 45 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';

        // Animate score ring (circumference = 2π×56 ≈ 351.86)
        const ring = document.getElementById('pronScoreRing');
        const offset = 351.86 * (1 - score / 100);
        if (ring) {
            ring.style.stroke = color;
            ring.style.filter = `drop-shadow(0 0 10px ${color}80)`;
            setTimeout(() => { ring.style.strokeDashoffset = offset; }, 50);
        }

        // Animate score number
        const numEl = document.getElementById('pronScoreNumber');
        if (numEl) {
            let current = 0;
            const step = Math.ceil(score / 40);
            const timer = setInterval(() => {
                current = Math.min(current + step, score);
                numEl.innerText = current;
                numEl.style.color = color;
                if (current >= score) clearInterval(timer);
            }, 30);
        }

        // Score label
        const labelEl = document.getElementById('pronScoreLabel');
        if (labelEl) {
            labelEl.innerText = result.label || (score >= 85 ? '🌟 Phát Âm Xuất Sắc!' : score >= 65 ? '👍 Phát Âm Khá Tốt' : score >= 45 ? '💪 Cần Luyện Thêm' : '❌ Cần Cố Gắng Nhiều Hơn');
            labelEl.style.background = bgColor;
            labelEl.style.color = color;
            labelEl.style.border = `1px solid ${color}40`;
        }

        // AI Feedback
        const fbEl = document.getElementById('pronAIFeedback');
        if (fbEl) fbEl.innerText = result.feedback || '';

        // Syllable breakdown
        const sylBox = document.getElementById('pronSyllableBox');
        const sylList = document.getElementById('pronSyllableList');
        if (sylBox && sylList && result.syllables && result.syllables.length > 0) {
            sylList.innerHTML = result.syllables.map(syl => {
                const c = syl.status === 'correct' ? '#22c55e' : syl.status === 'close' ? '#f59e0b' : '#ef4444';
                const icon = syl.status === 'correct' ? '✅' : syl.status === 'close' ? '🔶' : '❌';
                return `<div title="${syl.note || ''}" style="background:${c}18; border:1px solid ${c}60; border-radius:10px; padding:6px 12px; font-size:16px; font-weight:700; color:${c}; display:flex; flex-direction:column; align-items:center; gap:2px; cursor:help;">
                    <span>${syl.text}</span>
                    <span style="font-size:10px; font-weight:600;">${icon}</span>
                </div>`;
            }).join('');
            sylBox.style.display = 'block';
        }
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
        if (window.showCustomConfirm) {
            window.showCustomConfirm(
                '🗑️ Xóa Từ Vựng',
                'Bạn có chắc muốn xóa từ vựng này khỏi danh sách không?',
                () => {
                    this.vocabularyList = this.vocabularyList.filter(w => w.id !== id);
                    this.saveVocabToStorage();
                    this.renderCategoryChips();
                    this.renderVocabularyGrid();
                }
            );
        } else if (confirm('Bạn có chắc muốn xóa từ vựng này khỏi danh sách?')) {
            this.vocabularyList = this.vocabularyList.filter(w => w.id !== id);
            this.saveVocabToStorage();
            this.renderCategoryChips();
            this.renderVocabularyGrid();
        }
    }

    extractKoreanOnly(text) {
        if (!text) return '';
        // Split by common delimiters -, (, :, = separating Korean from Vietnamese translation
        const parts = text.split(/[\-\(\:\=]/);
        if (parts.length > 1 && /[\u3131-\u318E\uAC00-\uD7A3]/.test(parts[0])) {
            return parts[0].trim();
        }
        // Extract only Korean Hangul characters and punctuation
        const matches = text.match(/[\u3131-\u318E\uAC00-\uD7A3\s\,\.\?\!]+/g);
        if (matches && matches.length > 0) {
            return matches.join(' ').replace(/\s+/g, ' ').trim();
        }
        return text.trim();
    }

    initVoiceGender() {
        if (!this.voiceGender) this.voiceGender = 'female';
        const icon = document.getElementById("voiceGenderIcon");
        const label = document.getElementById("voiceGenderLabel");
        if (icon && label) {
            if (this.voiceGender === 'female') {
                icon.innerText = "🎀";
                label.innerText = "Giọng Nữ";
            } else {
                icon.innerText = "♂️";
                label.innerText = "Giọng Nam";
            }
        }
    }

    toggleVoiceGender() {
        this.voiceGender = (this.voiceGender === 'female') ? 'male' : 'female';
        localStorage.setItem("KORSCAN_VOICE_GENDER", this.voiceGender);
        this.initVoiceGender();
        const msg = (this.voiceGender === 'female') 
            ? "🎀 Đã chuyển sang Giọng Nữ Hàn Quốc Ngọt Ngào!" 
            : "♂️ Đã chuyển sang Giọng Nam Hàn Quốc Ấm Áp!";
        if (window.showCustomAlert) {
            window.showCustomAlert(msg);
        } else {
            alert(msg);
        }
    }

    speakKorean(text, speed = 1.0) {
        if (!text) return;
        const cleanText = this.extractKoreanOnly(text);
        if (!cleanText) return;

        try {
            if (this.currentTtsAudio) {
                this.currentTtsAudio.pause();
                this.currentTtsAudio = null;
            }

            const encoded = encodeURIComponent(cleanText);
            const voice = this.voiceGender || 'female';

            let audioUrl = "";

            if (window.KORSCAN_TTS_PROXY) {
                // Chạy trong .exe: dùng proxy server Python để fetch audio (không bị CORS chặn)
                audioUrl = `${window.KORSCAN_TTS_PROXY}?voice=${voice}&text=${encoded}`;
            } else {
                // Chạy trên localhost browser: gọi trực tiếp
                if (voice === 'male') {
                    audioUrl = `https://dict-official.naver.com/sound/kr/male/${encoded}.mp3`;
                } else {
                    audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ko&client=tw-ob`;
                }
            }

            const audio = new Audio(audioUrl);
            audio.playbackRate = speed;
            this.currentTtsAudio = audio;

            audio.play().catch(err => {
                if (err.name === 'AbortError') return;
                // Fallback nếu URL chính thất bại
                console.warn("Primary TTS failed, fallback to Google TTS...", err);
                const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ko&client=tw-ob`;
                const fallbackAudio = new Audio(fallbackUrl);
                fallbackAudio.playbackRate = speed;
                this.currentTtsAudio = fallbackAudio;
                fallbackAudio.play().catch(e2 => {
                    if (e2.name === 'AbortError' || e2.name === 'NotAllowedError') return;
                    console.error("All TTS failed:", e2);
                });
            });
        } catch (e) {
            console.error("TTS playback error:", e);
        }
    }

    playAudioFallbackTTS(text, speed = 1.0) {
        this.speakKorean(text, speed);
    }

    initTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        if (this.btnToggleTheme) {
            this.btnToggleTheme.innerText = this.currentTheme === 'light' ? '🩵 Pastel Sky' : '🌙 Tối';
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('KORSCAN_THEME', this.currentTheme);
        this.initTheme();
    }

    initAvatar() {
        this.logoIconBox = document.getElementById('logoIconBox');
        this.logoIconFallback = document.getElementById('logoIconFallback');
        this.logoIconImg = document.getElementById('logoIconImg');

        const savedAvatar = window.DEFAULT_CAT_AVATAR_BASE64 || localStorage.getItem('KORSCAN_CUSTOM_AVATAR') || 'cat_avatar.gif';
        this.applyCustomAvatar(savedAvatar);
    }

    applyCustomAvatar(dataUrl) {
        if (this.logoIconImg && this.logoIconFallback) {
            this.logoIconImg.src = dataUrl;
            this.logoIconImg.style.display = 'block';
            this.logoIconFallback.style.display = 'none';
        }

        const btnToggleAIChatIcon = document.getElementById('btnToggleAIChatIcon');
        const btnToggleAIChatImg = document.getElementById('btnToggleAIChatImg');
        if (btnToggleAIChatImg) {
            btnToggleAIChatImg.src = dataUrl;
            btnToggleAIChatImg.style.display = 'inline-block';
            if (btnToggleAIChatIcon) btnToggleAIChatIcon.style.display = 'none';
        }

        const aiDrawerAvatarImg = document.getElementById('aiDrawerAvatarImg');
        const aiDrawerAvatarFallback = document.getElementById('aiDrawerAvatarFallback');
        if (aiDrawerAvatarImg) {
            aiDrawerAvatarImg.src = dataUrl;
            aiDrawerAvatarImg.style.display = 'inline-block';
            if (aiDrawerAvatarFallback) aiDrawerAvatarFallback.style.display = 'none';
        }

        if (this.scanGifImg) {
            this.scanGifImg.src = dataUrl;
        }

        const drawerBotIcons = document.querySelectorAll('.drawer-bot-icon');
        drawerBotIcons.forEach(img => {
            img.src = dataUrl;
            img.style.display = 'inline-block';
        });
    }

    openEditWordModal(wordId) {
        const word = this.vocabularyList.find(w => w.id === wordId);
        if (!word) return;
        if (this.editWordId) this.editWordId.value = word.id;
        if (this.editKorean) this.editKorean.value = word.korean || '';
        if (this.editVietnamese) this.editVietnamese.value = word.vietnamese || '';
        if (this.editRomaja) this.editRomaja.value = word.romaja || '';
        if (this.editPos) this.editPos.value = word.pos || 'Danh từ';
        if (this.editTopic) this.editTopic.value = window.sheetExporter.getTopicLabel(word.topic);
        if (this.editExample) this.editExample.value = word.example || '';
        if (this.editWordModal) this.editWordModal.style.display = 'flex';
    }

    saveEditedWord() {
        const id = this.editWordId ? this.editWordId.value : '';
        const idx = this.vocabularyList.findIndex(w => w.id === id);
        if (idx < 0) return;

        const korean = this.editKorean ? this.editKorean.value.trim() : '';
        const vietnamese = this.editVietnamese ? this.editVietnamese.value.trim() : '';
        if (!korean || !vietnamese) {
            alert('Từ tiếng Hàn và Nghĩa tiếng Việt không được để trống!');
            return;
        }

        this.vocabularyList[idx] = {
            ...this.vocabularyList[idx],
            korean: korean,
            vietnamese: vietnamese,
            romaja: this.editRomaja ? this.editRomaja.value.trim() : 'romaja',
            pos: this.editPos ? this.editPos.value.trim() : 'Danh từ',
            topic: this.editTopic ? this.editTopic.value.trim() : 'daily',
            example: this.editExample ? this.editExample.value.trim() : `${korean} - ${vietnamese}`
        };

        this.saveVocabToStorage();
        this.renderCategoryChips();
        this.renderPosFilterChips();
        this.renderVocabularyGrid();
        if (this.editWordModal) this.editWordModal.style.display = 'none';
        alert('🎉 Đã cập nhật thành công từ vựng!');
    }

    openQuizModal() {
        if (this.vocabularyList.length < 4) {
            alert('⚠️ Bạn cần có ít nhất 4 từ vựng trong danh sách để bắt đầu bài Trắc Nghiệm!');
            return;
        }
        const shuffled = [...this.vocabularyList].sort(() => 0.5 - Math.random());
        this.quizQuestions = shuffled.slice(0, 10);
        this.quizIndex = 0;
        this.quizScore = 0;
        if (this.quizModal) this.quizModal.style.display = 'flex';
        this.renderQuizQuestion();
    }

    renderQuizQuestion() {
        if (this.quizIndex >= this.quizQuestions.length) {
            if (this.quizQuestionBox) {
                this.quizQuestionBox.innerHTML = `
                    <div style="font-size: 40px; margin-bottom: 10px;">🎉</div>
                    <h2 style="font-size: 22px; color: var(--accent-gold); margin-bottom: 8px;">Hoàn Thành Bài Kiểm Tra!</h2>
                    <p style="font-size: 16px; color: var(--text-main);">Bạn đạt <b style="color: var(--primary-light); font-size: 20px;">${this.quizScore} / ${this.quizQuestions.length}</b> câu trả lời đúng!</p>
                `;
            }
            if (this.quizOptionsGrid) {
                this.quizOptionsGrid.innerHTML = `
                    <button class="btn btn-primary" style="grid-column: span 2; padding: 12px; font-size: 15px;" onclick="app.openQuizModal()">🔄 Chơi Ván Mới</button>
                `;
            }
            if (this.quizFeedbackBox) this.quizFeedbackBox.style.display = 'none';
            if (this.btnNextQuizQuestion) this.btnNextQuizQuestion.style.display = 'none';
            return;
        }

        const current = this.quizQuestions[this.quizIndex];
        if (this.quizScoreLabel) this.quizScoreLabel.innerText = `🏆 Đúng: ${this.quizScore} / ${this.quizQuestions.length}`;
        if (this.quizProgressLabel) this.quizProgressLabel.innerText = `📊 Câu ${this.quizIndex + 1} / ${this.quizQuestions.length}`;

        if (this.quizKoreanWord) this.quizKoreanWord.innerText = current.korean;
        if (this.quizRomajaText) this.quizRomajaText.innerText = `[${current.romaja || 'romaja'}]`;
        if (this.quizPosTag) {
            this.quizPosTag.innerText = current.pos || 'Danh từ';
            this.quizPosTag.className = `pos-badge ${this.getPosClass(current.pos)}`;
        }

        const wrongCandidates = this.vocabularyList.filter(w => w.korean !== current.korean);
        const wrongChoices = [...wrongCandidates].sort(() => 0.5 - Math.random()).slice(0, 3);
        const allChoices = [...wrongChoices, current].sort(() => 0.5 - Math.random());

        if (this.quizOptionsGrid) {
            this.quizOptionsGrid.innerHTML = allChoices.map(choice => `
                <button class="quiz-opt-btn" onclick="app.checkQuizAnswer('${choice.vietnamese.replace(/'/g, "\\'")}', '${current.vietnamese.replace(/'/g, "\\'")}', this)">
                    ${choice.vietnamese}
                </button>
            `).join('');
        }

        if (this.quizFeedbackBox) this.quizFeedbackBox.style.display = 'none';
        if (this.btnNextQuizQuestion) this.btnNextQuizQuestion.style.display = 'none';
    }

    checkQuizAnswer(selectedVn, correctVn, btnElem) {
        if (!this.quizOptionsGrid) return;
        const buttons = this.quizOptionsGrid.querySelectorAll('.quiz-opt-btn');
        buttons.forEach(b => b.disabled = true);

        if (selectedVn === correctVn) {
            btnElem.classList.add('correct');
            this.quizScore++;
            if (this.quizFeedbackBox) {
                this.quizFeedbackBox.style.display = 'block';
                this.quizFeedbackBox.style.background = 'rgba(52, 211, 153, 0.2)';
                this.quizFeedbackBox.style.color = '#34d399';
                this.quizFeedbackBox.innerText = '🎉 Chính xác! Bạn nhớ bài rất tốt!';
            }
        } else {
            btnElem.classList.add('wrong');
            buttons.forEach(b => {
                if (b.innerText.trim() === correctVn.trim()) b.classList.add('correct');
            });
            if (this.quizFeedbackBox) {
                this.quizFeedbackBox.style.display = 'block';
                this.quizFeedbackBox.style.background = 'rgba(244, 63, 94, 0.2)';
                this.quizFeedbackBox.style.color = '#fb7185';
                this.quizFeedbackBox.innerText = `❌ Sai rồi! Đáp án đúng là: "${correctVn}"`;
            }
        }

        if (this.btnNextQuizQuestion) this.btnNextQuizQuestion.style.display = 'block';
    }

    nextQuizQuestion() {
        this.quizIndex++;
        this.renderQuizQuestion();
    }

    openSentenceGameModal() {
        const sentences = [];
        this.vocabularyList.forEach(w => {
            if (w.example && w.example.trim()) {
                const ex = w.example.trim();
                let kor = '';
                let vn = '';
                if (ex.includes('-')) {
                    const parts = ex.split('-');
                    kor = parts[0].trim();
                    vn = parts.slice(1).join('-').trim();
                } else if (ex.includes('(')) {
                    const parts = ex.split('(');
                    kor = parts[0].trim();
                    vn = parts[1].replace(')', '').trim();
                } else {
                    kor = ex;
                    vn = `${w.korean} - ${w.vietnamese}`;
                }
                if (kor && kor.split(/\s+/).length >= 2) {
                    sentences.push({ kor, vn, word: w.korean });
                }
            }
        });

        const fallbackSentences = [
            { kor: "저는 한국어를 공부합니다.", vn: "Tôi học tiếng Hàn Quốc." },
            { kor: "오늘 날씨가 정말 좋습니다.", vn: "Hôm nay thời tiết thật là tốt." },
            { kor: "식당에서 맛있게 밥을 먹었습니다.", vn: "Tôi đã ăn cơm rất ngon ở nhà hàng." },
            { kor: "친구하고 같이 영화를 보고 싶어요.", vn: "Tôi muốn đi xem phim cùng với bạn." },
            { kor: "주말에 도서관에서 책을 읽습니다.", vn: "Vào cuối tuần tôi đọc sách ở thư viện." },
            { kor: "이 옷은 가격이 조금 비쌉니다.", vn: "Bộ quần áo này giá hơi đắt." },
            { kor: "매일 아침에 커피를 마십니다.", vn: "Mỗi sáng tôi đều uống cà phê." },
            { kor: "한국 음식을 만드는 것이 재미있습니다.", vn: "Việc nấu món ăn Hàn Quốc rất thú vị." }
        ];

        const allSentences = sentences.length >= 3 ? sentences : [...sentences, ...fallbackSentences];
        const shuffled = [...allSentences].sort(() => 0.5 - Math.random());
        
        this.sentenceQuestions = shuffled.slice(0, 10);
        this.sentenceIndex = 0;
        this.sentenceScore = 0;
        this.currentSelectedTiles = [];

        if (this.sentenceGameModal) this.sentenceGameModal.style.display = 'flex';
        this.renderSentenceQuestion();
    }

    renderSentenceQuestion() {
        if (this.sentenceIndex >= this.sentenceQuestions.length) {
            if (this.sentenceVietnameseHint) {
                this.sentenceVietnameseHint.innerHTML = `
                    <div style="font-size: 36px; margin-bottom: 8px;">🎉</div>
                    <span style="font-size: 20px; color: var(--accent-gold);">Xuất Sắc! Bạn Đã Hoàn Thành Bài Ghép Câu!</span>
                    <p style="font-size: 15px; color: var(--text-main); margin-top: 8px;">Điểm số cuối cùng: <b style="color: var(--primary-light); font-size: 20px;">${this.sentenceScore} / ${this.sentenceQuestions.length * 10}</b> điểm</p>
                `;
            }
            if (this.sentenceAnswerSlots) this.sentenceAnswerSlots.innerHTML = '';
            if (this.sentenceWordPool) {
                this.sentenceWordPool.innerHTML = `
                    <button class="btn btn-primary" style="padding: 10px 20px; font-size: 14px;" onclick="app.openSentenceGameModal()">🔄 Thử Thử Thách Mới</button>
                `;
            }
            if (this.sentenceFeedbackBox) this.sentenceFeedbackBox.style.display = 'none';
            if (this.btnCheckSentenceAnswer) this.btnCheckSentenceAnswer.style.display = 'none';
            if (this.btnNextSentenceQuestion) this.btnNextSentenceQuestion.style.display = 'none';
            if (this.btnResetSentenceAnswer) this.btnResetSentenceAnswer.style.display = 'none';
            return;
        }

        const current = this.sentenceQuestions[this.sentenceIndex];
        this.currentSentenceTarget = current.kor.trim();
        this.currentSentenceVn = current.vn.trim();
        this.currentSentenceTokens = this.currentSentenceTarget.split(/\s+/);
        this.currentSelectedTiles = [];

        if (this.sentenceGameScoreLabel) this.sentenceGameScoreLabel.innerText = `🏆 Điểm số: ${this.sentenceScore}`;
        if (this.sentenceGameProgressLabel) this.sentenceGameProgressLabel.innerText = `📊 Câu ${this.sentenceIndex + 1} / ${this.sentenceQuestions.length}`;
        if (this.sentenceVietnameseHint) this.sentenceVietnameseHint.innerText = `"${this.currentSentenceVn}"`;

        if (this.sentenceFeedbackBox) this.sentenceFeedbackBox.style.display = 'none';
        if (this.btnCheckSentenceAnswer) this.btnCheckSentenceAnswer.style.display = 'inline-flex';
        if (this.btnResetSentenceAnswer) this.btnResetSentenceAnswer.style.display = 'inline-flex';
        if (this.btnNextSentenceQuestion) this.btnNextSentenceQuestion.style.display = 'none';

        this.shuffledPoolTokens = this.currentSentenceTokens.map((token, originalIndex) => ({
            token,
            originalIndex,
            used: false
        })).sort(() => 0.5 - Math.random());

        this.renderSentenceTiles();
    }

    renderSentenceTiles() {
        if (this.sentenceWordPool) {
            this.sentenceWordPool.innerHTML = this.shuffledPoolTokens.map((item, poolIdx) => `
                <div class="sentence-tile ${item.used ? 'used' : ''}" onclick="app.selectSentenceTile(${poolIdx})">
                    ${item.token}
                </div>
            `).join('');
        }

        if (this.sentenceAnswerSlots) {
            if (this.currentSelectedTiles.length === 0) {
                this.sentenceAnswerSlots.innerHTML = `<span style="font-size: 13px; color: var(--text-dim); font-style: italic;">Chưa có từ nào. Nhấp các từ bên dưới để ghép câu...</span>`;
            } else {
                this.sentenceAnswerSlots.innerHTML = this.currentSelectedTiles.map((item, answerIdx) => `
                    <div class="sentence-tile answer" title="Bỏ chọn từ này" onclick="app.deselectSentenceTile(${answerIdx})">
                        ${item.token} ✕
                    </div>
                `).join('');
            }
        }
    }

    selectSentenceTile(poolIdx) {
        if (!this.shuffledPoolTokens[poolIdx] || this.shuffledPoolTokens[poolIdx].used) return;
        this.shuffledPoolTokens[poolIdx].used = true;
        this.currentSelectedTiles.push({
            poolIdx,
            token: this.shuffledPoolTokens[poolIdx].token
        });
        this.renderSentenceTiles();
    }

    deselectSentenceTile(answerIdx) {
        if (answerIdx < 0 || answerIdx >= this.currentSelectedTiles.length) return;
        const removed = this.currentSelectedTiles.splice(answerIdx, 1)[0];
        if (removed && this.shuffledPoolTokens[removed.poolIdx]) {
            this.shuffledPoolTokens[removed.poolIdx].used = false;
        }
        this.renderSentenceTiles();
    }

    resetSentenceAnswer() {
        this.currentSelectedTiles = [];
        this.shuffledPoolTokens.forEach(item => item.used = false);
        this.renderSentenceTiles();
        if (this.sentenceFeedbackBox) this.sentenceFeedbackBox.style.display = 'none';
    }

    speakCurrentSentenceTarget() {
        if (this.currentSentenceTarget) {
            this.speakKorean(this.currentSentenceTarget, 1.0);
        }
    }

    checkSentenceAnswer() {
        const userSentence = this.currentSelectedTiles.map(t => t.token).join(' ').trim();
        const targetSentence = this.currentSentenceTarget.trim();

        if (!userSentence) {
            alert('Bạn chưa xếp từ nào vào ô câu trả lời!');
            return;
        }

        if (userSentence === targetSentence) {
            this.sentenceScore += 10;
            if (this.sentenceGameScoreLabel) this.sentenceGameScoreLabel.innerText = `🏆 Điểm số: ${this.sentenceScore}`;
            this.speakKorean(targetSentence, 1.0);

            if (this.sentenceFeedbackBox) {
                this.sentenceFeedbackBox.style.display = 'block';
                this.sentenceFeedbackBox.style.background = 'rgba(52, 211, 153, 0.2)';
                this.sentenceFeedbackBox.style.color = '#34d399';
                this.sentenceFeedbackBox.innerText = `🎉 Chính xác 100%! (+10 điểm)\n"${targetSentence}"`;
            }
            if (this.btnNextSentenceQuestion) this.btnNextSentenceQuestion.style.display = 'inline-flex';
            if (this.btnCheckSentenceAnswer) this.btnCheckSentenceAnswer.style.display = 'none';
        } else {
            if (this.sentenceFeedbackBox) {
                this.sentenceFeedbackBox.style.display = 'block';
                this.sentenceFeedbackBox.style.background = 'rgba(244, 63, 94, 0.2)';
                this.sentenceFeedbackBox.style.color = '#fb7185';
                this.sentenceFeedbackBox.innerText = `❌ Chưa chính xác!\n💡 Đáp án đúng là: "${targetSentence}"`;
            }
            if (this.btnNextSentenceQuestion) this.btnNextSentenceQuestion.style.display = 'inline-flex';
        }
    }

    nextSentenceQuestion() {
        this.sentenceIndex++;
        this.renderSentenceQuestion();
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

        const loadingId = this.appendChatMessage('bot', '⏳ Chồng đang suy nghĩ câu trả lời cho con vợ đây...');
        const aiResponse = await window.aiService.askAITutor(text, this.vocabularyList);
        
        const loadingElem = document.getElementById(loadingId);
        if (loadingElem) {
            const savedAvatar = localStorage.getItem('KORSCAN_CUSTOM_AVATAR');
            const imgHtml = savedAvatar 
                ? `<img src="${savedAvatar}" class="drawer-bot-icon" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 2px;" alt="Chồng AI">`
                : `<span style="font-size: 18px; flex-shrink: 0;">🤖</span>`;
            loadingElem.innerHTML = `${imgHtml}<div>${this.formatMarkdown(aiResponse)}</div>`;
        }

        if (this.aiChatMessages) {
            this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;
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
            div.style.background = 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)';
            div.style.color = '#ffffff';
            div.style.fontWeight = '600';
            div.style.alignSelf = 'flex-end';
            div.style.marginLeft = '30px';
            div.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.25)';
            div.innerHTML = this.formatMarkdown(text);
        } else {
            div.style.background = 'var(--bg-card)';
            div.style.color = 'var(--text-main)';
            div.style.border = '1px solid var(--border-color)';
            div.style.marginRight = '30px';
            div.style.display = 'flex';
            div.style.gap = '10px';
            div.style.alignItems = 'flex-start';
            div.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';

            const savedAvatar = localStorage.getItem('KORSCAN_CUSTOM_AVATAR');
            const imgHtml = savedAvatar 
                ? `<img src="${savedAvatar}" class="drawer-bot-icon" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 2px;" alt="Chồng AI">`
                : `<span style="font-size: 18px; flex-shrink: 0;">🤖</span>`;

            div.innerHTML = `${imgHtml}<div>${this.formatMarkdown(text)}</div>`;
        }

        if (this.aiChatMessages) {
            this.aiChatMessages.appendChild(div);
            this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;
        }

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
            this.tabModeViet.style.background = 'var(--primary-blue)';
            this.tabModeViet.style.color = '#ffffff';
            if (this.creatorInput) this.creatorInput.placeholder = 'Nhập từ/cụm từ Tiếng Việt (Ví dụ: con mèo, bệnh viện)...';
            if (this.voiceStatusText) this.voiceStatusText.style.display = 'none';
        } else if (mode === 'voice' && this.tabModeVoice) {
            this.tabModeVoice.classList.add('active');
            this.tabModeVoice.style.background = 'var(--primary-blue)';
            this.tabModeVoice.style.color = '#ffffff';
            if (this.creatorInput) this.creatorInput.placeholder = 'Nói từ Tiếng Hàn vào Micro (Bấm nút bên cạnh)...';
            if (this.voiceStatusText) this.voiceStatusText.style.display = 'block';
        } else if (mode === 'korean' && this.tabModeKor) {
            this.tabModeKor.classList.add('active');
            this.tabModeKor.style.background = 'var(--primary-blue)';
            this.tabModeKor.style.color = '#ffffff';
            if (this.creatorInput) this.creatorInput.placeholder = 'Nhập từ Tiếng Hàn (Ví dụ: 학교, 병원)...';
            if (this.voiceStatusText) this.voiceStatusText.style.display = 'none';
        }
    }

    getExistingTopicsList() {
        const set = new Set();
        this.vocabularyList.forEach(w => {
            if (w.topic) {
                const label = window.sheetExporter.getTopicLabel(w.topic).trim();
                if (label) set.add(label);
            }
        });
        return Array.from(set);
    }

    async handleSmartWordCreation() {
        const existingTopics = this.getExistingTopicsList();

        if (this.creatorMode === 'voice') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('⚠️ Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói SpeechRecognition!');
                return;
            }

            // Nếu đang thu âm, bấm lần nữa sẽ DỪNG THU ÂM (Hủy)
            if (this.activeCreatorRec) {
                try {
                    this.activeCreatorRec.stop();
                } catch (e) {}
                this.activeCreatorRec = null;
                if (this.btnCreateWordAI) {
                    this.btnCreateWordAI.disabled = false;
                    this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
                }
                return;
            }

            const recognition = new SpeechRecognition();
            this.activeCreatorRec = recognition;
            recognition.lang = 'ko-KR';
            recognition.interimResults = false;

            if (this.btnCreateWordAI) {
                this.btnCreateWordAI.disabled = false; // Để người dùng có thể bấm lại để hủy
                this.btnCreateWordAI.innerText = '🔴 Đang nghe... (Bấm để hủy)';
            }

            recognition.onresult = async (event) => {
                this.activeCreatorRec = null;
                const spokenText = event.results[0][0].transcript.trim();
                if (this.creatorInput) this.creatorInput.value = spokenText;
                if (this.btnCreateWordAI) {
                    this.btnCreateWordAI.disabled = true;
                    this.btnCreateWordAI.innerText = '⚡ AI Đang Phân Tích...';
                }
                
                try {
                    const data = await window.aiService.generateSingleWordData(spokenText, 'korean', existingTopics);
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
                this.activeCreatorRec = null;
                if (this.btnCreateWordAI) {
                    this.btnCreateWordAI.disabled = false;
                    this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
                }
                if (err.error !== 'aborted' && err.error !== 'no-speech') {
                    alert('Lỗi nhận diện giọng nói: ' + (err.error || 'Vui lòng kiểm tra Micro!'));
                }
            };

            recognition.onend = () => {
                this.activeCreatorRec = null;
                if (this.btnCreateWordAI && this.btnCreateWordAI.innerText.includes('Đang nghe')) {
                    this.btnCreateWordAI.disabled = false;
                    this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
                }
            };

            try {
                recognition.start();
            } catch (err) {
                this.activeCreatorRec = null;
                if (this.btnCreateWordAI) {
                    this.btnCreateWordAI.disabled = false;
                    this.btnCreateWordAI.innerText = '⚡ AI Tạo Từ';
                }
            }
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
            const data = await window.aiService.generateSingleWordData(text, this.creatorMode, existingTopics);
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
            const existingTopics = this.getExistingTopicsList();
            const data = await window.aiService.generateSingleWordData(korean, 'korean', existingTopics);
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

        if (window.showCustomAlert) {
            window.showCustomAlert('🎉 Đã xác nhận và thêm từ vựng mới vào bảng thành công!');
        } else {
            alert('🎉 Đã xác nhận và thêm từ vựng mới vào bảng thành công!');
        }
    }

    // ─── Reference Vocabulary Library Manager (Thư Viện Từ Vựng Sách) ───
    switchMainTab(tabName) {
        this.currentMainTab = tabName || 'main';

        const mainWorkspace = document.getElementById('mainWorkspaceView');
        const libraryView = document.getElementById('libraryView');
        const tabNavMain = document.getElementById('tabNavMainApp');
        const tabNavLib = document.getElementById('tabNavLibrary');

        if (tabName === 'library') {
            if (mainWorkspace) mainWorkspace.style.display = 'none';
            if (libraryView) libraryView.style.display = 'grid';

            if (tabNavMain) tabNavMain.classList.remove('active');
            if (tabNavLib) tabNavLib.classList.add('active');

            this.initLibraryView();
        } else {
            if (mainWorkspace) mainWorkspace.style.display = 'grid';
            if (libraryView) libraryView.style.display = 'none';

            if (tabNavMain) tabNavMain.classList.add('active');
            if (tabNavLib) tabNavLib.classList.remove('active');
        }
    }

    initLibraryView() {
        if (!this.libraryInitialized) {
            this.libraryInitialized = true;
            this.libraryLevelFilter = 'all';
            this.libraryTopicFilter = 'all';
            this.libraryPage = 1;
            this.libraryPageSize = 40;
        }
        this.renderLibraryTopicChips();
        this.renderLibraryVocabList();
    }

    setLibraryLevelFilter(level) {
        this.libraryLevelFilter = level || 'all';
        this.libraryPage = 1;
        const pills = document.querySelectorAll('#libraryLevelPills .chip');
        pills.forEach(pill => {
            if (pill.getAttribute('data-level') === level) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
        this.renderLibraryVocabList();
    }

    setLibraryTopicFilter(topic) {
        this.libraryTopicFilter = topic || 'all';
        this.libraryPage = 1;
        const chips = document.querySelectorAll('#libraryTopicChips .chip');
        chips.forEach(chip => {
            if (chip.getAttribute('data-topic') === topic) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
        this.renderLibraryVocabList();
    }

    setLibraryPage(page) {
        this.libraryPage = Math.max(1, page);
        this.renderLibraryVocabList();
    }

    debouncedLibrarySearch() {
        if (this._searchTimer) clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
            this.libraryPage = 1;
            this.renderLibraryVocabList();
        }, 150);
    }

    renderLibraryTopicChips() {
        const container = document.getElementById('libraryTopicChips');
        if (!container) return;

        const db = window.KORSCAN_BOOK_VOCAB_DB || [];
        const topicMap = new Map();
        topicMap.set('all', 'Tất Cả Chủ Đề');

        db.forEach(w => {
            if (w.topic && !topicMap.has(w.topic)) {
                const label = window.sheetExporter ? window.sheetExporter.getTopicLabel(w.topic) : w.topic;
                topicMap.set(w.topic, label);
            }
        });

        let html = '';
        topicMap.forEach((label, topicKey) => {
            const activeClass = (this.libraryTopicFilter === topicKey) ? 'active' : '';
            html += `<button class="chip ${activeClass}" data-topic="${topicKey}" onclick="if(window.app) window.app.setLibraryTopicFilter('${topicKey}');">${label}</button>`;
        });
        container.innerHTML = html;
    }

    setLibraryDisplayMode(mode) {
        this.libraryDisplayMode = mode || 'table';
        const btnTable = document.getElementById('btnLibViewTable');
        const btnGrid = document.getElementById('btnLibViewGrid');

        if (mode === 'grid') {
            if (btnTable) { btnTable.style.background = 'transparent'; btnTable.style.color = 'var(--text-dim)'; }
            if (btnGrid) { btnGrid.style.background = 'var(--primary-blue)'; btnGrid.style.color = '#ffffff'; }
        } else {
            if (btnTable) { btnTable.style.background = 'var(--primary-blue)'; btnTable.style.color = '#ffffff'; }
            if (btnGrid) { btnGrid.style.background = 'transparent'; btnGrid.style.color = 'var(--text-dim)'; }
        }

        this.renderLibraryVocabList();
    }

    renderLibraryVocabList() {
        const container = document.getElementById('libraryVocabContainer') || document.getElementById('libraryCardsGrid');
        const badge = document.getElementById('libraryWordCountBadge');
        if (!container) return;

        const db = window.KORSCAN_BOOK_VOCAB_DB || [];
        const searchInput = document.getElementById('librarySearchInput');
        const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const existingSet = new Set((this.vocabularyList || []).map(w => w.korean ? w.korean.trim() : ''));

        const filtered = db.filter(item => {
            // Filter by level (supports TOPIK 1-2, TOPIK 3-4, TOPIK 5-6 and individual levels)
            if (this.libraryLevelFilter && this.libraryLevelFilter !== 'all') {
                const filter = this.libraryLevelFilter;
                const lvl = (item.level || '').toUpperCase();
                if (filter === 'TOPIK 1-2') {
                    if (!lvl.includes('1') && !lvl.includes('2')) return false;
                } else if (filter === 'TOPIK 3-4') {
                    if (!lvl.includes('3') && !lvl.includes('4')) return false;
                } else if (filter === 'TOPIK 5-6') {
                    if (!lvl.includes('5') && !lvl.includes('6')) return false;
                } else if (lvl !== filter) {
                    return false;
                }
            }
            // Filter by topic
            if (this.libraryTopicFilter && this.libraryTopicFilter !== 'all' && item.topic !== this.libraryTopicFilter) {
                return false;
            }
            // Filter by search query
            if (search) {
                const k = (item.korean || '').toLowerCase();
                const r = (item.romaja || '').toLowerCase();
                const v = (item.vietnamese || '').toLowerCase();
                if (!k.includes(search) && !r.includes(search) && !v.includes(search)) {
                    return false;
                }
            }
            return true;
        });

        if (badge) badge.innerText = `${filtered.length} từ mẫu`;

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-dim); font-size: 14px;">
                🔍 Không tìm thấy từ vựng nào phù hợp với bộ lọc.
            </div>`;
            return;
        }

        // ─── Pagination Calculations ───
        const pageSize = this.libraryPageSize || 40;
        const totalPages = Math.ceil(filtered.length / pageSize) || 1;
        if (!this.libraryPage || this.libraryPage < 1) this.libraryPage = 1;
        if (this.libraryPage > totalPages) this.libraryPage = totalPages;

        const startIndex = (this.libraryPage - 1) * pageSize;
        const pagedItems = filtered.slice(startIndex, startIndex + pageSize);

        const renderPaginationBar = () => `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); border-radius: 10px; margin: 12px 0; font-size: 13px; color: var(--text-dim);">
            <div>Hiển thị <b>${startIndex + 1} - ${Math.min(startIndex + pageSize, filtered.length)}</b> trong tổng số <b>${filtered.length}</b> từ</div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button class="btn btn-soft" style="padding: 4px 10px; font-size: 12px;" onclick="if(window.app) window.app.setLibraryPage(1);" ${this.libraryPage === 1 ? 'disabled' : ''}>⏮️ Đầu</button>
                <button class="btn btn-soft" style="padding: 4px 10px; font-size: 12px;" onclick="if(window.app) window.app.setLibraryPage(${this.libraryPage - 1});" ${this.libraryPage === 1 ? 'disabled' : ''}>◀️ Trước</button>
                <span style="font-weight: 700; color: var(--primary-light); margin: 0 8px;">Trang ${this.libraryPage} / ${totalPages}</span>
                <button class="btn btn-soft" style="padding: 4px 10px; font-size: 12px;" onclick="if(window.app) window.app.setLibraryPage(${this.libraryPage + 1});" ${this.libraryPage >= totalPages ? 'disabled' : ''}>▶️ Sau</button>
                <button class="btn btn-soft" style="padding: 4px 10px; font-size: 12px;" onclick="if(window.app) window.app.setLibraryPage(${totalPages});" ${this.libraryPage >= totalPages ? 'disabled' : ''}>⏭️ Cuối</button>
            </div>
        </div>`;

        const mode = this.libraryDisplayMode || 'table';

        if (mode === 'table') {
            // ─── Render Compact Data Table View ───
            let tableRows = '';
            pagedItems.forEach((item, index) => {
                const globalIndex = startIndex + index + 1;
                const isAdded = existingSet.has(item.korean.trim());
                const posClass = item.pos === 'Động từ' ? 'pos-verb' : item.pos === 'Tính từ' ? 'pos-adj' : item.pos === 'Phó từ' ? 'pos-adv' : 'pos-noun';
                const topicLabel = window.sheetExporter ? window.sheetExporter.getTopicLabel(item.topic) : item.topic;
                const levelColor = item.level === 'TOPIK 1' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(217, 119, 6, 0.15)';
                const levelTextColor = item.level === 'TOPIK 1' ? 'var(--primary-blue)' : 'var(--accent-gold)';

                tableRows += `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: var(--text-dim); font-size: 12px;">${globalIndex}</td>
                    <td>
                        <div style="font-size: 16px; font-weight: 700; color: var(--text-main); font-family: 'Outfit', sans-serif;">${item.korean}</div>
                    </td>
                    <td>
                        <span style="font-size: 12.5px; color: var(--accent-teal); font-weight: 500;">[${item.romaja}]</span>
                    </td>
                    <td>
                        <b style="font-size: 13.5px; color: var(--primary-light);">🇻🇳 ${item.vietnamese}</b>
                    </td>
                    <td>
                        <span class="pos-badge ${posClass}" style="font-size: 10.5px;">${item.pos || 'Từ vựng'}</span>
                        <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; background: ${levelColor}; color: ${levelTextColor}; margin-left: 4px;">${item.level || 'TOPIK'}</span>
                    </td>
                    <td>
                        <span style="font-size: 12px; color: var(--text-dim); font-weight: 500;">🏷️ ${topicLabel}</span>
                    </td>
                    <td style="max-width: 250px;">
                        <span style="font-size: 12px; color: var(--text-dim);">${item.example || '-'}</span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center;">
                            <button class="btn btn-soft" style="padding: 4px 8px; font-size: 11.5px;" onclick="if(window.app) window.app.speakKorean('${item.korean.replace(/'/g, "\\'")}');" title="Nghe phát âm AI">🔊 Nghe</button>
                            <button class="btn btn-soft" style="padding: 4px 8px; font-size: 11.5px;" onclick="if(window.app) window.app.testPronunciation('${item.korean.replace(/'/g, "\\'")}', this);" title="Chấm điểm phát âm">🎤 Nói</button>
                            <button class="lib-add-btn ${isAdded ? 'added' : ''}" style="padding: 4px 10px; font-size: 11.5px;" onclick="if(window.app) window.app.addLibraryWordToPersonalNotebook('${item.korean.replace(/'/g, "\\'")}');" ${isAdded ? 'disabled' : ''}>
                                ${isAdded ? '✅ Đã thêm' : '➕ Thêm vào Sổ'}
                            </button>
                        </div>
                    </td>
                </tr>`;
            });

            container.innerHTML = `
            ${renderPaginationBar()}
            <table class="lib-vocab-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th style="width: 140px;">Từ Tiếng Hàn</th>
                        <th style="width: 130px;">Phiên Âm</th>
                        <th>Nghĩa Tiếng Việt</th>
                        <th style="width: 130px;">Loại & Trình Độ</th>
                        <th style="width: 110px;">Chủ Đề</th>
                        <th>Ví Dụ Mẫu</th>
                        <th style="width: 210px; text-align: right;">Thao Tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            ${renderPaginationBar()}`;

        } else {
            // ─── Render Compact Cards Grid View ───
            let cardsHtml = '';
            pagedItems.forEach(item => {
                const isAdded = existingSet.has(item.korean.trim());
                const posClass = item.pos === 'Động từ' ? 'pos-verb' : item.pos === 'Tính từ' ? 'pos-adj' : item.pos === 'Phó từ' ? 'pos-adv' : 'pos-noun';
                const topicLabel = window.sheetExporter ? window.sheetExporter.getTopicLabel(item.topic) : item.topic;
                const levelColor = item.level === 'TOPIK 1' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(217, 119, 6, 0.15)';
                const levelTextColor = item.level === 'TOPIK 1' ? 'var(--primary-blue)' : 'var(--accent-gold)';

                cardsHtml += `
                <div class="lib-vocab-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div>
                            <span class="pos-badge ${posClass}" style="font-size: 11px;">${item.pos || 'Từ vựng'}</span>
                            <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: ${levelColor}; color: ${levelTextColor}; margin-left: 6px;">${item.level || 'TOPIK'}</span>
                        </div>
                        <button class="lib-add-btn ${isAdded ? 'added' : ''}" onclick="if(window.app) window.app.addLibraryWordToPersonalNotebook('${item.korean.replace(/'/g, "\\'")}');" ${isAdded ? 'disabled' : ''}>
                            ${isAdded ? '✅ Đã trong Sổ Từ' : '➕ Thêm vào Sổ Từ'}
                        </button>
                    </div>

                    <div style="margin-top: 4px;">
                        <div style="font-size: 22px; font-weight: 700; color: var(--text-main); font-family: 'Outfit', sans-serif;">${item.korean}</div>
                        <div style="font-size: 12.5px; color: var(--accent-teal); font-weight: 500; margin-top: 2px;">[${item.romaja}]</div>
                        <div style="font-size: 14px; font-weight: 700; color: var(--primary-light); margin-top: 4px;">🇻🇳 ${item.vietnamese}</div>
                    </div>

                    ${item.example ? `
                    <div style="font-size: 11.5px; color: var(--text-dim); background: rgba(15, 23, 42, 0.3); border-radius: 8px; padding: 6px 8px; margin-top: 2px; border-left: 3px solid var(--primary-soft);">
                        💡 ${item.example}
                    </div>` : ''}

                    <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                        <span style="font-size: 11px; color: var(--text-dim); font-weight: 600;">🏷️ ${topicLabel}</span>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-soft" style="padding: 3px 8px; font-size: 11.5px;" onclick="if(window.app) window.app.speakKorean('${item.korean.replace(/'/g, "\\'")}');" title="Nghe phát âm AI">🔊 Nghe</button>
                            <button class="btn btn-soft" style="padding: 3px 8px; font-size: 11.5px;" onclick="if(window.app) window.app.testPronunciation('${item.korean.replace(/'/g, "\\'")}', this);" title="Chấm điểm phát âm">🎤 Nói</button>
                        </div>
                    </div>
                </div>`;
            });

            container.innerHTML = `
            ${renderPaginationBar()}
            <div class="vocab-grid" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));">${cardsHtml}</div>
            ${renderPaginationBar()}`;
        }
    }

    addLibraryWordToPersonalNotebook(koreanWord) {
        const db = window.KORSCAN_BOOK_VOCAB_DB || [];
        const item = db.find(w => w.korean === koreanWord);
        if (!item) return;

        const existing = this.vocabularyList.find(w => w.korean && w.korean.trim() === koreanWord.trim());
        if (existing) {
            window.showCustomAlert(`Từ [${koreanWord}] đã có sẵn trong Sổ Từ Scan Của Tôi rồi!`);
            return;
        }

        const newWord = {
            id: 'lib_' + Math.random().toString(36).substr(2, 9),
            korean: item.korean,
            romaja: item.romaja,
            vietnamese: item.vietnamese,
            pos: item.pos || 'Danh từ',
            topic: item.topic || 'daily',
            example: item.example || `${item.korean} - ${item.vietnamese}`,
            starred: false,
            date: new Date().toLocaleDateString('vi-VN')
        };

        this.vocabularyList.unshift(newWord);
        this.saveVocabToStorage();
        this.autoClassifySpecialCategories();
        this.renderCategoryChips();
        this.renderVocabularyGrid();
        this.updateStreakData();
        this.renderLibraryVocabList();

        if (window.showCustomAlert) {
            window.showCustomAlert(`🎉 Đã thêm từ [${item.korean} - ${item.vietnamese}] vào Sổ Từ Scan Của Tôi!`);
        }
    }
}

window.showCustomConfirm = function(title, message, onConfirmCallback) {
    const modal = document.getElementById("customConfirmModal");
    const avatar = document.getElementById("customConfirmAvatar");
    const titleEl = document.getElementById("customConfirmTitle");
    const msgEl = document.getElementById("customConfirmMessage");
    const btnCancel = document.getElementById("btnCancelCustomConfirm");
    const btnOk = document.getElementById("btnOkCustomConfirm");

    if (!modal) {
        if (confirm(message)) onConfirmCallback();
        return;
    }

    if (avatar) avatar.src = window.DEFAULT_CAT_AVATAR_BASE64 || "cat_avatar.png";
    if (titleEl) titleEl.innerText = title || "XÁC NHẬN THAO TÁC";
    if (msgEl) msgEl.innerText = message || "";

    modal.style.display = "flex";

    const cleanup = () => {
        modal.style.display = "none";
        if (btnCancel) btnCancel.onclick = null;
        if (btnOk) btnOk.onclick = null;
    };

    if (btnCancel) {
        btnCancel.onclick = () => {
            cleanup();
        };
    }

    if (btnOk) {
        btnOk.onclick = () => {
            cleanup();
            if (typeof onConfirmCallback === 'function') onConfirmCallback();
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.app = new KorScanApp();
});
