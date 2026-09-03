/**
 * Main Application Controller (QuizSphere / QuizzMaster Pro)
 * Coordinates View Routing, Authentication Flows, Live Quiz Engine,
 * Instant Results, Leaderboards, Certificates, and User History.
 */

class AppController {
  constructor(storage, auth, timer, sound, confetti) {
    this.storage = storage;
    this.auth = auth;
    this.timer = timer;
    this.sound = sound;
    this.confetti = confetti;

    this.currentView = "hero";
    this.activeQuiz = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {}; // { [questionIndex]: optionIndex }
    this.markedForReview = new Set();
    this.currentCategoryFilter = "all";
    this.currentSearchQuery = "";
    this.lastResultData = null;
    this.historyAdminMode = "my"; // 'my' | 'all'
    this.dashViewMode = "grid"; // 'grid' | 'table'
  }

  init() {
    this.initTheme();
    this.bindGlobalEvents();
    this.bindAuthEvents();
    this.bindQuizEvents();

    // Check initial session
    const user = this.auth.getCurrentUser();
    if (user) {
      this.updateAuthUI(user);
      this.navigate("dashboard");
    } else {
      this.updateAuthUI(null);
      this.navigate("hero");
    }

    if (window.adminController) {
      window.adminController.init();
    }

    // Background sync client with MongoDB Atlas
    this.syncWithBackend();
  }

  async syncWithBackend() {
    if (!window.apiService) return;
    try {
      // 1. Sync any local accounts (like newly registered user) to MongoDB Atlas
      const localUsers = this.storage.getUsers();
      for (const u of localUsers) {
        if (u.email && !u.id.startsWith("user_student_1") && !u.id.startsWith("user_admin_1")) {
          window.apiService.auth.google({
            email: u.email,
            name: u.name,
            avatar: u.avatar || "🎓",
            role: u.role || "student"
          }).catch(() => {});
        }
      }

      // 2. Fetch fresh quizzes from MongoDB Atlas
      const quizzesData = await window.apiService.quizzes.getAll();
      if (quizzesData && quizzesData.quizzes && quizzesData.quizzes.length > 0) {
        quizzesData.quizzes.forEach(q => {
          this.storage.saveQuiz(q);
        });
      }
    } catch (err) {
      console.warn("Background cloud sync notice:", err.message);
    }
  }

  // --- THEME & SETTINGS ---
  initTheme() {
    const settings = this.storage.getSettings();
    document.documentElement.setAttribute("data-theme", settings.theme || "dark");
    this.updateThemeToggleIcon(settings.theme || "dark");
    this.updateSoundToggleIcon(settings.sound !== false);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);

    const settings = this.storage.getSettings();
    this.storage.saveSettings({ ...settings, theme: newTheme });
    this.updateThemeToggleIcon(newTheme);
    this.showToast(`Switched to ${newTheme} theme`, "info");
  }

  updateThemeToggleIcon(theme) {
    const btn = document.getElementById("btn-toggle-theme");
    if (btn) {
      btn.innerHTML = theme === "dark" ? "☀️" : "🌙";
      btn.title = `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`;
    }
  }

  toggleSound() {
    const isEnabled = this.sound.toggleSound();
    this.updateSoundToggleIcon(isEnabled);
    this.showToast(isEnabled ? "Sound Effects Enabled 🔊" : "Sound Effects Muted 🔇", "info");
    if (isEnabled) this.sound.playClick();
  }

  updateSoundToggleIcon(isEnabled) {
    const btn = document.getElementById("btn-toggle-sound");
    if (btn) {
      btn.innerHTML = isEnabled ? "🔊" : "🔇";
      btn.title = isEnabled ? "Mute Sound" : "Enable Sound";
    }
  }

  // --- ROUTING & VIEW NAVIGATION ---
  navigate(viewName, params = {}) {
    // Route guard for protected views
    const user = this.auth.getCurrentUser();
    const protectedViews = ["dashboard", "quiz-arena", "results", "history", "admin"];

    if (protectedViews.includes(viewName) && !user) {
      this.showToast("Please login or register to access this section", "info");
      this.navigate("auth", { tab: "login" });
      return;
    }

    if (viewName === "admin") {
      this.navigate("dashboard");
      return;
    }

    // If logged in and trying to go to hero, auth, or admin, redirect to dashboard
    if (user && (viewName === "hero" || viewName === "auth" || viewName === "admin")) {
      viewName = "dashboard";
    }

    this.currentView = viewName;

    // Toggle Exam Focus Mode on body/navbar
    const isExamMode = viewName === "quiz-arena";
    document.body.classList.toggle("exam-mode", isExamMode);

    // Update view containers
    document.querySelectorAll(".view-container").forEach(el => {
      el.classList.remove("active");
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Update active nav items
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-view") === viewName);
    });

    // View specific hooks
    if (viewName === "dashboard") this.renderDashboard();
    if (viewName === "leaderboard") this.renderLeaderboard();
    if (viewName === "history") this.renderHistory();
    if (viewName === "auth" && params.tab) this.switchAuthTab(params.tab);
  }

  // --- GLOBAL EVENT BINDINGS ---
  bindGlobalEvents() {
    // Brand logo click (Protected in exam mode)
    const brandLogo = document.getElementById("nav-brand-logo");
    if (brandLogo) {
      brandLogo.addEventListener("click", () => {
        if (this.currentView === "quiz-arena" && this.activeQuiz) {
          this.openSubmitConfirmModal();
          return;
        }
        this.sound.playClick();
        const user = this.auth.getCurrentUser();
        if (user) {
          this.navigate("dashboard");
        } else {
          this.navigate("hero");
        }
      });
    }

    // Nav bar clicks (Protected in exam mode)
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = el.getAttribute("data-nav");
        if (this.currentView === "quiz-arena" && this.activeQuiz && targetView !== "quiz-arena") {
          this.openSubmitConfirmModal();
          return;
        }
        this.sound.playClick();
        this.navigate(targetView);
      });
    });

    // Theme toggle button
    const themeBtn = document.getElementById("btn-toggle-theme");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => this.toggleTheme());
    }

    // Sound toggle button
    const soundBtn = document.getElementById("btn-toggle-sound");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => this.toggleSound());
    }

    // Logout button
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.sound.playClick();
        this.auth.logout();
        this.showToast("Logged out successfully", "info");
        this.navigate("hero");
      });
    }

    // Edit Profile Triggers
    const btnNavProfile = document.getElementById("btn-edit-profile-nav");
    if (btnNavProfile) {
      btnNavProfile.addEventListener("click", () => this.openProfileModal());
    }

    const btnDashProfile = document.getElementById("btn-edit-profile-dash");
    if (btnDashProfile) {
      btnDashProfile.addEventListener("click", () => this.openProfileModal());
    }

    const btnAdminProfile = document.getElementById("btn-edit-profile-admin");
    if (btnAdminProfile) {
      btnAdminProfile.addEventListener("click", () => this.openProfileModal());
    }

    // Profile Avatar Selector
    document.querySelectorAll("#profile-avatar-grid .avatar-option").forEach(opt => {
      opt.addEventListener("click", () => {
        document.querySelectorAll("#profile-avatar-grid .avatar-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        const avatar = opt.getAttribute("data-avatar");
        const input = document.getElementById("profile-avatar-input");
        if (input) input.value = avatar;
      });
    });

    // Profile Form Submit
    const profileForm = document.getElementById("form-profile-editor");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) => this.handleSaveProfile(e));
    }

    // History View Create Quiz Button
    const btnHistCreate = document.getElementById("btn-history-create-quiz");
    if (btnHistCreate) {
      btnHistCreate.addEventListener("click", () => {
        this.sound.playClick();
        if (window.adminController) window.adminController.openQuizModal();
      });
    }

    // History Mode Tabs (Admin)
    const tabHistMy = document.getElementById("tab-history-my");
    const tabHistAll = document.getElementById("tab-history-all");
    if (tabHistMy && tabHistAll) {
      tabHistMy.addEventListener("click", () => {
        this.sound.playClick();
        this.historyAdminMode = "my";
        tabHistMy.classList.add("active");
        tabHistAll.classList.remove("active");
        this.renderHistory();
      });
      tabHistAll.addEventListener("click", () => {
        this.sound.playClick();
        this.historyAdminMode = "all";
        tabHistAll.classList.add("active");
        tabHistMy.classList.remove("active");
        this.renderHistory();
      });
    }

    // Dashboard Create Quiz, Manage Quizzes & Backup Buttons (Admin)
    const btnDashCreateQuiz = document.getElementById("btn-dash-create-quiz");
    if (btnDashCreateQuiz) {
      btnDashCreateQuiz.addEventListener("click", () => {
        this.sound.playClick();
        if (window.adminController) window.adminController.openQuizModal();
      });
    }

    const btnDashManage = document.getElementById("btn-dash-manage-quizzes");
    if (btnDashManage) {
      btnDashManage.addEventListener("click", () => {
        this.sound.playClick();
        this.dashViewMode = (this.dashViewMode === "grid" ? "table" : "grid");
        btnDashManage.textContent = this.dashViewMode === "table" ? "🎮 Card View" : "⚙️ Manage Quizzes";
        this.renderQuizzesGrid();
      });
    }

    const btnDashBackup = document.getElementById("btn-dash-backup-data");
    if (btnDashBackup) {
      btnDashBackup.addEventListener("click", () => {
        this.sound.playClick();
        document.getElementById("modal-backup-manager").classList.add("open");
      });
    }

    // Modal Backup Actions
    const btnModalExport = document.getElementById("btn-export-backup-modal");
    if (btnModalExport) {
      btnModalExport.addEventListener("click", () => {
        if (window.adminController) window.adminController.exportDatabase();
      });
    }

    const fileModalImport = document.getElementById("file-import-backup-modal");
    if (fileModalImport) {
      fileModalImport.addEventListener("change", (e) => {
        if (window.adminController) window.adminController.importDatabase(e);
      });
    }

    const btnModalReset = document.getElementById("btn-reset-backup-modal");
    if (btnModalReset) {
      btnModalReset.addEventListener("click", () => {
        if (window.adminController) window.adminController.resetDatabase();
      });
    }

    // Quick Test Code Join Form
    const formJoinCode = document.getElementById("form-join-code");
    if (formJoinCode) {
      formJoinCode.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("dash-join-code-input");
        const code = input ? input.value.trim() : "";
        if (!code) return;
        const quiz = this.storage.getQuizByCode(code);
        if (!quiz) {
          this.sound.playFail();
          this.showToast(`No test found with code "${code.toUpperCase()}". Please verify with your instructor.`, "error");
          return;
        }
        this.sound.playClick();
        input.value = "";
        this.openQuizInstructions(quiz.id);
      });
    }

    // Test Password Unlock Form
    const formQuizPassword = document.getElementById("form-quiz-password");
    if (formQuizPassword) {
      formQuizPassword.addEventListener("submit", (e) => {
        e.preventDefault();
        const quizId = document.getElementById("quiz-unlock-id").value;
        const enteredPw = document.getElementById("quiz-unlock-password-input").value;
        const quiz = this.storage.getQuizById(quizId);
        if (!quiz) return;

        if (quiz.password && quiz.password.trim() !== "" && quiz.password !== enteredPw) {
          this.sound.playFail();
          this.showToast("Incorrect test password! Please check with your instructor.", "error");
          return;
        }

        this.sound.playSuccess();
        document.getElementById("modal-quiz-password").classList.remove("open");
        document.getElementById("quiz-unlock-password-input").value = "";
        this.showToast("Test unlocked! 🔓", "success");
        this.showQuizInstructionsModal(quiz);
      });
    }

    // Modal Close buttons (data-close-modal)
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modalId = btn.getAttribute("data-close-modal");
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("open");
      });
    });

    // Close modal on click outside card
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("open");
        }
      });
    });

    // Listen for auth change broadcasts
    window.addEventListener("auth:change", (e) => {
      this.updateAuthUI(e.detail.user);
    });

    // Password visibility toggles
    this.initPasswordToggles();
  }

  // --- PASSWORD VISIBILITY TOGGLE ---
  initPasswordToggles() {
    document.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest(".password-toggle-btn");
      if (!toggleBtn) return;

      e.preventDefault();
      e.stopPropagation();

      // Find the associated password input
      let input = null;
      const targetId = toggleBtn.getAttribute("data-target");
      if (targetId) {
        input = document.getElementById(targetId);
      }
      if (!input) {
        const wrapper = toggleBtn.closest(".password-input-wrapper");
        if (wrapper) {
          input = wrapper.querySelector("input");
        }
      }

      if (!input) return;

      const isPassword = input.getAttribute("type") === "password";
      if (isPassword) {
        input.setAttribute("type", "text");
        toggleBtn.classList.add("is-revealed");
        toggleBtn.setAttribute("title", "Hide password");
        toggleBtn.setAttribute("aria-label", "Hide password");
      } else {
        input.setAttribute("type", "password");
        toggleBtn.classList.remove("is-revealed");
        toggleBtn.setAttribute("title", "Show password");
        toggleBtn.setAttribute("aria-label", "Show password");
      }

      input.focus();
    });
  }

  // --- PROFILE MANAGEMENT ---
  openProfileModal() {
    const user = this.auth.getCurrentUser();
    if (!user) {
      this.showToast("Please login to view or edit your profile.", "info");
      this.navigate("auth", { tab: "login" });
      return;
    }

    const fullUser = this.storage.getUserById(user.id) || user;

    document.getElementById("profile-field-name").value = fullUser.name || "";
    document.getElementById("profile-field-email").value = fullUser.email || "";
    document.getElementById("profile-field-current-pw").value = "";
    document.getElementById("profile-field-new-pw").value = "";
    document.getElementById("profile-avatar-input").value = fullUser.avatar || "🎓";

    const roleEl = document.getElementById("profile-display-role");
    if (roleEl) {
      roleEl.textContent = fullUser.role === "admin" ? "Administrator ⚡" : "Student 🎓";
      roleEl.style.color = fullUser.role === "admin" ? "var(--accent-purple)" : "var(--primary)";
    }

    const joinedEl = document.getElementById("profile-display-joined");
    if (joinedEl) {
      joinedEl.textContent = fullUser.createdAt ? new Date(fullUser.createdAt).toLocaleDateString() : "Active Member";
    }

    // Highlight selected avatar
    const currentAvatar = fullUser.avatar || "🎓";
    document.querySelectorAll("#profile-avatar-grid .avatar-option").forEach(opt => {
      opt.classList.toggle("selected", opt.getAttribute("data-avatar") === currentAvatar);
    });

    this.sound.playClick();
    document.getElementById("modal-profile-editor").classList.add("open");
  }

  handleSaveProfile(e) {
    if (e && e.preventDefault) e.preventDefault();

    const name = document.getElementById("profile-field-name").value.trim();
    const email = document.getElementById("profile-field-email").value.trim();
    const avatar = document.getElementById("profile-avatar-input").value || "🎓";
    const currentPassword = document.getElementById("profile-field-current-pw").value;
    const newPassword = document.getElementById("profile-field-new-pw").value;

    try {
      const updatedUser = this.auth.updateProfile({
        name,
        email,
        avatar,
        currentPassword,
        newPassword
      });

      this.sound.playSuccess();
      this.showToast(`Profile updated successfully, ${updatedUser.name}! ✨`, "success");
      document.getElementById("modal-profile-editor").classList.remove("open");

      // Refresh currently active view
      if (this.currentView === "dashboard") this.renderDashboard();
      if (this.currentView === "leaderboard") this.renderLeaderboard();
      if (this.currentView === "history") this.renderHistory();
      if (this.currentView === "admin" && window.adminController) window.adminController.renderAdminView();
    } catch (err) {
      this.sound.playFail();
      this.showToast(err.message, "error");
    }
  }

  // --- AUTHENTICATION FLOW ---
  bindAuthEvents() {
    // Auth Tab Switch (Login vs Register)
    document.querySelectorAll(".auth-tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.getAttribute("data-tab");
        this.switchAuthTab(tab);
      });
    });

    // Avatar selector in registration form
    let selectedAvatar = "🎓";
    document.querySelectorAll(".avatar-option").forEach(opt => {
      opt.addEventListener("click", () => {
        document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        selectedAvatar = opt.getAttribute("data-avatar");
        const input = document.getElementById("reg-avatar-input");
        if (input) input.value = selectedAvatar;
      });
    });

    // Login Form Submit
    const loginForm = document.getElementById("form-login");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
          const user = await this.auth.login(email, password);
          this.sound.playSuccess();
          this.showToast(`Welcome back, ${user.name}! 👋`, "success");
          this.navigate("dashboard");
        } catch (err) {
          this.sound.playFail();
          this.showToast(err.message, "error");
        }
      });
    }

    // Register Form Submit
    const registerForm = document.getElementById("form-register");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;
        const role = document.getElementById("reg-role").value;
        const avatar = document.getElementById("reg-avatar-input").value || selectedAvatar;

        try {
          const user = await this.auth.register({ name, email, password, role, avatar });
          this.sound.playSuccess();
          this.showToast(`Account created! Welcome, ${user.name}! 🎉`, "success");
          this.navigate("dashboard");
        } catch (err) {
          this.sound.playFail();
          this.showToast(err.message, "error");
        }
      });
    }

    // Google / Gmail Sign In Modal Trigger
    const btnGoogleLogin = document.getElementById("btn-google-login");
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener("click", () => {
        this.sound.playClick();
        this.openGoogleAuthModal();
      });
    }

    const btnHeroGoogle = document.getElementById("btn-hero-google");
    if (btnHeroGoogle) {
      btnHeroGoogle.addEventListener("click", () => {
        this.sound.playClick();
        this.openGoogleAuthModal();
      });
    }

    // Google Account Chooser: 1-Click Select on Account Rows
    document.querySelectorAll(".google-user-row[data-google-email]").forEach(row => {
      row.addEventListener("click", () => {
        const email = row.getAttribute("data-google-email");
        const name = row.getAttribute("data-google-name") || "Vitthal Kawade";
        const avatar = row.getAttribute("data-google-avatar") || "V";

        row.classList.add("is-verifying");
        this.sound.playClick();

        setTimeout(() => {
          row.classList.remove("is-verifying");
          this.handleGoogleSelect(email, name, avatar, "student");
        }, 320);
      });
    });

    // "Use another account" button click
    const btnUseAnother = document.getElementById("btn-google-use-another");
    const chooserPane = document.getElementById("google-view-chooser");
    const customPane = document.getElementById("google-view-custom");

    if (btnUseAnother && chooserPane && customPane) {
      btnUseAnother.addEventListener("click", () => {
        this.sound.playClick();
        chooserPane.style.display = "none";
        customPane.style.display = "block";
        const emailInput = document.getElementById("google-custom-email-input");
        if (emailInput) {
          setTimeout(() => emailInput.focus(), 50);
        }
      });
    }

    // "Back" button to return to account list
    const btnBackToList = document.getElementById("btn-google-back-to-list");
    if (btnBackToList && chooserPane && customPane) {
      btnBackToList.addEventListener("click", () => {
        this.sound.playClick();
        customPane.style.display = "none";
        chooserPane.style.display = "block";
      });
    }

    // Form Custom Google Sign In
    const formCustomGoogle = document.getElementById("form-google-custom-signin");
    if (formCustomGoogle) {
      formCustomGoogle.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("google-custom-email-input").value.trim();
        let name = document.getElementById("google-custom-name-input").value.trim();
        if (!name) {
          const prefix = email.split("@")[0].replace(/[._-]/g, " ");
          name = prefix.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Google Scholar";
        }
        const avatar = name.charAt(0).toUpperCase() || "🎓";
        this.handleGoogleSelect(email, name, avatar, "student");
      });
    }
  }

  openGoogleAuthModal() {
    const modal = document.getElementById("modal-google-auth");
    const chooserPane = document.getElementById("google-view-chooser");
    const customPane = document.getElementById("google-view-custom");
    if (chooserPane) chooserPane.style.display = "block";
    if (customPane) customPane.style.display = "none";
    if (modal) modal.classList.add("open");
  }

  handleGoogleSelect(email, name, avatar, role = "student") {
    try {
      const user = this.auth.googleLogin({ email, name, avatar, role });
      const modal = document.getElementById("modal-google-auth");
      if (modal) modal.classList.remove("open");

      this.sound.playSuccess();
      this.showToast(`Signed in as ${user.name} (${user.email}) via Google 🚀`, "success");
      this.navigate("dashboard");
    } catch (err) {
      this.sound.playFail();
      this.showToast(err.message, "error");
    }
  }

  switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    const loginForm = document.getElementById("form-login");
    const registerForm = document.getElementById("form-register");
    if (loginForm) loginForm.style.display = tab === "login" ? "block" : "none";
    if (registerForm) registerForm.style.display = tab === "register" ? "block" : "none";
  }

  updateAuthUI(user) {
    const unauthEls = document.querySelectorAll(".auth-only-logged-out");
    const authEls = document.querySelectorAll(".auth-only-logged-in");
    const adminEls = document.querySelectorAll(".auth-only-admin");

    if (user) {
      unauthEls.forEach(el => el.style.display = "none");
      authEls.forEach(el => el.style.display = "flex");

      if (user.role === "admin") {
        adminEls.forEach(el => el.style.display = "flex");
      } else {
        adminEls.forEach(el => el.style.display = "none");
      }

      // Update Nav User Chip
      const chipAvatar = document.getElementById("nav-user-avatar");
      const chipName = document.getElementById("nav-user-name");
      if (chipAvatar) chipAvatar.textContent = user.avatar || "🎓";
      if (chipName) chipName.textContent = user.name;
    } else {
      unauthEls.forEach(el => el.style.display = "flex");
      authEls.forEach(el => el.style.display = "none");
      adminEls.forEach(el => el.style.display = "none");
    }
  }

  // --- DASHBOARD RENDERING ---
  renderDashboard() {
    const user = this.auth.getCurrentUser();
    if (!user) return;

    const isAdmin = user.role === "admin";

    // Welcome banner
    const elName = document.getElementById("dash-user-name");
    const elAvatar = document.getElementById("dash-user-avatar");
    if (elName) elName.textContent = user.name;
    if (elAvatar) elAvatar.textContent = user.avatar || "🎓";

    // User / Admin stats
    const elTaken = document.getElementById("dash-stat-taken");
    const elPassed = document.getElementById("dash-stat-passed");
    const elAvg = document.getElementById("dash-stat-avg");
    const elTopCat = document.getElementById("dash-stat-top-cat");

    const elLabel1 = document.getElementById("dash-stat-label-1");
    const elLabel2 = document.getElementById("dash-stat-label-2");
    const elLabel3 = document.getElementById("dash-stat-label-3");
    const elLabel4 = document.getElementById("dash-stat-label-4");

    if (isAdmin) {
      const adminStats = this.storage.getAdminStats();
      if (elTaken) elTaken.textContent = adminStats.totalStudents;
      if (elPassed) elPassed.textContent = adminStats.totalQuizzes;
      if (elAvg) elAvg.textContent = adminStats.totalAttempts;
      if (elTopCat) elTopCat.textContent = `${adminStats.avgAccuracy}%`;

      if (elLabel1) elLabel1.textContent = "Registered Students";
      if (elLabel2) elLabel2.textContent = "Active Quizzes";
      if (elLabel3) elLabel3.textContent = "Total Attempts";
      if (elLabel4) elLabel4.textContent = "Avg Accuracy";
    } else {
      const stats = this.storage.getUserStats(user.id);
      if (elTaken) elTaken.textContent = stats.totalAttempts;
      if (elPassed) elPassed.textContent = stats.passedCount;
      if (elAvg) elAvg.textContent = `${stats.avgScorePct}%`;
      if (elTopCat) elTopCat.textContent = stats.topCategory;

      if (elLabel1) elLabel1.textContent = "Quizzes Taken";
      if (elLabel2) elLabel2.textContent = "Quizzes Passed";
      if (elLabel3) elLabel3.textContent = "Average Score";
      if (elLabel4) elLabel4.textContent = "Top Category";
    }

    // Category filter chips
    this.bindCategoryFilters();

    // Render Quizzes Grid
    this.renderQuizzesGrid();
  }

  bindCategoryFilters() {
    document.querySelectorAll(".dash-cat-pill").forEach(pill => {
      pill.onclick = (e) => {
        document.querySelectorAll(".dash-cat-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.currentCategoryFilter = pill.getAttribute("data-category");
        this.sound.playClick();
        this.renderQuizzesGrid();
      };
    });

    const searchInput = document.getElementById("dash-search-input");
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.currentSearchQuery = e.target.value;
        this.renderQuizzesGrid();
      };
    }
  }

  renderQuizzesGrid() {
    const gridContainer = document.getElementById("dash-quizzes-grid");
    const tableContainer = document.getElementById("dash-quizzes-table-container");
    const tableBody = document.getElementById("dash-quizzes-table-tbody");
    if (!gridContainer) return;

    const user = this.auth.getCurrentUser();
    const isAdmin = user && user.role === "admin";

    let quizzes = this.storage.getQuizzes();

    // Filter by Category
    if (this.currentCategoryFilter !== "all") {
      quizzes = quizzes.filter(q => q.category === this.currentCategoryFilter);
    }

    // Filter by Search Query (Title, Category, Test Code, or Description)
    if (this.currentSearchQuery.trim()) {
      const q = this.currentSearchQuery.toLowerCase().trim();
      quizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(q) ||
        quiz.category.toLowerCase().includes(q) ||
        (quiz.testCode && quiz.testCode.toLowerCase().includes(q)) ||
        (quiz.description && quiz.description.toLowerCase().includes(q))
      );
    }

    // Admin Table Mode
    if (this.dashViewMode === "table" && isAdmin) {
      if (gridContainer) gridContainer.style.display = "none";
      if (tableContainer) tableContainer.style.display = "block";

      if (tableBody) {
        if (quizzes.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No quizzes found matching this filter.</td></tr>`;
          return;
        }

        tableBody.innerHTML = quizzes.map(quiz => {
          const qCount = quiz.questions ? quiz.questions.length : 0;
          const diff = quiz.difficulty || "Medium";

          return `
            <tr>
              <td>
                <div class="table-user-cell">
                  <span class="table-user-avatar">${quiz.icon || '📝'}</span>
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                      <strong>${this.escapeHtml(quiz.title)}</strong>
                      <span class="badge badge-primary" style="font-size: 0.68rem; font-weight: 700;">🏷️ ${this.escapeHtml(quiz.testCode || quiz.id)}</span>
                      ${quiz.password ? '<span class="badge badge-danger" style="font-size: 0.65rem;">🔒 Password</span>' : ''}
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${this.escapeHtml(quiz.category)}</span>
                  </div>
                </div>
              </td>
              <td><span class="badge badge-${diff.toLowerCase()}">${diff}</span></td>
              <td><strong>${qCount} Qs</strong></td>
              <td>${quiz.durationMinutes} mins</td>
              <td><strong>${quiz.passPercentage}%</strong></td>
              <td>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                  <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.55rem;" title="Manage Questions" onclick="if(window.adminController) window.adminController.openQuestionManager('${quiz.id}')">
                    ❓ Questions (${qCount})
                  </button>
                  <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.55rem;" title="Edit Quiz" onclick="if(window.adminController) window.adminController.openQuizModal('${quiz.id}')">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-secondary btn-sm" style="color: var(--danger); font-size: 0.75rem; padding: 0.25rem 0.55rem;" title="Delete Quiz" onclick="if(window.adminController) window.adminController.deleteQuiz('${quiz.id}')">
                    🗑️
                  </button>
                  <button class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.55rem;" title="Test Quiz" onclick="window.app.openQuizInstructions('${quiz.id}')">
                    🚀 Test
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }
      return;
    }

    // Default: Card Grid View
    if (gridContainer) gridContainer.style.display = "grid";
    if (tableContainer) tableContainer.style.display = "none";

    if (quizzes.length === 0) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>No Quizzes Found</h3>
          <p>Try searching for a different test code or title.</p>
          ${isAdmin ? `<button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="if(window.adminController) window.adminController.openQuizModal()">+ Create New Quiz 📝</button>` : ''}
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = quizzes.map(quiz => {
      const questionsCount = quiz.questions ? quiz.questions.length : 0;
      const difficulty = quiz.difficulty || "Medium";

      return `
        <div class="quiz-card">
          <div>
            <div class="quiz-card-top">
              <span class="quiz-icon-badge">${quiz.icon || '📝'}</span>
              <div class="quiz-meta-tags">
                <span class="badge badge-primary">${this.escapeHtml(quiz.category)}</span>
                <span class="badge badge-secondary" style="font-weight: 700;">🏷️ ${this.escapeHtml(quiz.testCode || quiz.id)}</span>
                ${quiz.password ? '<span class="badge badge-danger" style="font-size: 0.65rem;">🔒 Password</span>' : ''}
                <span class="badge badge-${difficulty.toLowerCase()}">${difficulty}</span>
              </div>
            </div>

            <h3 class="quiz-card-title">${this.escapeHtml(quiz.title)}</h3>
            <p class="quiz-card-desc">${this.escapeHtml(quiz.description || "Comprehensive multiple-choice test.")}</p>
          </div>

          <div>
            <div class="quiz-card-details">
              <span>⏱️ ${quiz.durationMinutes} mins</span>
              <span>❓ ${questionsCount} Questions</span>
              <span>🎯 Pass: ${quiz.passPercentage}%</span>
            </div>

            ${isAdmin ? `
              <div style="display: flex; gap: 0.4rem; margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px dashed var(--border-subtle); flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 0.35rem 0.5rem;" title="Edit Quiz Settings" onclick="if(window.adminController) window.adminController.openQuizModal('${quiz.id}')">
                  ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-sm" style="flex: 1.2; font-size: 0.78rem; padding: 0.35rem 0.5rem;" title="Manage Questions" onclick="if(window.adminController) window.adminController.openQuestionManager('${quiz.id}')">
                  ❓ Questions (${questionsCount})
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--danger); font-size: 0.78rem; padding: 0.35rem 0.5rem;" title="Delete Quiz" onclick="if(window.adminController) window.adminController.deleteQuiz('${quiz.id}')">
                  🗑️
                </button>
              </div>
            ` : ''}

            <button class="btn btn-primary" style="width: 100%; margin-top: ${isAdmin ? '0.5rem' : '1rem'};" onclick="window.app.openQuizInstructions('${quiz.id}')">
              ${isAdmin ? 'Preview / Test Quiz 🚀' : (quiz.password ? 'Enter Password & Start 🔒' : 'Start Quiz 🚀')}
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  // --- QUIZ INSTRUCTIONS & PASSWORD UNLOCK MODAL ---
  openQuizInstructions(quizId) {
    const quiz = this.storage.getQuizById(quizId);
    if (!quiz) return;

    const user = this.auth.getCurrentUser();
    const isAdmin = user && user.role === "admin";

    // If quiz is password protected and user is NOT admin, prompt password unlock
    if (quiz.password && quiz.password.trim() !== "" && !isAdmin) {
      document.getElementById("quiz-unlock-id").value = quiz.id;
      document.getElementById("quiz-unlock-title").textContent = quiz.title;
      document.getElementById("quiz-unlock-code-badge").textContent = `🏷️ Code: ${quiz.testCode || quiz.id}`;
      document.getElementById("quiz-unlock-password-input").value = "";
      this.sound.playClick();
      document.getElementById("modal-quiz-password").classList.add("open");
      setTimeout(() => document.getElementById("quiz-unlock-password-input")?.focus(), 200);
      return;
    }

    this.showQuizInstructionsModal(quiz);
  }

  showQuizInstructionsModal(quiz) {
    this.activeQuiz = quiz;

    const modal = document.getElementById("modal-quiz-instructions");
    const titleEl = document.getElementById("modal-inst-title");
    const catEl = document.getElementById("modal-inst-category");
    const qCountEl = document.getElementById("modal-inst-qcount");
    const timeEl = document.getElementById("modal-inst-time");
    const marksEl = document.getElementById("modal-inst-marks");
    const passEl = document.getElementById("modal-inst-pass");

    const questionsCount = quiz.questions ? quiz.questions.length : 0;

    if (titleEl) titleEl.innerHTML = `${quiz.icon || '📝'} ${this.escapeHtml(quiz.title)} <span class="badge badge-primary" style="font-size: 0.72rem; margin-left: 0.4rem;">🏷️ ${this.escapeHtml(quiz.testCode || quiz.id)}</span>`;
    if (catEl) catEl.textContent = quiz.category;
    if (qCountEl) qCountEl.textContent = `${questionsCount} Questions`;
    if (timeEl) timeEl.textContent = `${quiz.durationMinutes} Minutes`;
    if (marksEl) marksEl.textContent = `${quiz.totalMarks || (questionsCount * 2)} Marks`;
    if (passEl) passEl.textContent = `${quiz.passPercentage}%`;

    const startBtn = document.getElementById("btn-start-quiz-confirmed");
    if (startBtn) {
      startBtn.onclick = () => {
        modal.classList.remove("open");
        this.startQuizArena(quiz);
      };
    }

    this.sound.playClick();
    modal.classList.add("open");
  }

  // --- LIVE QUIZ ENGINE ---
  startQuizArena(quiz) {
    if (!quiz.questions || quiz.questions.length === 0) {
      this.showToast("This quiz currently has no questions.", "error");
      return;
    }

    this.activeQuiz = JSON.parse(JSON.stringify(quiz));
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.markedForReview = new Set();

    // Set UI Header Info
    const arenaTitle = document.getElementById("arena-quiz-title");
    const arenaCat = document.getElementById("arena-quiz-category");
    if (arenaTitle) arenaTitle.textContent = quiz.title;
    if (arenaCat) arenaCat.textContent = quiz.category;

    // Start Timer
    this.timer.start(
      quiz.durationMinutes,
      (remSeconds, totalSeconds, formatted) => {
        const timeDisplay = document.getElementById("arena-timer-text");
        if (timeDisplay) timeDisplay.textContent = formatted;
      },
      () => {
        // Expired
        this.sound.playFail();
        this.showToast("Time is up! Submitting your test automatically...", "warning");
        this.submitQuiz(true);
      },
      () => {
        // Warning under 60 seconds
        const timerContainer = document.getElementById("arena-timer-box");
        if (timerContainer) timerContainer.classList.add("warning");
        this.sound.playTick();
        this.showToast("⚠️ Less than 1 minute remaining!", "warning");
      }
    );

    const timerBox = document.getElementById("arena-timer-box");
    if (timerBox) timerBox.classList.remove("warning");

    this.navigate("quiz-arena");
    this.renderCurrentQuestion();
    this.renderQuestionPalette();
  }

  bindQuizEvents() {
    // Previous Question
    const btnPrev = document.getElementById("btn-quiz-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => this.prevQuestion());
    }

    // Next Question
    const btnNext = document.getElementById("btn-quiz-next");
    if (btnNext) {
      btnNext.addEventListener("click", () => this.nextQuestion());
    }

    // Mark for Review Toggle
    const btnReview = document.getElementById("btn-quiz-mark-review");
    if (btnReview) {
      btnReview.addEventListener("click", () => {
        this.sound.playClick();
        if (this.markedForReview.has(this.currentQuestionIndex)) {
          this.markedForReview.delete(this.currentQuestionIndex);
          this.showToast("Question unmarked from review", "info");
        } else {
          this.markedForReview.add(this.currentQuestionIndex);
          this.showToast("Question marked for review 🏷️", "info");
        }
        this.renderCurrentQuestion();
        this.renderQuestionPalette();
      });
    }

    // Clear Option Response
    const btnClear = document.getElementById("btn-quiz-clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        this.sound.playClick();
        delete this.userAnswers[this.currentQuestionIndex];
        this.renderCurrentQuestion();
        this.renderQuestionPalette();
      });
    }

    // Submit Quiz button click -> Open Confirmation Modal
    const btnSubmit = document.getElementById("btn-quiz-submit");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => {
        this.openSubmitConfirmModal();
      });
    }

    // Top Navbar End Test Button
    const btnNavEnd = document.getElementById("btn-nav-end-test");
    if (btnNavEnd) {
      btnNavEnd.addEventListener("click", () => {
        this.sound.playClick();
        this.openSubmitConfirmModal();
      });
    }

    // Arena Header End Test Button
    const btnArenaEnd = document.getElementById("btn-arena-end-test");
    if (btnArenaEnd) {
      btnArenaEnd.addEventListener("click", () => {
        this.sound.playClick();
        this.openSubmitConfirmModal();
      });
    }

    // Confirm Submit in Modal
    const btnConfirmSubmit = document.getElementById("btn-confirm-final-submit");
    if (btnConfirmSubmit) {
      btnConfirmSubmit.addEventListener("click", () => {
        const modal = document.getElementById("modal-submit-confirm");
        if (modal) modal.classList.remove("open");
        this.submitQuiz(false);
      });
    }

    // Quit Test Without Saving Button
    const btnQuitNoSave = document.getElementById("btn-quit-test-no-save");
    if (btnQuitNoSave) {
      btnQuitNoSave.addEventListener("click", () => {
        if (confirm("Are you sure you want to quit the test? Your current progress will be lost and no score will be recorded.")) {
          this.timer.stop();
          this.activeQuiz = null;
          document.getElementById("modal-submit-confirm").classList.remove("open");
          this.sound.playClick();
          this.showToast("Test cancelled. Returned to dashboard.", "info");
          this.navigate("dashboard");
        }
      });
    }

    // Keyboard Shortcuts (1, 2, 3, 4 for options; Left/Right arrows for nav)
    window.addEventListener("keydown", (e) => {
      if (this.currentView !== "quiz-arena" || !this.activeQuiz) return;

      // Don't intercept if an input is focused
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

      const q = this.activeQuiz.questions[this.currentQuestionIndex];
      if (!q) return;

      if (["1", "2", "3", "4"].includes(e.key)) {
        const optIndex = parseInt(e.key) - 1;
        if (q.options[optIndex] !== undefined) {
          this.selectOption(optIndex);
        }
      } else if (e.key === "ArrowRight") {
        this.nextQuestion();
      } else if (e.key === "ArrowLeft") {
        this.prevQuestion();
      }
    });
  }

  nextQuestion() {
    if (!this.activeQuiz || !this.activeQuiz.questions) return;
    const totalQ = this.activeQuiz.questions.length;
    if (this.currentQuestionIndex < totalQ - 1) {
      this.sound.playClick();
      this.currentQuestionIndex++;
      this.renderCurrentQuestion();
      this.renderQuestionPalette();
    } else {
      this.openSubmitConfirmModal();
    }
  }

  prevQuestion() {
    if (!this.activeQuiz) return;
    if (this.currentQuestionIndex > 0) {
      this.sound.playClick();
      this.currentQuestionIndex--;
      this.renderCurrentQuestion();
      this.renderQuestionPalette();
    }
  }

  renderCurrentQuestion() {
    if (!this.activeQuiz || !this.activeQuiz.questions) return;
    const q = this.activeQuiz.questions[this.currentQuestionIndex];
    const totalQ = this.activeQuiz.questions.length;

    // Counter & Marks
    const elCounter = document.getElementById("arena-q-counter");
    const elMarks = document.getElementById("arena-q-marks");
    const elText = document.getElementById("arena-q-text");
    const elProgressBar = document.getElementById("arena-progress-fill");

    if (elCounter) elCounter.textContent = `Question ${this.currentQuestionIndex + 1} of ${totalQ}`;
    if (elMarks) elMarks.textContent = `+${q.marks || 2} Marks`;
    if (elText) elText.textContent = q.question;

    // Update Progress bar
    const progressPct = ((this.currentQuestionIndex + 1) / totalQ) * 100;
    if (elProgressBar) elProgressBar.style.width = `${progressPct}%`;

    // Render Options List
    const optionsContainer = document.getElementById("arena-options-list");
    if (optionsContainer) {
      const selectedIndex = this.userAnswers[this.currentQuestionIndex];

      optionsContainer.innerHTML = q.options.map((optText, idx) => {
        const isSelected = selectedIndex === idx;
        const letter = String.fromCharCode(65 + idx); // A, B, C, D

        return `
          <div class="option-item ${isSelected ? 'selected' : ''}" onclick="window.app.selectOption(${idx})">
            <div class="option-index-badge">${letter}</div>
            <div class="option-label-text">${this.escapeHtml(optText)}</div>
            <span style="font-size: 0.75rem; color: var(--text-muted); opacity: 0.7;">[Key ${idx + 1}]</span>
          </div>
        `;
      }).join("");
    }

    // Toggle button states
    const btnPrev = document.getElementById("btn-quiz-prev");
    const btnNext = document.getElementById("btn-quiz-next");
    const btnReview = document.getElementById("btn-quiz-mark-review");

    if (btnPrev) btnPrev.disabled = this.currentQuestionIndex === 0;
    if (btnNext) {
      btnNext.textContent = (this.currentQuestionIndex === totalQ - 1) ? "Review & Submit 🏁" : "Next Question →";
    }

    if (btnReview) {
      const isMarked = this.markedForReview.has(this.currentQuestionIndex);
      btnReview.textContent = isMarked ? "🏷️ Unmark Review" : "🏷️ Mark Review";
      btnReview.classList.toggle("btn-warning", isMarked);
    }
  }

  selectOption(optionIndex) {
    this.sound.playSelect();
    this.userAnswers[this.currentQuestionIndex] = optionIndex;
    this.renderCurrentQuestion();
    this.renderQuestionPalette();
  }

  renderQuestionPalette() {
    const paletteGrid = document.getElementById("arena-palette-grid");
    if (!paletteGrid || !this.activeQuiz) return;

    const totalQ = this.activeQuiz.questions.length;
    let answeredCount = 0;

    let buttonsHTML = "";
    for (let i = 0; i < totalQ; i++) {
      const isCurrent = i === this.currentQuestionIndex;
      const isAnswered = this.userAnswers[i] !== undefined;
      const isMarked = this.markedForReview.has(i);

      if (isAnswered) answeredCount++;

      let statusClass = "";
      if (isAnswered) statusClass = "answered";
      if (isMarked) statusClass = "marked";
      if (isCurrent) statusClass += " current";

      buttonsHTML += `
        <button class="palette-btn ${statusClass}" onclick="window.app.jumpToQuestion(${i})">
          ${i + 1}
        </button>
      `;
    }

    paletteGrid.innerHTML = buttonsHTML;

    // Update Palette Summary
    const elSummary = document.getElementById("arena-palette-summary");
    if (elSummary) {
      elSummary.textContent = `${answeredCount} of ${totalQ} Answered`;
    }
  }

  jumpToQuestion(index) {
    if (this.activeQuiz && index >= 0 && index < this.activeQuiz.questions.length) {
      this.sound.playClick();
      this.currentQuestionIndex = index;
      this.renderCurrentQuestion();
      this.renderQuestionPalette();
    }
  }

  openSubmitConfirmModal() {
    if (!this.activeQuiz) return;
    const totalQ = this.activeQuiz.questions.length;
    const answeredCount = Object.keys(this.userAnswers).length;
    const unansweredCount = totalQ - answeredCount;
    const markedCount = this.markedForReview.size;

    document.getElementById("submit-modal-total").textContent = totalQ;
    document.getElementById("submit-modal-answered").textContent = answeredCount;
    document.getElementById("submit-modal-unanswered").textContent = unansweredCount;
    document.getElementById("submit-modal-marked").textContent = markedCount;

    document.getElementById("modal-submit-confirm").classList.add("open");
  }

  // --- QUIZ SUBMISSION & RESULTS COMPUTATION ---
  submitQuiz(autoSubmit = false) {
    this.timer.stop();

    if (!this.activeQuiz) return;
    const user = this.auth.getCurrentUser();
    const questions = this.activeQuiz.questions;
    const timeSpentSeconds = this.timer.getTimeSpentSeconds();

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const detailedQuestionsReview = questions.map((q, idx) => {
      const userChoice = this.userAnswers[idx];
      const isAnswered = userChoice !== undefined;
      const isCorrect = isAnswered && userChoice === q.correctAnswer;
      const qMarks = q.marks || 2;

      totalMarks += qMarks;

      if (isAnswered) {
        if (isCorrect) {
          score += qMarks;
          correctCount++;
        } else {
          wrongCount++;
        }
      } else {
        unansweredCount++;
      }

      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userChoice: isAnswered ? userChoice : null,
        isCorrect,
        isAnswered,
        marks: qMarks,
        explanation: q.explanation || "No explanation provided."
      };
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passPercentage = this.activeQuiz.passPercentage || 60;
    const passed = percentage >= passPercentage;

    const attemptRecord = {
      id: "att_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      userId: user ? user.id : "guest",
      userName: user ? user.name : "Guest Scholar",
      userAvatar: user ? user.avatar : "🎓",
      quizId: this.activeQuiz.id,
      quizTitle: this.activeQuiz.title,
      category: this.activeQuiz.category,
      score,
      totalMarks,
      percentage,
      passed,
      passPercentage,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      unansweredCount,
      timeSpentSeconds,
      completedAt: new Date().toISOString(),
      questionsReview: detailedQuestionsReview
    };

    // Save attempt to storage
    this.storage.saveAttempt(attemptRecord);
    this.lastResultData = attemptRecord;

    // Send attempt to Express Backend & MongoDB Atlas
    if (window.apiService && user) {
      window.apiService.attempts.submit({
        quizId: this.activeQuiz.id,
        userAnswers: this.userAnswers,
        timeSpentSeconds
      }).then(res => {
        if (res && res.attempt) {
          console.log("✅ Attempt saved to MongoDB Atlas:", res.attempt.id);
        }
      }).catch(err => {
        console.warn("MongoDB sync attempt notice:", err.message);
      });
    }

    // Render Results View
    this.renderResultView(attemptRecord);

    if (passed) {
      this.sound.playSuccess();
      this.confetti.fire(3500, 140);
    } else {
      this.sound.playFail();
    }

    this.navigate("results");
  }

  renderResultView(data) {
    const elStatusBadge = document.getElementById("res-status-badge");
    const elTitle = document.getElementById("res-title");
    const elFeedback = document.getElementById("res-feedback");
    const elScorePct = document.getElementById("res-score-percentage");
    const elFraction = document.getElementById("res-score-fraction");
    const elCircleProg = document.getElementById("res-circle-progress");

    const elTotalQ = document.getElementById("res-stat-total-q");
    const elCorrect = document.getElementById("res-stat-correct");
    const elWrong = document.getElementById("res-stat-wrong");
    const elAccuracy = document.getElementById("res-stat-accuracy");
    const elTimeSpent = document.getElementById("res-stat-time");
    const btnCertificate = document.getElementById("btn-download-certificate");

    if (elStatusBadge) {
      elStatusBadge.className = `badge ${data.passed ? 'badge-success' : 'badge-danger'} badge-lg`;
      elStatusBadge.textContent = data.passed ? "PASSED 🎉" : "NEEDS IMPROVEMENT ✍️";
    }

    if (elTitle) {
      elTitle.textContent = data.passed ? "Congratulations on Completing the Quiz!" : "Quiz Completed!";
    }

    if (elFeedback) {
      if (data.percentage >= 90) {
        elFeedback.textContent = "Outstanding mastery! You performed with near flawless accuracy.";
      } else if (data.passed) {
        elFeedback.textContent = "Great job! You met the passing criteria with solid competence.";
      } else {
        elFeedback.textContent = `You scored ${data.percentage}%. The passing benchmark is ${data.passPercentage}%. Review the solutions below and try again!`;
      }
    }

    if (elScorePct) elScorePct.textContent = `${data.percentage}%`;
    if (elFraction) elFraction.textContent = `${data.score} / ${data.totalMarks} Marks`;

    // Calculate strokeDashoffset for SVG circle (r=70, circumference=439.82)
    const circumference = 2 * Math.PI * 70;
    const offset = circumference - (data.percentage / 100) * circumference;
    if (elCircleProg) {
      elCircleProg.style.strokeDasharray = `${circumference}`;
      elCircleProg.style.strokeDashoffset = `${circumference}`;
      setTimeout(() => {
        elCircleProg.style.strokeDashoffset = `${offset}`;
        elCircleProg.style.stroke = data.passed ? 'var(--success)' : 'var(--danger)';
      }, 100);
    }

    if (elTotalQ) elTotalQ.textContent = data.totalQuestions;
    if (elCorrect) elCorrect.textContent = data.correctCount;
    if (elWrong) elWrong.textContent = data.wrongCount;
    if (elAccuracy) elAccuracy.textContent = `${data.percentage}%`;

    const mins = Math.floor(data.timeSpentSeconds / 60);
    const secs = data.timeSpentSeconds % 60;
    if (elTimeSpent) elTimeSpent.textContent = `${mins}m ${secs}s`;

    // Show/Hide Certificate button based on Pass status
    if (btnCertificate) {
      btnCertificate.style.display = data.passed ? "inline-flex" : "none";
      btnCertificate.onclick = () => this.generateAndDownloadCertificate(data);
    }

    // Render Answer Review Section
    this.renderAnswersReview(data.questionsReview);
  }

  renderAnswersReview(reviews) {
    const container = document.getElementById("res-review-container");
    if (!container || !reviews) return;

    container.innerHTML = reviews.map((q, idx) => {
      let statusClass = "unanswered";
      let statusBadge = `<span class="badge badge-warning">Skipped</span>`;

      if (q.isAnswered) {
        if (q.isCorrect) {
          statusClass = "correct";
          statusBadge = `<span class="badge badge-success">Correct (+${q.marks})</span>`;
        } else {
          statusClass = "wrong";
          statusBadge = `<span class="badge badge-danger">Incorrect (0)</span>`;
        }
      }

      return `
        <div class="review-card ${statusClass}">
          <div class="review-question-header">
            <strong>Question ${idx + 1}: ${this.escapeHtml(q.question)}</strong>
            ${statusBadge}
          </div>

          <div class="review-options-list">
            ${q.options.map((opt, oIdx) => {
              const isCorrectOpt = oIdx === q.correctAnswer;
              const isUserChoice = q.userChoice === oIdx;

              let optClass = "";
              let optNote = "";

              if (isCorrectOpt) {
                optClass = "correct-answer";
                optNote = "✓ Correct Answer";
              }
              if (isUserChoice && !isCorrectOpt) {
                optClass = "user-wrong-answer";
                optNote = "✗ Your Answer";
              }

              return `
                <div class="review-option ${optClass}">
                  <span><strong>${String.fromCharCode(65 + oIdx)}:</strong> ${this.escapeHtml(opt)}</span>
                  ${optNote ? `<strong style="font-size: 0.8rem;">${optNote}</strong>` : ''}
                </div>
              `;
            }).join("")}
          </div>

          <div class="explanation-box">
            💡 <strong>Explanation:</strong> ${this.escapeHtml(q.explanation)}
          </div>
        </div>
      `;
    }).join("");
  }

  generateAndDownloadCertificate(attemptData) {
    this.sound.playSuccess();
    this.showToast("Generating Certificate of Achievement...", "info");

    const canvas = window.CertificateGenerator.generate({
      studentName: attemptData.userName,
      quizTitle: attemptData.quizTitle,
      score: attemptData.score,
      totalMarks: attemptData.totalMarks,
      percentage: attemptData.percentage,
      date: attemptData.completedAt,
      certificateId: `CERT-${attemptData.id.slice(-6).toUpperCase()}`
    });

    window.CertificateGenerator.download(canvas, `certificate_${attemptData.userName.replace(/\s+/g, '_')}.png`);
    this.showToast("Certificate downloaded successfully! 🎓", "success");
  }

  // --- LEADERBOARD RENDERING ---
  renderLeaderboard() {
    const testCodeSelect = document.getElementById("lb-filter-testcode");
    if (testCodeSelect && (!this.lbTestCodesPopulated || testCodeSelect.children.length <= 1)) {
      const currentVal = testCodeSelect.value || "all";
      const quizzes = this.storage.getQuizzes();
      testCodeSelect.innerHTML = `<option value="all">🏷️ All Test Codes</option>` + quizzes.map(q => `
        <option value="${q.id}" ${currentVal === q.id ? 'selected' : ''}>🏷️ ${q.testCode || q.id} — ${this.escapeHtml(q.title)}</option>
      `).join("");
      this.lbTestCodesPopulated = true;
    }

    const filterCat = document.getElementById("lb-filter-category")?.value || "all";
    const filterCode = document.getElementById("lb-filter-testcode")?.value || "all";
    const leaderboard = this.storage.getLeaderboard(filterCat, filterCode);
    const currentUser = this.auth.getCurrentUser();

    // Podium (Top 3)
    const podiumEl = document.getElementById("lb-podium-section");
    const tableBody = document.getElementById("lb-table-tbody");

    const top1 = leaderboard[0];
    const top2 = leaderboard[1];
    const top3 = leaderboard[2];

    const isTop1User = top1 && currentUser && (top1.userId === currentUser.id || (currentUser.name && top1.userName.toLowerCase() === currentUser.name.toLowerCase()));
    const isTop2User = top2 && currentUser && (top2.userId === currentUser.id || (currentUser.name && top2.userName.toLowerCase() === currentUser.name.toLowerCase()));
    const isTop3User = top3 && currentUser && (top3.userId === currentUser.id || (currentUser.name && top3.userName.toLowerCase() === currentUser.name.toLowerCase()));

    if (podiumEl) {
      podiumEl.innerHTML = `
        ${top2 ? `
          <div class="podium-card second ${isTop2User ? 'is-current-user' : ''}">
            <div class="podium-rank-badge">2</div>
            <div class="podium-avatar">${top2.userAvatar || '🎓'}</div>
            <div class="podium-name">
              ${this.escapeHtml(top2.userName)}
              ${isTop2User ? '<span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-left: 0.2rem;">YOU</span>' : ''}
            </div>
            <div class="podium-score">${top2.totalScore} pts</div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${top2.avgPercentage}% Avg</span>
          </div>
        ` : ''}

        ${top1 ? `
          <div class="podium-card first ${isTop1User ? 'is-current-user' : ''}">
            <div class="podium-rank-badge">👑 1</div>
            <div class="podium-avatar">${top1.userAvatar || '🎓'}</div>
            <div class="podium-name">
              ${this.escapeHtml(top1.userName)}
              ${isTop1User ? '<span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-left: 0.2rem;">YOU</span>' : ''}
            </div>
            <div class="podium-score">${top1.totalScore} pts</div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${top1.avgPercentage}% Avg • ${top1.quizzesAttempted} Quizzes</span>
          </div>
        ` : ''}

        ${top3 ? `
          <div class="podium-card third ${isTop3User ? 'is-current-user' : ''}">
            <div class="podium-rank-badge">3</div>
            <div class="podium-avatar">${top3.userAvatar || '🎓'}</div>
            <div class="podium-name">
              ${this.escapeHtml(top3.userName)}
              ${isTop3User ? '<span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-left: 0.2rem;">YOU</span>' : ''}
            </div>
            <div class="podium-score">${top3.totalScore} pts</div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${top3.avgPercentage}% Avg</span>
          </div>
        ` : ''}
      `;
    }

    if (tableBody) {
      if (leaderboard.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No attempts recorded for this category or test code yet.</td></tr>`;
        return;
      }

      tableBody.innerHTML = leaderboard.map((u, idx) => {
        const isUser = currentUser && (u.userId === currentUser.id || (currentUser.name && u.userName.toLowerCase() === currentUser.name.toLowerCase()));

        return `
          <tr class="${isUser ? 'table-row-current-user' : ''}">
            <td><strong style="${isUser ? 'color: var(--primary); font-size: 1rem;' : ''}">#${idx + 1}</strong></td>
            <td>
              <div class="table-user-cell">
                <span class="table-user-avatar">${u.userAvatar || '🎓'}</span>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <strong>${this.escapeHtml(u.userName)}</strong>
                    ${isUser ? `<span class="badge badge-primary" style="font-size: 0.68rem; padding: 0.12rem 0.4rem; background: var(--primary); color: #ffffff;">YOU 👈</span>` : ''}
                  </div>
                  <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${this.escapeHtml(u.userEmail || '')}</span>
                </div>
              </div>
            </td>
            <td>${u.quizzesAttempted}</td>
            <td>${u.passedQuizzes}</td>
            <td><strong>${u.avgPercentage}%</strong></td>
            <td><span class="badge badge-primary" style="${isUser ? 'box-shadow: 0 0 10px var(--primary-glow);' : ''}">${u.totalScore} pts</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="window.app.openStudentDetailsModal('${u.userId}')">
                👤 Details
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  // --- STUDENT DETAILS MODAL ---
  openStudentDetailsModal(userId) {
    const leaderboard = this.storage.getLeaderboard("all");
    const student = leaderboard.find(u => u.userId === userId);
    const accountUser = this.storage.getUserById(userId);
    const attempts = this.storage.getAttemptsByUserId(userId);

    const name = student?.userName || accountUser?.name || "Student";
    const avatar = student?.userAvatar || accountUser?.avatar || "🎓";
    const email = student?.userEmail || accountUser?.email || "student@email.com";
    const role = (accountUser?.role === "admin" || student?.role === "admin") ? "Administrator ⚡" : "Student 🎓";

    const elAvatar = document.getElementById("stud-detail-avatar");
    const elName = document.getElementById("stud-detail-name");
    const elEmail = document.getElementById("stud-detail-email");
    const elRole = document.getElementById("stud-detail-role-badge");

    if (elAvatar) elAvatar.textContent = avatar;
    if (elName) elName.textContent = name;
    if (elEmail) elEmail.textContent = email;
    if (elRole) elRole.textContent = role;

    const elQuizzes = document.getElementById("stud-stat-quizzes");
    const elPassed = document.getElementById("stud-stat-passed");
    const elAvg = document.getElementById("stud-stat-avg");
    const elScore = document.getElementById("stud-stat-score");

    if (elQuizzes) elQuizzes.textContent = student ? student.quizzesAttempted : attempts.length;
    if (elPassed) elPassed.textContent = student ? student.passedQuizzes : attempts.filter(a => a.passed).length;
    if (elAvg) elAvg.textContent = `${student ? student.avgPercentage : 0}%`;
    if (elScore) elScore.textContent = `${student ? student.totalScore : 0} pts`;

    const attemptsTbody = document.getElementById("stud-detail-attempts-tbody");
    const currentUser = this.auth.getCurrentUser();
    const canReview = currentUser && (currentUser.role === "admin" || currentUser.id === userId);

    if (attemptsTbody) {
      if (attempts.length === 0) {
        attemptsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No attempts recorded for this student yet.</td></tr>`;
      } else {
        attemptsTbody.innerHTML = attempts.map(att => `
          <tr>
            <td><strong>${this.escapeHtml(att.quizTitle)}</strong></td>
            <td>${att.score}/${att.totalMarks} (${att.percentage}%)</td>
            <td>
              <span class="badge ${att.passed ? 'badge-success' : 'badge-danger'}" style="font-size: 0.72rem;">
                ${att.passed ? 'Passed ✓' : 'Failed ✗'}
              </span>
            </td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(att.completedAt).toLocaleDateString()}</td>
            <td>
              ${canReview ? `
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="window.app.viewAttemptDetails('${att.id}'); document.getElementById('modal-student-details').classList.remove('open');">
                  🔍 Review
                </button>
              ` : `
                <span style="font-size: 0.75rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.2rem;" title="Answers are private to this student">
                  🔒 Private
                </span>
              `}
            </td>
          </tr>
        `).join("");
      }
    }

    this.sound.playClick();
    document.getElementById("modal-student-details").classList.add("open");
  }

  // --- RESULT HISTORY RENDERING ---
  renderHistory() {
    const user = this.auth.getCurrentUser();
    if (!user) return;

    const isAdmin = user.role === "admin";
    const titleEl = document.getElementById("history-view-title");
    const subtitleEl = document.getElementById("history-view-subtitle");
    const tabControls = document.getElementById("history-tab-controls");
    const btnCreateQuiz = document.getElementById("btn-history-create-quiz");
    const thead = document.getElementById("history-table-thead");
    const tbody = document.getElementById("history-table-tbody");

    if (tabControls) tabControls.style.display = isAdmin ? "flex" : "none";
    if (btnCreateQuiz) btnCreateQuiz.style.display = isAdmin ? "inline-flex" : "none";

    let attempts = [];
    let isAllMode = isAdmin && this.historyAdminMode === "all";

    if (isAllMode) {
      attempts = this.storage.getAttempts();
      if (titleEl) titleEl.innerHTML = `Student Assessment Submissions 👥`;
      if (subtitleEl) subtitleEl.textContent = "View and inspect all student test submissions and scores.";

      if (thead) {
        thead.innerHTML = `
          <tr>
            <th>Student</th>
            <th>Quiz Title</th>
            <th>Category</th>
            <th>Score</th>
            <th>Status</th>
            <th>Date Taken</th>
            <th>Action</th>
          </tr>
        `;
      }

      if (!tbody) return;
      if (attempts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
              No student submissions found in the system.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = attempts.map(att => `
        <tr>
          <td>
            <div class="table-user-cell">
              <span class="table-user-avatar">${att.userAvatar || '🎓'}</span>
              <strong>${this.escapeHtml(att.userName)}</strong>
            </div>
          </td>
          <td><strong>${this.escapeHtml(att.quizTitle)}</strong></td>
          <td><span class="badge badge-primary">${this.escapeHtml(att.category)}</span></td>
          <td><strong>${att.score}/${att.totalMarks}</strong> (${att.percentage}%)</td>
          <td>
            <span class="badge ${att.passed ? 'badge-success' : 'badge-danger'}">
              ${att.passed ? 'Passed ✓' : 'Failed ✗'}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(att.completedAt).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.app.viewAttemptDetails('${att.id}')">
              🔍 Inspect
            </button>
          </td>
        </tr>
      `).join("");
    } else {
      attempts = this.storage.getAttemptsByUserId(user.id);
      if (titleEl) titleEl.innerHTML = `My Assessment History 📜`;
      if (subtitleEl) subtitleEl.textContent = "Track all your previous test submissions, scores, and performance history.";

      if (thead) {
        thead.innerHTML = `
          <tr>
            <th>Quiz Title</th>
            <th>Category</th>
            <th>Score</th>
            <th>Status</th>
            <th>Time Spent</th>
            <th>Date Taken</th>
            <th>Action</th>
          </tr>
        `;
      }

      if (!tbody) return;
      if (attempts.length === 0) {
        if (isAdmin) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; padding: 3rem 1.5rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📝</div>
                <h4 style="margin-bottom: 0.5rem; font-size: 1.1rem;">No Personal Test Attempts Yet</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 460px; margin: 0 auto 1.25rem;">
                  As an Administrator, you can create new custom tests or preview existing quizzes.
                </p>
                <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                  <button class="btn btn-primary btn-sm" onclick="if(window.adminController) window.adminController.openQuizModal()">+ Create New Quiz 📝</button>
                  <button class="btn btn-secondary btn-sm" onclick="window.app.navigate('dashboard')">Browse Quizzes 🚀</button>
                </div>
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; padding: 3rem 1.5rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🎓</div>
                <h4 style="margin-bottom: 0.5rem; font-size: 1.1rem;">No Quiz History Yet</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
                  You haven't taken any quizzes yet. Challenge your intellect to see your records here!
                </p>
                <button class="btn btn-primary btn-sm" onclick="window.app.navigate('dashboard')">Take Your First Quiz 🚀</button>
              </td>
            </tr>
          `;
        }
        return;
      }

      tbody.innerHTML = attempts.map(att => `
        <tr>
          <td>
            <strong>${this.escapeHtml(att.quizTitle)}</strong>
          </td>
          <td><span class="badge badge-primary">${this.escapeHtml(att.category)}</span></td>
          <td><strong>${att.score}/${att.totalMarks}</strong> (${att.percentage}%)</td>
          <td>
            <span class="badge ${att.passed ? 'badge-success' : 'badge-danger'}">
              ${att.passed ? 'Passed ✓' : 'Failed ✗'}
            </span>
          </td>
          <td>${Math.floor(att.timeSpentSeconds / 60)}m ${att.timeSpentSeconds % 60}s</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(att.completedAt).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.app.viewAttemptDetails('${att.id}')">
              🔍 Review
            </button>
          </td>
        </tr>
      `).join("");
    }
  }

  viewAttemptDetails(attemptId) {
    const attempt = this.storage.getAttemptById(attemptId);
    if (!attempt) return;

    const currentUser = this.auth.getCurrentUser();
    if (!currentUser) return;

    // Only allow admin or the owner of the attempt to inspect detailed answers
    if (currentUser.role !== "admin" && currentUser.id !== attempt.userId) {
      this.showToast("Detailed solution review is private to the student and educators.", "info");
      return;
    }

    this.lastResultData = attempt;
    this.renderResultView(attempt);
    this.navigate("results");
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = "info", duration = 3200) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠️",
      info: "ℹ️"
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '•'}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// Global Application Instance
window.addEventListener("DOMContentLoaded", () => {
  window.app = new AppController(
    window.storageService,
    window.authService,
    new window.QuizTimer(),
    window.soundEngine,
    window.confettiEngine
  );
  window.app.init();
});
