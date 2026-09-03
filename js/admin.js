/**
 * Admin Panel Controller
 * Handles Quiz Management, Question CRUD, Student Submissions Tracking,
 * and System Data Export/Import.
 */
class AdminController {
  constructor(storage, auth) {
    this.storage = storage;
    this.auth = auth;
    this.currentSubView = "quizzes"; // 'quizzes' | 'submissions' | 'analytics' | 'backup'
    this.editingQuizId = null;
    this.editingQuestionIndex = null;
    this.parsedBulkQuestions = [];
    this.bulkCurrentTab = "file";
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Admin Sub-nav Tab switching
    document.querySelectorAll(".admin-nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const tab = e.currentTarget.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });

    // Create New Quiz Button
    const btnNewQuiz = document.getElementById("btn-admin-new-quiz");
    if (btnNewQuiz) {
      btnNewQuiz.addEventListener("click", () => this.openQuizModal());
    }

    // Save Quiz Form Submit
    const quizForm = document.getElementById("form-quiz-editor");
    if (quizForm) {
      quizForm.addEventListener("submit", (e) => this.handleSaveQuiz(e));
    }

    // Save & Add Questions Buttons in Create/Edit Quiz Modal
    const btnSaveAndAddQ = document.getElementById("btn-save-and-manage-questions");
    if (btnSaveAndAddQ) {
      btnSaveAndAddQ.addEventListener("click", (e) => this.handleSaveAndOpenQuestions(e));
    }

    const btnInlineAddQ = document.getElementById("btn-quiz-editor-add-questions-inline");
    if (btnInlineAddQ) {
      btnInlineAddQ.addEventListener("click", (e) => this.handleSaveAndOpenQuestions(e));
    }

    // Add New Question button inside Question Manager Modal
    const btnAddQuestion = document.getElementById("btn-add-new-question");
    if (btnAddQuestion) {
      btnAddQuestion.addEventListener("click", () => this.openQuestionEditorModal());
    }

    // Save Question Form Submit
    const questionForm = document.getElementById("form-question-editor");
    if (questionForm) {
      questionForm.addEventListener("submit", (e) => this.handleSaveQuestion(e, false));
    }

    // Save & Add Next Question Button
    const btnSaveNext = document.getElementById("btn-save-and-add-next");
    if (btnSaveNext) {
      btnSaveNext.addEventListener("click", (e) => this.handleSaveQuestion(e, true));
    }

    // Export Database Button
    const btnExport = document.getElementById("btn-export-database");
    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportDatabase());
    }

    // Import Database Input
    const fileImport = document.getElementById("file-import-database");
    if (fileImport) {
      fileImport.addEventListener("change", (e) => this.importDatabase(e));
    }

    // Reset Database to Factory Defaults
    const btnReset = document.getElementById("btn-reset-database");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.resetDatabase());
    }

    // Submissions Search Filter
    const searchSubmissions = document.getElementById("admin-submissions-search");
    if (searchSubmissions) {
      searchSubmissions.addEventListener("input", (e) => {
        this.renderSubmissions(e.target.value);
      });
    }

    // --- BULK IMPORT EVENT BINDINGS ---
    const btnBulkHeader = document.getElementById("btn-admin-bulk-import-header");
    if (btnBulkHeader) {
      btnBulkHeader.addEventListener("click", () => this.openBulkImportModal());
    }

    const btnBulkCatalog = document.getElementById("btn-admin-bulk-import-catalog");
    if (btnBulkCatalog) {
      btnBulkCatalog.addEventListener("click", () => this.openBulkImportModal());
    }

    const btnBulkTrigger = document.getElementById("btn-bulk-import-modal-trigger");
    if (btnBulkTrigger) {
      btnBulkTrigger.addEventListener("click", () => this.openBulkImportModal(this.editingQuizId));
    }

    const bulkFileInput = document.getElementById("bulk-file-input");
    if (bulkFileInput) {
      bulkFileInput.addEventListener("change", (e) => this.handleBulkFileInput(e));
    }

    const dropzone = document.getElementById("bulk-file-dropzone");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleBulkFile(e.dataTransfer.files[0]);
        }
      });
    }

    const btnParseText = document.getElementById("btn-bulk-parse-text");
    if (btnParseText) {
      btnParseText.addEventListener("click", () => this.handleBulkTextParse());
    }

    const btnLoadSampleText = document.getElementById("btn-bulk-load-sample-text");
    if (btnLoadSampleText) {
      btnLoadSampleText.addEventListener("click", () => this.loadSampleQuestionsText());
    }

    const btnDownloadCsv = document.getElementById("btn-download-csv-template");
    if (btnDownloadCsv) {
      btnDownloadCsv.addEventListener("click", () => this.downloadCsvTemplate());
    }

    const btnDownloadJson = document.getElementById("btn-download-json-template");
    if (btnDownloadJson) {
      btnDownloadJson.addEventListener("click", () => this.downloadJsonTemplate());
    }

    const btnCopyPrompt = document.getElementById("btn-copy-ai-prompt");
    if (btnCopyPrompt) {
      btnCopyPrompt.addEventListener("click", () => this.copyAiPrompt());
    }

    const btnClearPreview = document.getElementById("btn-bulk-clear-preview");
    if (btnClearPreview) {
      btnClearPreview.addEventListener("click", () => this.clearBulkImport());
    }

    const btnClearAll = document.getElementById("btn-bulk-clear-all");
    if (btnClearAll) {
      btnClearAll.addEventListener("click", () => this.clearBulkImport());
    }

    const btnConfirmImport = document.getElementById("btn-bulk-confirm-import");
    if (btnConfirmImport) {
      btnConfirmImport.addEventListener("click", () => this.commitBulkImport());
    }

    // --- CSV & PERFORMANCE REPORT EVENT BINDINGS ---
    const btnExportSubCsv = document.getElementById("btn-admin-export-submissions-csv");
    if (btnExportSubCsv) {
      btnExportSubCsv.addEventListener("click", () => this.exportSubmissionsCSV());
    }

    const btnReportExportCsv = document.getElementById("btn-report-export-csv-btn");
    if (btnReportExportCsv) {
      btnReportExportCsv.addEventListener("click", () => this.exportSubmissionsCSV());
    }

    const btnPrintReport = document.getElementById("btn-admin-print-report");
    if (btnPrintReport) {
      btnPrintReport.addEventListener("click", () => this.openPerformanceReportModal());
    }

    const btnAnalyticsReport = document.getElementById("btn-admin-analytics-print-report");
    if (btnAnalyticsReport) {
      btnAnalyticsReport.addEventListener("click", () => this.openPerformanceReportModal());
    }

    const btnReportPrint = document.getElementById("btn-report-print-btn");
    if (btnReportPrint) {
      btnReportPrint.addEventListener("click", () => window.print());
    }

    const btnReportBottomPrint = document.getElementById("btn-report-bottom-print");
    if (btnReportBottomPrint) {
      btnReportBottomPrint.addEventListener("click", () => window.print());
    }
  }

  switchTab(tabName) {
    this.currentSubView = tabName;
    document.querySelectorAll(".admin-nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-tab") === tabName);
    });

    document.querySelectorAll(".admin-tab-section").forEach(sec => {
      sec.style.display = sec.id === `admin-sec-${tabName}` ? "block" : "none";
    });

    if (tabName === "quizzes") this.renderQuizzesTable();
    if (tabName === "submissions") this.renderSubmissions();
    if (tabName === "analytics") this.renderAnalytics();
  }

  renderAdminView() {
    this.renderMetricsSummary();
    this.switchTab(this.currentSubView || "quizzes");
  }

  renderMetricsSummary() {
    const stats = this.storage.getAdminStats();
    const elTotalStudents = document.getElementById("admin-metric-students");
    const elTotalQuizzes = document.getElementById("admin-metric-quizzes");
    const elTotalAttempts = document.getElementById("admin-metric-attempts");
    const elAvgAccuracy = document.getElementById("admin-metric-accuracy");

    if (elTotalStudents) elTotalStudents.textContent = stats.totalStudents;
    if (elTotalQuizzes) elTotalQuizzes.textContent = stats.totalQuizzes;
    if (elTotalAttempts) elTotalAttempts.textContent = stats.totalAttempts;
    if (elAvgAccuracy) elAvgAccuracy.textContent = `${stats.averageAccuracy}%`;
  }

  // --- QUIZZES MANAGEMENT ---
  renderQuizzesTable() {
    const quizzes = this.storage.getQuizzes();
    const tbody = document.getElementById("admin-quizzes-tbody");
    if (!tbody) return;

    if (quizzes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No quizzes created yet. Click "Create Quiz" above!</td></tr>`;
      return;
    }

    tbody.innerHTML = quizzes.map(q => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.3rem;">${q.icon || '📝'}</span>
            <div>
              <strong>${this.escapeHtml(q.title)}</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${this.escapeHtml(q.category)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-${(q.difficulty || 'medium').toLowerCase()}">${q.difficulty || 'Medium'}</span></td>
        <td>${q.questions ? q.questions.length : 0} Qs</td>
        <td>${q.durationMinutes} mins</td>
        <td>${q.passPercentage}%</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.adminController.openQuestionManagerModal('${q.id}')" title="Manage Questions">
              ❓ Questions (${q.questions ? q.questions.length : 0})
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.adminController.openQuizModal('${q.id}')" title="Edit Settings">
              ✏️ Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.adminController.confirmDeleteQuiz('${q.id}')" title="Delete Quiz">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  openQuizModal(quizId = null) {
    this.editingQuizId = quizId;
    const modal = document.getElementById("modal-quiz-editor");
    const form = document.getElementById("form-quiz-editor");
    const titleEl = document.getElementById("modal-quiz-editor-title");

    form.reset();

    const qCountText = document.getElementById("quiz-editor-qcount-text");

    if (quizId) {
      const quiz = this.storage.getQuizById(quizId);
      if (quiz) {
        titleEl.textContent = "Edit Quiz Details";
        document.getElementById("quiz-field-id").value = quiz.id;
        document.getElementById("quiz-field-title").value = quiz.title;
        document.getElementById("quiz-field-category").value = quiz.category;
        document.getElementById("quiz-field-code").value = quiz.testCode || ("TEST-" + Math.floor(100 + Math.random() * 900));
        document.getElementById("quiz-field-password").value = quiz.password || "";
        document.getElementById("quiz-field-icon").value = quiz.icon || "📝";
        document.getElementById("quiz-field-difficulty").value = quiz.difficulty || "Medium";
        document.getElementById("quiz-field-duration").value = quiz.durationMinutes || 15;
        document.getElementById("quiz-field-pass").value = quiz.passPercentage || 60;
        document.getElementById("quiz-field-desc").value = quiz.description || "";

        const count = quiz.questions ? quiz.questions.length : 0;
        if (qCountText) {
          qCountText.textContent = `${count} question${count === 1 ? '' : 's'} configured in this test. Click to add/edit.`;
        }
      }
    } else {
      titleEl.textContent = "Create New Quiz";
      document.getElementById("quiz-field-id").value = "";
      document.getElementById("quiz-field-code").value = "TEST-" + Math.floor(100 + Math.random() * 900);
      document.getElementById("quiz-field-password").value = "";
      document.getElementById("quiz-field-icon").value = "🎯";
      document.getElementById("quiz-field-duration").value = 15;
      document.getElementById("quiz-field-pass").value = 60;

      if (qCountText) {
        qCountText.textContent = "0 questions added yet. Click 'Save & Add Questions' below to add questions!";
      }
    }

    modal.classList.add("open");
  }

  handleSaveQuiz(e) {
    e.preventDefault();
    const id = document.getElementById("quiz-field-id").value;
    const title = document.getElementById("quiz-field-title").value.trim();
    const category = document.getElementById("quiz-field-category").value;
    const testCode = (document.getElementById("quiz-field-code")?.value.trim() || ("TEST-" + Math.floor(100 + Math.random() * 900))).toUpperCase();
    const password = document.getElementById("quiz-field-password")?.value.trim() || "";
    const icon = document.getElementById("quiz-field-icon").value.trim() || "📝";
    const difficulty = document.getElementById("quiz-field-difficulty").value;
    const durationMinutes = parseInt(document.getElementById("quiz-field-duration").value) || 15;
    const passPercentage = parseInt(document.getElementById("quiz-field-pass").value) || 60;
    const description = document.getElementById("quiz-field-desc").value.trim();

    if (!title) {
      window.app.showToast("Please enter a quiz title", "error");
      return;
    }

    let existingQuestions = [];
    let totalMarks = 20;

    if (id) {
      const existing = this.storage.getQuizById(id);
      if (existing) {
        existingQuestions = existing.questions || [];
        totalMarks = existing.totalMarks || (existingQuestions.length * 2);
      }
    }

    const quizData = {
      id: id || undefined,
      title,
      category,
      testCode,
      password,
      icon,
      difficulty,
      durationMinutes,
      passPercentage,
      totalMarks: totalMarks || (existingQuestions.length * 2) || 20,
      description,
      questions: existingQuestions
    };

    this.storage.saveQuiz(quizData);
    document.getElementById("modal-quiz-editor").classList.remove("open");
    window.app.showToast(`Quiz "${title}" (Code: ${testCode}) saved!`, "success");
    if (window.app) window.app.renderQuizzesGrid();
    this.renderQuizzesTable();
    this.renderMetricsSummary();
  }

  handleSaveAndOpenQuestions(e) {
    if (e) e.preventDefault();
    const title = document.getElementById("quiz-field-title").value.trim();
    if (!title) {
      window.app.showToast("Please enter a Quiz Title first!", "error");
      document.getElementById("quiz-field-title").focus();
      return;
    }

    const id = document.getElementById("quiz-field-id").value;
    const category = document.getElementById("quiz-field-category").value;
    const testCode = (document.getElementById("quiz-field-code")?.value.trim() || ("TEST-" + Math.floor(100 + Math.random() * 900))).toUpperCase();
    const password = document.getElementById("quiz-field-password")?.value.trim() || "";
    const icon = document.getElementById("quiz-field-icon").value.trim() || "📝";
    const difficulty = document.getElementById("quiz-field-difficulty").value;
    const durationMinutes = parseInt(document.getElementById("quiz-field-duration").value) || 15;
    const passPercentage = parseInt(document.getElementById("quiz-field-pass").value) || 60;
    const description = document.getElementById("quiz-field-desc").value.trim();

    let existingQuestions = [];
    let totalMarks = 20;

    if (id) {
      const existing = this.storage.getQuizById(id);
      if (existing) {
        existingQuestions = existing.questions || [];
        totalMarks = existing.totalMarks || (existingQuestions.length * 2);
      }
    }

    const quizData = {
      id: id || undefined,
      title,
      category,
      testCode,
      password,
      icon,
      difficulty,
      durationMinutes,
      passPercentage,
      totalMarks: totalMarks || (existingQuestions.length * 2) || 20,
      description,
      questions: existingQuestions
    };

    const savedQuiz = this.storage.saveQuiz(quizData);
    document.getElementById("modal-quiz-editor").classList.remove("open");
    window.app.showToast(`Quiz details saved! Now adding questions 📝`, "success");
    if (window.app) window.app.renderQuizzesGrid();
    this.renderQuizzesTable();
    this.renderMetricsSummary();

    // Open Question Manager for this quiz
    this.openQuestionManagerModal(savedQuiz.id);

    // If quiz has no questions yet, immediately open Question Editor Modal for Question 1
    if (existingQuestions.length === 0) {
      setTimeout(() => this.openQuestionEditorModal(), 200);
    }
  }

  confirmDeleteQuiz(quizId) {
    const quiz = this.storage.getQuizById(quizId);
    if (!quiz) return;

    if (confirm(`Are you sure you want to delete the quiz "${quiz.title}"? This action cannot be undone.`)) {
      this.storage.deleteQuiz(quizId);
      if (window.app) {
        window.app.showToast(`Quiz "${quiz.title}" deleted successfully.`, "info");
        window.app.renderDashboard();
      }
      this.renderQuizzesTable();
      this.renderMetricsSummary();
    }
  }

  deleteQuiz(quizId) {
    this.confirmDeleteQuiz(quizId);
  }

  openQuestionManager(quizId) {
    this.openQuestionManagerModal(quizId);
  }

  // --- QUESTION MANAGER MODAL ---
  openQuestionManagerModal(quizId) {
    this.editingQuizId = quizId;
    const quiz = this.storage.getQuizById(quizId);
    if (!quiz) return;

    document.getElementById("modal-question-manager-quiz-title").textContent = quiz.title;
    this.renderQuestionsList(quiz);
    document.getElementById("modal-question-manager").classList.add("open");
  }

  renderQuestionsList(quiz) {
    const container = document.getElementById("question-manager-list");
    if (!container) return;

    const questions = quiz.questions || [];

    if (questions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">❓</div>
          <p>No questions added to this quiz yet.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" onclick="window.adminController.openQuestionEditorModal()">+ Add First Question</button>
        </div>
      `;
      return;
    }

    container.innerHTML = questions.map((q, idx) => `
      <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">
          <div>
            <strong style="color: var(--primary);">Q${idx + 1}:</strong>
            <span style="font-weight: 600; color: var(--text-primary); margin-left: 0.25rem;">${this.escapeHtml(q.question)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">(${q.marks || 2} marks)</span>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.adminController.openQuestionEditorModal(${idx})" title="Edit Question">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="window.adminController.deleteQuestion(${idx})" title="Delete Question">🗑️</button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.82rem; margin-top: 0.5rem;">
          ${q.options.map((opt, oIdx) => `
            <div style="padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); background: ${oIdx === q.correctAnswer ? 'var(--success-bg)' : 'var(--bg-glass)'}; border: 1px solid ${oIdx === q.correctAnswer ? 'var(--success-border)' : 'transparent'}; color: ${oIdx === q.correctAnswer ? '#34d399' : 'var(--text-secondary)'};">
              <strong>${String.fromCharCode(65 + oIdx)}:</strong> ${this.escapeHtml(opt)} ${oIdx === q.correctAnswer ? '✓ (Correct)' : ''}
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  openQuestionEditorModal(questionIndex = null) {
    this.editingQuestionIndex = questionIndex;
    const form = document.getElementById("form-question-editor");
    form.reset();

    const quiz = this.storage.getQuizById(this.editingQuizId);
    if (!quiz) return;

    const modalTitle = document.getElementById("modal-question-editor-title");

    if (questionIndex !== null && quiz.questions && quiz.questions[questionIndex]) {
      const q = quiz.questions[questionIndex];
      modalTitle.textContent = `Edit Question #${questionIndex + 1}`;
      document.getElementById("q-field-text").value = q.question;
      document.getElementById("q-field-marks").value = q.marks || 2;
      document.getElementById("q-field-opt-0").value = q.options[0] || "";
      document.getElementById("q-field-opt-1").value = q.options[1] || "";
      document.getElementById("q-field-opt-2").value = q.options[2] || "";
      document.getElementById("q-field-opt-3").value = q.options[3] || "";
      document.getElementById("q-field-correct").value = q.correctAnswer !== undefined ? q.correctAnswer : 0;
      document.getElementById("q-field-explanation").value = q.explanation || "";
    } else {
      modalTitle.textContent = "Add New Question";
      document.getElementById("q-field-marks").value = 2;
      document.getElementById("q-field-correct").value = 0;
    }

    document.getElementById("modal-question-editor").classList.add("open");
  }

  handleSaveQuestion(e, addNext = false) {
    if (e && e.preventDefault) e.preventDefault();
    const quiz = this.storage.getQuizById(this.editingQuizId);
    if (!quiz) return;

    const questionText = document.getElementById("q-field-text").value.trim();
    const marks = parseInt(document.getElementById("q-field-marks").value) || 2;
    const opt0 = document.getElementById("q-field-opt-0").value.trim();
    const opt1 = document.getElementById("q-field-opt-1").value.trim();
    const opt2 = document.getElementById("q-field-opt-2").value.trim();
    const opt3 = document.getElementById("q-field-opt-3").value.trim();
    const correctAnswer = parseInt(document.getElementById("q-field-correct").value);
    const explanation = document.getElementById("q-field-explanation").value.trim();

    if (!questionText) {
      window.app.showToast("Please enter the question text.", "error");
      document.getElementById("q-field-text").focus();
      return;
    }

    if (!opt0 || !opt1 || !opt2 || !opt3) {
      window.app.showToast("Please provide all 4 answer options (A, B, C, D).", "error");
      return;
    }

    if (!quiz.questions) quiz.questions = [];

    const questionObj = {
      id: "q_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 3),
      question: questionText,
      options: [opt0, opt1, opt2, opt3],
      correctAnswer,
      marks,
      explanation
    };

    let questionNumberSaved;
    if (this.editingQuestionIndex !== null) {
      quiz.questions[this.editingQuestionIndex] = questionObj;
      questionNumberSaved = this.editingQuestionIndex + 1;
    } else {
      quiz.questions.push(questionObj);
      questionNumberSaved = quiz.questions.length;
    }

    // Recalculate total quiz marks
    quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);
    this.storage.saveQuiz(quiz);

    this.renderQuestionsList(quiz);
    this.renderQuizzesTable();
    this.renderMetricsSummary();

    if (addNext) {
      // Clear fields for the next question
      document.getElementById("q-field-text").value = "";
      document.getElementById("q-field-opt-0").value = "";
      document.getElementById("q-field-opt-1").value = "";
      document.getElementById("q-field-opt-2").value = "";
      document.getElementById("q-field-opt-3").value = "";
      document.getElementById("q-field-explanation").value = "";
      document.getElementById("q-field-correct").value = 0;

      // Update state for new question
      this.editingQuestionIndex = null;
      const nextNumber = quiz.questions.length + 1;
      document.getElementById("modal-question-editor-title").textContent = `Add Question #${nextNumber}`;

      window.app.showToast(`Question #${questionNumberSaved} saved! Ready for Question #${nextNumber} 🚀`, "success");
      document.getElementById("q-field-text").focus();
    } else {
      document.getElementById("modal-question-editor").classList.remove("open");
      window.app.showToast(`Question #${questionNumberSaved} saved successfully!`, "success");
    }
  }

  deleteQuestion(index) {
    const quiz = this.storage.getQuizById(this.editingQuizId);
    if (!quiz || !quiz.questions) return;

    if (confirm(`Are you sure you want to delete Question #${index + 1}?`)) {
      quiz.questions.splice(index, 1);
      quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);
      this.storage.saveQuiz(quiz);
      this.renderQuestionsList(quiz);
      this.renderQuizzesTable();
      if (window.app) window.app.renderDashboard();
      window.app.showToast("Question removed.", "info");
    }
  }

  // --- SUBMISSIONS INSPECTOR ---
  renderSubmissions(searchQuery = "") {
    const attempts = this.storage.getAttempts();
    const tbody = document.getElementById("admin-submissions-tbody");
    if (!tbody) return;

    let filtered = attempts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = attempts.filter(a =>
        (a.userName && a.userName.toLowerCase().includes(q)) ||
        (a.quizTitle && a.quizTitle.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No student attempts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td>
          <div class="table-user-cell">
            <span class="table-user-avatar">${a.userAvatar || '🎓'}</span>
            <strong>${this.escapeHtml(a.userName || 'Student')}</strong>
          </div>
        </td>
        <td>${this.escapeHtml(a.quizTitle || 'Quiz')}</td>
        <td><span class="badge badge-primary">${this.escapeHtml(a.category || 'General')}</span></td>
        <td><strong>${a.score}/${a.totalMarks}</strong> (${a.percentage}%)</td>
        <td>
          <span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}">
            ${a.passed ? 'Passed ✓' : 'Failed ✗'}
          </span>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">
          ${new Date(a.completedAt).toLocaleDateString()} ${new Date(a.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.app.viewAttemptDetails('${a.id}')">
            🔍 Details
          </button>
        </td>
      </tr>
    `).join("");
  }

  // --- ANALYTICS TAB ---
  renderAnalytics() {
    const stats = this.storage.getAdminStats();
    const attempts = this.storage.getAttempts();
    const container = document.getElementById("admin-analytics-charts-box");
    if (!container) return;

    // Calculate category breakdown
    const catStats = {};
    attempts.forEach(a => {
      if (!catStats[a.category]) {
        catStats[a.category] = { totalAttempts: 0, passed: 0, totalScore: 0, totalMax: 0 };
      }
      catStats[a.category].totalAttempts++;
      if (a.passed) catStats[a.category].passed++;
      catStats[a.category].totalScore += a.score;
      catStats[a.category].totalMax += a.totalMarks;
    });

    let catHTML = Object.entries(catStats).map(([cat, val]) => {
      const passPct = Math.round((val.passed / val.totalAttempts) * 100);
      const avgScore = Math.round((val.totalScore / val.totalMax) * 100);
      return `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
          <h4 style="margin-bottom: 0.5rem;">${cat}</h4>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.4rem;">
            <span>Attempts: <strong>${val.totalAttempts}</strong></span>
            <span>Avg Accuracy: <strong>${avgScore}%</strong></span>
          </div>
          <div style="width: 100%; height: 8px; background: var(--border-subtle); border-radius: var(--radius-full); overflow: hidden;">
            <div style="width: ${passPct}%; height: 100%; background: var(--primary);"></div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; text-align: right;">${passPct}% Pass Rate</div>
        </div>
      `;
    }).join("");

    if (!catHTML) {
      catHTML = `<p style="color: var(--text-muted);">No category analytics available yet.</p>`;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
        ${catHTML}
      </div>
    `;
  }

  // --- DATA BACKUP & RESTORE ---
  exportDatabase() {
    const jsonStr = this.storage.exportDataJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quizsphere_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.app.showToast("Database exported successfully!", "success");
  }

  importDatabase(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = this.storage.importDataJSON(event.target.result);
      if (res.success) {
        window.app.showToast("Database imported successfully! Refreshing view...", "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        window.app.showToast(`Import failed: ${res.error}`, "error");
      }
    };
    reader.readAsText(file);
  }

  resetDatabase() {
    if (confirm("Are you sure you want to reset all quizzes, attempts, and accounts to factory defaults? All newly created quizzes and attempts will be restored to initial sample state.")) {
      this.storage.resetToDefaults();
      window.app.showToast("Database reset to factory defaults.", "info");
      setTimeout(() => window.location.reload(), 800);
    }
  }

  // =========================================================================
  // --- BULK QUESTION IMPORTER ---
  // =========================================================================

  openBulkImportModal(quizId = null) {
    this.populateBulkTargetQuizzes(quizId);
    this.clearBulkImport();
    this.switchBulkTab(this.bulkCurrentTab || "file");
    document.getElementById("modal-bulk-import").classList.add("open");
  }

  populateBulkTargetQuizzes(selectedQuizId = null) {
    const select = document.getElementById("bulk-target-quiz-select");
    if (!select) return;

    const quizzes = this.storage.getQuizzes();
    let optionsHtml = quizzes.map(q => `
      <option value="${q.id}" ${q.id === selectedQuizId ? 'selected' : ''}>
        ${q.icon || '📝'} ${this.escapeHtml(q.title)} (${q.questions ? q.questions.length : 0} Qs) - [${q.testCode || q.id}]
      </option>
    `).join("");

    optionsHtml += `<option value="__new__">+ ➕ Create Brand New Quiz on Import</option>`;
    select.innerHTML = optionsHtml;

    if (selectedQuizId) {
      select.value = selectedQuizId;
    }
  }

  switchBulkTab(tabName) {
    this.bulkCurrentTab = tabName;
    const tabBtns = {
      file: document.getElementById("bulk-tab-btn-file"),
      text: document.getElementById("bulk-tab-btn-text"),
      templates: document.getElementById("bulk-tab-btn-templates")
    };

    const tabPanes = {
      file: document.getElementById("bulk-tab-pane-file"),
      text: document.getElementById("bulk-tab-pane-text"),
      templates: document.getElementById("bulk-tab-pane-templates")
    };

    Object.keys(tabBtns).forEach(key => {
      if (tabBtns[key]) tabBtns[key].classList.toggle("active", key === tabName);
      if (tabPanes[key]) tabPanes[key].style.display = key === tabName ? "block" : "none";
    });
  }

  handleBulkFileInput(e) {
    const file = e.target.files[0];
    if (file) {
      this.handleBulkFile(file);
    }
  }

  handleBulkFile(file) {
    if (!file) return;
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    reader.onload = (event) => {
      const content = event.target.result;
      if (fileName.endsWith(".json")) {
        this.parseJSON(content);
      } else {
        // Parse as CSV or formatted text
        this.parseCSV(content);
      }
    };

    reader.readAsText(file);
  }

  handleBulkTextParse() {
    const text = document.getElementById("bulk-text-input")?.value || "";
    if (!text.trim()) {
      window.app.showToast("Please paste questions into the text box first.", "warning");
      return;
    }

    this.parseFormattedText(text);
  }

  loadSampleQuestionsText() {
    const sample = `1. What is the default value of a boolean variable in Java?
A) true
B) false
C) null
D) 0
Answer: B
Explanation: The default value of a boolean in Java is false.

2. Which data structure follows the Last-In, First-Out (LIFO) principle?
A) Queue
B) Array
C) Stack
D) Linked List
Answer: C
Explanation: A Stack operates on LIFO order, where the last added element is removed first.

3. Which gas do plants primarily absorb from the atmosphere during photosynthesis?
A) Oxygen
B) Nitrogen
C) Carbon Dioxide
D) Hydrogen
Answer: C
Explanation: Plants absorb carbon dioxide and release oxygen during photosynthesis.

4. What is the value of 15% of 240?
A) 36
B) 24
C) 30
D) 40
Answer: A
Explanation: 15% of 240 = (15 / 100) * 240 = 36.

5. Choose the correct synonym for 'Diligent':
A) Lazy
B) Hardworking
C) Careless
D) Slow
Answer: B
Explanation: Diligent means showing care, conscientiousness, and hard work in one's duties.`;

    const textarea = document.getElementById("bulk-text-input");
    if (textarea) {
      textarea.value = sample;
      this.parseFormattedText(sample);
      window.app.showToast("Sample questions loaded & parsed! 🚀", "info");
    }
  }

  // --- CSV PARSER (RFC-4180 compliant) ---
  parseCSV(csvText) {
    if (!csvText || !csvText.trim()) {
      this.validateAndPreviewQuestions([], ["Empty CSV file."]);
      return;
    }

    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) {
      this.validateAndPreviewQuestions([], ["No valid rows found in CSV."]);
      return;
    }

    // Detect if first row is a Header row
    let startIndex = 0;
    const firstRowStr = rows[0].join(" ").toLowerCase();
    if (firstRowStr.includes("question") || firstRowStr.includes("option") || firstRowStr.includes("correct")) {
      startIndex = 1;
    }

    const defaultMarks = parseInt(document.getElementById("bulk-default-marks")?.value) || 2;
    const questions = [];
    const errors = [];

    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || !row[0]) continue;

      const questionText = row[0] || "";
      const optA = row[1] || "";
      const optB = row[2] || "";
      const optC = row[3] || "";
      const optD = row[4] || "";
      const rawCorrect = row[5] !== undefined ? row[5] : "0";
      const rawMarks = row[6] !== undefined ? parseInt(row[6]) : defaultMarks;
      const explanation = row[7] || "";

      let correctIdx = 0;
      const upperCorrect = String(rawCorrect).trim().toUpperCase();
      if (upperCorrect === "A" || upperCorrect === "0" || upperCorrect === "1") {
        correctIdx = (upperCorrect === "A" || upperCorrect === "0") ? 0 : (upperCorrect === "1" ? 0 : 0);
      }
      if (upperCorrect === "A") correctIdx = 0;
      else if (upperCorrect === "B") correctIdx = 1;
      else if (upperCorrect === "C") correctIdx = 2;
      else if (upperCorrect === "D") correctIdx = 3;
      else {
        const num = parseInt(upperCorrect, 10);
        if (!isNaN(num)) {
          correctIdx = (num >= 1 && num <= 4) ? num - 1 : num;
        }
      }

      const options = [optA, optB, optC, optD].filter(o => o !== undefined);

      questions.push({
        question: questionText,
        options,
        correctAnswer: correctIdx,
        marks: isNaN(rawMarks) ? defaultMarks : rawMarks,
        explanation
      });
    }

    this.validateAndPreviewQuestions(questions, errors);
  }

  // --- JSON PARSER ---
  parseJSON(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      let list = [];

      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && Array.isArray(parsed.questions)) {
        list = parsed.questions;
      } else if (parsed && typeof parsed === "object") {
        list = [parsed];
      }

      this.validateAndPreviewQuestions(list);
    } catch (err) {
      this.validateAndPreviewQuestions([], [`JSON Syntax Error: ${err.message}`]);
    }
  }

  // --- PLAIN TEXT / AI PROMPT PARSER ---
  parseFormattedText(rawText) {
    if (!rawText || !rawText.trim()) {
      this.validateAndPreviewQuestions([], ["Empty text provided."]);
      return;
    }

    const defaultMarks = parseInt(document.getElementById("bulk-default-marks")?.value) || 2;
    const lines = rawText.split(/\r?\n/);
    const questionBlocks = [];
    let currentBlock = [];

    const isQuestionStart = (line) => {
      return /^(?:Q(?:uestion)?\s*\d+[\:\.\)]|\d+[\.\)\:])\s+/i.test(line.trim());
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isQuestionStart(line) && currentBlock.length > 0) {
        questionBlocks.push(currentBlock);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) {
      questionBlocks.push(currentBlock);
    }

    const blocksToProcess = questionBlocks.length > 1 ? questionBlocks : rawText.split(/\n\s*\n+/).map(b => b.split(/\r?\n/));
    const questions = [];
    const errors = [];

    for (let b = 0; b < blocksToProcess.length; b++) {
      const blockLines = blocksToProcess[b].map(l => l.trim()).filter(l => l.length > 0);
      if (blockLines.length === 0) continue;

      let questionText = "";
      const options = [];
      let correctAnswer = 0;
      let explanation = "";

      for (let i = 0; i < blockLines.length; i++) {
        const line = blockLines[i];

        // Check for Answer line (e.g. Answer: B, Ans: C, Correct Answer: A, Correct: B, Key: D)
        const ansMatch = line.match(/^(?:Answer|Ans|Correct(?:\s*Answer)?|Key)\s*[:=-]\s*([A-Da-d0-4])/i);
        if (ansMatch) {
          const ansChar = ansMatch[1].toUpperCase();
          if (ansChar === "A") correctAnswer = 0;
          else if (ansChar === "B") correctAnswer = 1;
          else if (ansChar === "C") correctAnswer = 2;
          else if (ansChar === "D") correctAnswer = 3;
          else {
            const num = parseInt(ansChar, 10);
            if (!isNaN(num) && num >= 1 && num <= 4) correctAnswer = num - 1;
          }
          continue;
        }

        // Check for Explanation line (e.g. Explanation: ..., Note: ..., Reason: ...)
        const expMatch = line.match(/^(?:Explanation|Note|Reason|Hint)\s*[:=-]\s*(.+)/i);
        if (expMatch) {
          explanation = expMatch[1].trim();
          continue;
        }

        // Check for Options line (e.g. A) ..., B. ..., 1) ...)
        const optMatch = line.match(/^[\(\[]?([A-Da-d])[\)\]\.\:\-]\s*(.+)/);
        if (optMatch) {
          options.push(optMatch[2].trim());
          continue;
        }

        // If not option or answer, it's part of the question prompt
        if (options.length === 0) {
          const cleanLine = line.replace(/^(?:Q(?:uestion)?\s*\d+[\:\.\)]|\d+[\.\)\:])\s*/i, "");
          questionText += (questionText ? " " : "") + cleanLine;
        }
      }

      if (questionText && options.length >= 2) {
        questions.push({
          question: questionText,
          options,
          correctAnswer,
          marks: defaultMarks,
          explanation
        });
      }
    }

    if (questions.length === 0) {
      errors.push("Could not find structured questions. Please verify format (e.g., 1. Question, A) Option, B) Option, Answer: B).");
    }

    this.validateAndPreviewQuestions(questions, errors);
  }

  // --- VALIDATION & LIVE PREVIEW ---
  validateAndPreviewQuestions(rawQuestions, initialErrors = []) {
    const validQuestions = [];
    const errors = [...initialErrors];
    const defaultMarks = parseInt(document.getElementById("bulk-default-marks")?.value) || 2;

    rawQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (!q.question || !q.question.trim()) {
        errors.push(`Item #${qNum}: Missing question text.`);
        return;
      }

      let opts = Array.isArray(q.options) ? q.options.map(o => String(o).trim()).filter(o => o.length > 0) : [];
      if (opts.length < 2) {
        errors.push(`Question #${qNum} ("${q.question.slice(0, 30)}..."): Must have at least 2 answer options.`);
        return;
      }

      // Pad options to 4 if only 2 or 3 provided
      while (opts.length < 4) {
        opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
      }

      let correctIdx = 0;
      if (typeof q.correctAnswer === "number") {
        correctIdx = q.correctAnswer;
      } else if (typeof q.correctAnswer === "string") {
        const upper = q.correctAnswer.trim().toUpperCase();
        if (upper === "A") correctIdx = 0;
        else if (upper === "B") correctIdx = 1;
        else if (upper === "C") correctIdx = 2;
        else if (upper === "D") correctIdx = 3;
        else {
          const num = parseInt(q.correctAnswer, 10);
          correctIdx = isNaN(num) ? 0 : num;
        }
      }

      if (correctIdx < 0 || correctIdx >= opts.length) {
        correctIdx = 0;
      }

      validQuestions.push({
        id: "q_bulk_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        question: q.question.trim(),
        options: opts,
        correctAnswer: correctIdx,
        marks: parseInt(q.marks) || defaultMarks,
        explanation: (q.explanation || "").trim()
      });
    });

    this.parsedBulkQuestions = validQuestions;
    this.renderBulkPreview(validQuestions, errors);
  }

  renderBulkPreview(questions, errors = []) {
    const section = document.getElementById("bulk-preview-section");
    const container = document.getElementById("bulk-preview-container");
    const badgeParsed = document.getElementById("bulk-badge-parsed");
    const badgeValid = document.getElementById("bulk-badge-valid");
    const badgeErrors = document.getElementById("bulk-badge-errors");
    const errorsBanner = document.getElementById("bulk-errors-banner");
    const btnImport = document.getElementById("btn-bulk-confirm-import");

    if (!section || !container) return;

    section.style.display = "block";

    const totalCount = questions.length + errors.length;
    if (badgeParsed) badgeParsed.textContent = `${totalCount} Parsed`;
    if (badgeValid) badgeValid.textContent = `${questions.length} Ready`;

    if (errors.length > 0) {
      if (badgeErrors) {
        badgeErrors.style.display = "inline-block";
        badgeErrors.textContent = `${errors.length} Issues`;
      }
      if (errorsBanner) {
        errorsBanner.style.display = "block";
        errorsBanner.innerHTML = `<strong>⚠️ Parse Warnings:</strong><ul style="margin: 0.35rem 0 0 1.25rem; padding: 0;">${errors.map(e => `<li>${this.escapeHtml(e)}</li>`).join("")}</ul>`;
      }
    } else {
      if (badgeErrors) badgeErrors.style.display = "none";
      if (errorsBanner) errorsBanner.style.display = "none";
    }

    if (questions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No valid questions parsed. Please check your file or pasted text.
        </div>
      `;
      if (btnImport) {
        btnImport.disabled = true;
        btnImport.textContent = "🚀 Import Questions (0)";
      }
      return;
    }

    container.innerHTML = questions.map((q, idx) => `
      <div class="bulk-preview-item">
        <div class="bulk-preview-item-header">
          <div>
            <strong style="color: var(--primary);">#${idx + 1}</strong>
            <span style="font-weight: 600; color: var(--text-primary); margin-left: 0.35rem;">${this.escapeHtml(q.question)}</span>
          </div>
          <span class="badge badge-primary" style="font-size: 0.7rem;">${q.marks} pts</span>
        </div>
        <div class="bulk-preview-options-grid">
          ${q.options.map((opt, oIdx) => `
            <div class="bulk-preview-opt ${oIdx === q.correctAnswer ? 'is-correct' : ''}">
              <strong>${String.fromCharCode(65 + oIdx)}:</strong> ${this.escapeHtml(opt)} ${oIdx === q.correctAnswer ? '✓ (Correct)' : ''}
            </div>
          `).join("")}
        </div>
        ${q.explanation ? `
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; font-style: italic;">
            💡 <strong>Explanation:</strong> ${this.escapeHtml(q.explanation)}
          </div>
        ` : ''}
      </div>
    `).join("");

    if (btnImport) {
      btnImport.disabled = false;
      btnImport.textContent = `🚀 Import ${questions.length} Question${questions.length === 1 ? '' : 's'}`;
    }
  }

  clearBulkImport() {
    this.parsedBulkQuestions = [];
    const fileInput = document.getElementById("bulk-file-input");
    if (fileInput) fileInput.value = "";
    const textInput = document.getElementById("bulk-text-input");
    if (textInput) textInput.value = "";
    const section = document.getElementById("bulk-preview-section");
    if (section) section.style.display = "none";
    const btnImport = document.getElementById("btn-bulk-confirm-import");
    if (btnImport) {
      btnImport.disabled = true;
      btnImport.textContent = "🚀 Import Questions (0)";
    }
  }

  async commitBulkImport() {
    if (!this.parsedBulkQuestions || this.parsedBulkQuestions.length === 0) {
      window.app.showToast("No valid questions to import.", "warning");
      return;
    }

    const selectTarget = document.getElementById("bulk-target-quiz-select");
    const modeSelect = document.getElementById("bulk-import-mode-select");
    const importMode = modeSelect ? modeSelect.value : "append"; // 'append' | 'replace'

    let targetQuizId = selectTarget ? selectTarget.value : null;

    // If user selected "+ Create Brand New Quiz on Import"
    if (targetQuizId === "__new__") {
      const newTitle = prompt("Enter a title for the new quiz:", "Imported Assessment Quiz");
      if (!newTitle || !newTitle.trim()) {
        window.app.showToast("Quiz creation cancelled.", "info");
        return;
      }

      const newQuiz = {
        title: newTitle.trim(),
        category: "General Knowledge",
        testCode: "TEST-" + Math.floor(100 + Math.random() * 900),
        icon: "📝",
        difficulty: "Medium",
        durationMinutes: 15,
        passPercentage: 60,
        description: `Imported with ${this.parsedBulkQuestions.length} questions on ${new Date().toLocaleDateString()}.`,
        questions: this.parsedBulkQuestions,
        totalMarks: this.parsedBulkQuestions.reduce((sum, q) => sum + (q.marks || 2), 0)
      };

      const saved = this.storage.saveQuiz(newQuiz);
      targetQuizId = saved.id;
    } else {
      const quiz = this.storage.getQuizById(targetQuizId);
      if (!quiz) {
        window.app.showToast("Please select a target quiz.", "error");
        return;
      }

      // Save questions in local storage service
      this.storage.bulkSaveQuestions(targetQuizId, this.parsedBulkQuestions, importMode);

      // Also sync with backend API if online
      if (window.apiService) {
        try {
          await window.apiService.questions.bulkCreate(targetQuizId, this.parsedBulkQuestions, importMode);
        } catch (apiErr) {
          console.warn("Backend bulk sync note:", apiErr.message);
        }
      }
    }

    // Success notifications & view updates
    const quizObj = this.storage.getQuizById(targetQuizId);
    const quizTitle = quizObj ? quizObj.title : "Target Quiz";
    window.app.showToast(`🎉 Successfully imported ${this.parsedBulkQuestions.length} questions into "${quizTitle}"!`, "success");

    document.getElementById("modal-bulk-import").classList.remove("open");
    this.renderQuizzesTable();
    this.renderMetricsSummary();
    if (window.app) window.app.renderDashboard();

    // If Question Manager modal was open for this quiz, re-render it
    if (this.editingQuizId === targetQuizId && document.getElementById("modal-question-manager").classList.contains("open")) {
      this.renderQuestionsList(quizObj);
    }
  }

  // --- SAMPLE TEMPLATES ---
  downloadCsvTemplate() {
    const csvContent = '\uFEFF' + [
      '"Question","Option A","Option B","Option C","Option D","Correct Answer (A/B/C/D)","Marks","Explanation"',
      '"What is the size of an int data type in Java?","2 bytes","4 bytes","8 bytes","16 bytes","B",2,"In Java, int is a 32-bit (4 bytes) signed two\'s complement integer."',
      '"Which data structure follows First-In-First-Out (FIFO) order?","Stack","Queue","Binary Tree","Graph","B",2,"Queue operates on the First-In First-Out principle."',
      '"What is the speed of light in vacuum (approx)?","3 x 10^8 m/s","3 x 10^6 m/s","1.5 x 10^8 m/s","3 x 10^10 m/s","A",2,"The speed of light in vacuum is approximately 300,000,000 meters per second."',
      '"What is the chemical formula for water?","CO2","H2O","NaCl","CH4","B",2,"Water is composed of two hydrogen atoms and one oxygen atom (H2O)."',
      '"What is 20% of 450?","70","85","90","100","C",2,"20% of 450 = 0.20 * 450 = 90."'
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quizzmaster_sample_questions_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    window.app.showToast("CSV Template downloaded! 📥", "success");
  }

  downloadJsonTemplate() {
    const sampleData = [
      {
        question: "What is the size of an int data type in Java?",
        options: ["2 bytes", "4 bytes", "8 bytes", "16 bytes"],
        correctAnswer: 1,
        marks: 2,
        explanation: "In Java, int is a 32-bit (4 bytes) signed integer."
      },
      {
        question: "Which data structure follows First-In-First-Out (FIFO) order?",
        options: ["Stack", "Queue", "Binary Tree", "Graph"],
        correctAnswer: 1,
        marks: 2,
        explanation: "Queue operates on First-In-First-Out principle."
      },
      {
        question: "What is 20% of 450?",
        options: ["70", "85", "90", "100"],
        correctAnswer: 2,
        marks: 2,
        explanation: "20% of 450 = 0.20 * 450 = 90."
      }
    ];

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quizzmaster_sample_questions_template.json";
    a.click();
    URL.revokeObjectURL(url);
    window.app.showToast("JSON Template downloaded! 📥", "success");
  }

  copyAiPrompt() {
    const promptText = document.getElementById("sample-ai-prompt-text")?.textContent || "";
    navigator.clipboard.writeText(promptText).then(() => {
      window.app.showToast("AI Prompt copied to clipboard! Paste into ChatGPT / Claude 📋", "success");
    }).catch(() => {
      window.app.showToast("Copied to clipboard!", "info");
    });
  }

  // =========================================================================
  // --- REPORTS & CSV SCORE SHEET EXPORTERS ---
  // =========================================================================

  exportSubmissionsCSV() {
    const attempts = this.storage.getAttempts();
    if (!attempts || attempts.length === 0) {
      window.app.showToast("No student submissions to export yet.", "info");
      return;
    }

    const headers = [
      "Attempt ID",
      "Student Name",
      "Student Email",
      "Quiz Title",
      "Test Code",
      "Category",
      "Score Obtained",
      "Total Marks",
      "Percentage (%)",
      "Result Status",
      "Time Spent (Sec)",
      "Time Spent (Formatted)",
      "Submission Date & Time"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = attempts.map(a => {
      const mins = Math.floor((a.timeSpentSeconds || 0) / 60);
      const secs = (a.timeSpentSeconds || 0) % 60;
      const timeFormatted = `${mins}m ${secs}s`;

      return [
        escapeCsv(a.id),
        escapeCsv(a.userName || "Student"),
        escapeCsv(a.userEmail || "student@email.com"),
        escapeCsv(a.quizTitle || "Quiz"),
        escapeCsv(a.testCode || "N/A"),
        escapeCsv(a.category || "General"),
        escapeCsv(a.score || 0),
        escapeCsv(a.totalMarks || 0),
        escapeCsv(a.percentage || 0),
        escapeCsv(a.passed ? "PASSED" : "FAILED"),
        escapeCsv(a.timeSpentSeconds || 0),
        escapeCsv(timeFormatted),
        escapeCsv(new Date(a.completedAt).toLocaleString())
      ].join(",");
    });

    const csvContent = '\uFEFF' + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quizzmaster_student_scores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.app.showToast("📊 Student score sheet exported as CSV!", "success");
  }

  openPerformanceReportModal(filterQuizId = "all") {
    // Populate quiz filter
    const select = document.getElementById("report-filter-quiz");
    if (select) {
      const quizzes = this.storage.getQuizzes();
      select.innerHTML = `<option value="all">All Quizzes</option>` + quizzes.map(q => `
        <option value="${q.id}" ${q.id === filterQuizId ? 'selected' : ''}>${this.escapeHtml(q.title)}</option>
      `).join("");
      if (filterQuizId) select.value = filterQuizId;
    }

    // Set Admin Name in Report Header
    const currentUser = this.auth.getCurrentUser();
    const adminNameEl = document.getElementById("report-admin-name");
    if (adminNameEl && currentUser) {
      adminNameEl.textContent = currentUser.name || "Dr. Sarah Mitchell";
    }

    this.renderPerformanceReport();
    document.getElementById("modal-performance-report").classList.add("open");
  }

  renderPerformanceReport() {
    const filterQuiz = document.getElementById("report-filter-quiz")?.value || "all";
    const filterStatus = document.getElementById("report-filter-status")?.value || "all";

    let attempts = this.storage.getAttempts();

    if (filterQuiz !== "all") {
      attempts = attempts.filter(a => a.quizId === filterQuiz);
    }

    if (filterStatus === "passed") {
      attempts = attempts.filter(a => a.passed);
    } else if (filterStatus === "failed") {
      attempts = attempts.filter(a => !a.passed);
    }

    // Update Header Date
    const genDateEl = document.getElementById("report-gen-date");
    if (genDateEl) {
      genDateEl.textContent = new Date().toLocaleString();
    }

    // Calculate Summary Stats
    const totalSubmissions = attempts.length;
    const passedCount = attempts.filter(a => a.passed).length;
    const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;
    const avgScore = totalSubmissions > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / totalSubmissions)
      : 0;
    const highScore = totalSubmissions > 0
      ? Math.max(...attempts.map(a => a.score || 0))
      : 0;

    document.getElementById("report-stat-total").textContent = totalSubmissions;
    document.getElementById("report-stat-pass-rate").textContent = `${passRate}%`;
    document.getElementById("report-stat-avg-score").textContent = `${avgScore}%`;
    document.getElementById("report-stat-high-score").textContent = `${highScore} pts`;

    // Category Breakdown
    const catBox = document.getElementById("report-category-summary-box");
    if (catBox) {
      const catMap = {};
      attempts.forEach(a => {
        const cat = a.category || "General";
        if (!catMap[cat]) catMap[cat] = { total: 0, passed: 0 };
        catMap[cat].total++;
        if (a.passed) catMap[cat].passed++;
      });

      const catHtml = Object.entries(catMap).map(([cat, val]) => {
        const pct = Math.round((val.passed / val.total) * 100);
        return `
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.6rem 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 0.85rem;">${cat}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">${val.total} attempts (${pct}% pass)</span>
          </div>
        `;
      }).join("");

      catBox.innerHTML = catHtml ? `
        <h5 style="font-size: 0.88rem; margin-bottom: 0.4rem; color: var(--text-secondary);">Subject Pass Rate Breakdown:</h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">${catHtml}</div>
      ` : '';
    }

    // Submissions Table
    const tbody = document.getElementById("report-table-tbody");
    const countEl = document.getElementById("report-table-row-count");
    if (countEl) countEl.textContent = `Showing ${attempts.length} record${attempts.length === 1 ? '' : 's'}`;

    if (!tbody) return;

    if (attempts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No student attempts matching current filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = attempts.map((a, idx) => {
      const mins = Math.floor((a.timeSpentSeconds || 0) / 60);
      const secs = (a.timeSpentSeconds || 0) % 60;
      const timeFormatted = `${mins}m ${secs}s`;

      return `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span>${a.userAvatar || '🎓'}</span>
              <div>
                <strong>${this.escapeHtml(a.userName || 'Student')}</strong>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${this.escapeHtml(a.userEmail || '')}</div>
              </div>
            </div>
          </td>
          <td><strong>${this.escapeHtml(a.quizTitle || 'Quiz')}</strong></td>
          <td><span class="badge badge-primary" style="font-size: 0.72rem;">${this.escapeHtml(a.category || 'General')}</span></td>
          <td><strong>${a.score}/${a.totalMarks}</strong></td>
          <td><strong>${a.percentage}%</strong></td>
          <td>
            <span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}" style="font-size: 0.72rem;">
              ${a.passed ? 'PASSED ✓' : 'FAILED ✗'}
            </span>
          </td>
          <td>${timeFormatted}</td>
          <td style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
            ${new Date(a.completedAt).toLocaleDateString()}
          </td>
        </tr>
      `;
    }).join("");
  }

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

window.adminController = new AdminController(window.storageService, window.authService);
