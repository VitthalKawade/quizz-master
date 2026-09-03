/**
 * Authentication Service
 * Handles user registration, login, logout, quick demo logins,
 * session maintenance, and role-based access checking.
 */
class AuthService {
  constructor(storage) {
    this.storage = storage;
    this.currentUser = this.storage.getSession();
  }

  getCurrentUser() {
    return this.storage.getSession();
  }

  isLoggedIn() {
    return !!this.getCurrentUser();
  }

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === "admin";
  }

  async register({ name, email, password, role = "student", avatar = "🎓" }) {
    if (!name || !name.trim()) {
      throw new Error("Please enter your full name.");
    }
    if (!email || !this.validateEmail(email)) {
      throw new Error("Please provide a valid email address.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 1. Send registration to Express Backend & MongoDB Atlas
    if (window.apiService) {
      try {
        const apiRes = await window.apiService.auth.register({
          name: cleanName,
          email: cleanEmail,
          password,
          role: role === "admin" ? "admin" : "student",
          avatar
        });
        if (apiRes && apiRes.user) {
          const userObj = {
            ...apiRes.user,
            password
          };
          this.storage.saveUser(userObj);
          this.storage.setSession(userObj);
          this.currentUser = this.storage.getSession();
          this.broadcastAuthChange();
          return this.currentUser;
        }
      } catch (apiErr) {
        console.warn("Backend registration sync notice:", apiErr.message);
        if (apiErr.message && apiErr.message.toLowerCase().includes("already exists")) {
          throw new Error("An account with this email address already exists.");
        }
      }
    }

    // Fallback to local storage
    const existing = this.storage.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error("An account with this email address already exists.");
    }

    const newUser = {
      id: "user_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name: cleanName,
      email: cleanEmail,
      password: password,
      role: role === "admin" ? "admin" : "student",
      avatar: avatar || "🎓",
      createdAt: new Date().toISOString()
    };

    this.storage.saveUser(newUser);
    this.storage.setSession(newUser);
    this.currentUser = this.storage.getSession();
    this.broadcastAuthChange();

    return this.currentUser;
  }

  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const cleanEmail = email.toLowerCase().trim();

    if (window.apiService) {
      try {
        const apiRes = await window.apiService.auth.login(cleanEmail, password);
        if (apiRes && apiRes.user) {
          const userObj = {
            ...apiRes.user,
            password
          };
          this.storage.saveUser(userObj);
          this.storage.setSession(userObj);
          this.currentUser = this.storage.getSession();
          this.broadcastAuthChange();
          return this.currentUser;
        }
      } catch (apiErr) {
        console.warn("Backend login sync notice:", apiErr.message);
        if (apiErr.message && (apiErr.message.includes("Invalid") || apiErr.message.includes("password"))) {
          throw new Error("Invalid email or password. Please try again.");
        }
      }
    }

    const user = this.storage.getUserByEmail(cleanEmail);
    if (!user || user.password !== password) {
      throw new Error("Invalid email or password. Please try again.");
    }

    this.storage.setSession(user);
    this.currentUser = this.storage.getSession();
    this.broadcastAuthChange();

    return this.currentUser;
  }

  demoLogin(role = "student") {
    const email = role === "admin" ? "admin@quiz.com" : "student@quiz.com";
    const user = this.storage.getUserByEmail(email);
    if (user) {
      this.storage.setSession(user);
      this.currentUser = this.storage.getSession();
      this.broadcastAuthChange();

      if (window.apiService) {
        window.apiService.auth.demo(role).catch(err => console.warn("Backend demo auth notice:", err.message));
      }

      return this.currentUser;
    } else {
      throw new Error("Demo user not found. Reset the database to restore demo accounts.");
    }
  }

  async googleLogin({ email, name, avatar = "🎓", role = "student" }) {
    if (!email || !this.validateEmail(email)) {
      throw new Error("Please provide a valid Google/Gmail address.");
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = this.storage.getUserByEmail(cleanEmail);

    if (window.apiService) {
      try {
        const apiRes = await window.apiService.auth.google({
          email: cleanEmail,
          name: name && name.trim() ? name.trim() : cleanEmail.split("@")[0],
          avatar: avatar || "🎓",
          role: role === "admin" ? "admin" : "student"
        });
        if (apiRes && apiRes.user) {
          user = apiRes.user;
          this.storage.saveUser(user);
          this.storage.setSession(user);
          this.currentUser = this.storage.getSession();
          this.broadcastAuthChange();
          return this.currentUser;
        }
      } catch (apiErr) {
        console.warn("Backend Google auth notice:", apiErr.message);
      }
    }

    if (!user) {
      const cleanName = name && name.trim() ? name.trim() : cleanEmail.split("@")[0];
      user = {
        id: "user_google_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        name: cleanName,
        email: cleanEmail,
        password: `google_oauth_${Date.now()}`,
        role: role === "admin" ? "admin" : "student",
        avatar: avatar || "🎓",
        isGoogleAuth: true,
        createdAt: new Date().toISOString()
      };
      this.storage.saveUser(user);
    } else {
      if (name && name.trim()) user.name = name.trim();
      if (avatar) user.avatar = avatar;
      this.storage.updateUser(user.id, { name: user.name, avatar: user.avatar });
    }

    this.storage.setSession(user);
    this.currentUser = this.storage.getSession();
    this.broadcastAuthChange();

    return this.currentUser;
  }

  logout() {
    this.storage.clearSession();
    this.currentUser = null;
    this.broadcastAuthChange();
  }

  updateProfile({ name, email, avatar, currentPassword, newPassword }) {
    const currentSession = this.getCurrentUser();
    if (!currentSession) {
      throw new Error("No active user session found. Please login again.");
    }

    const user = this.storage.getUserById(currentSession.id);
    if (!user) {
      throw new Error("User account could not be found.");
    }

    if (!name || !name.trim()) {
      throw new Error("Please enter your full name.");
    }

    if (!email || !this.validateEmail(email)) {
      throw new Error("Please enter a valid email address.");
    }

    // Check email uniqueness if email changed
    const existingWithEmail = this.storage.getUserByEmail(email);
    if (existingWithEmail && existingWithEmail.id !== user.id) {
      throw new Error("This email address is already registered to another account.");
    }

    // Handle password change if specified
    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters long.");
      }
      if (currentPassword && user.password !== currentPassword) {
        throw new Error("The current password you entered is incorrect.");
      }
      user.password = newPassword;
    }

    user.name = name.trim();
    user.email = email.toLowerCase().trim();
    if (avatar) user.avatar = avatar;
    user.updatedAt = new Date().toISOString();

    // Persist updated user
    this.storage.saveUser(user);
    this.storage.setSession(user);
    this.currentUser = this.storage.getSession();

    // Update student's name/avatar across historical attempts
    this.storage.updateUserAttemptsMetadata(user.id, user.name, user.avatar);

    this.broadcastAuthChange();
    return this.currentUser;
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  broadcastAuthChange() {
    const event = new CustomEvent("auth:change", {
      detail: {
        user: this.getCurrentUser(),
        isLoggedIn: this.isLoggedIn(),
        isAdmin: this.isAdmin()
      }
    });
    window.dispatchEvent(event);
  }
}

window.authService = new AuthService(window.storageService);
