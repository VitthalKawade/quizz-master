/**
 * QuizzMaster Pro - Client API Service
 * Communicates with the Node.js / Express REST API backend.
 */
class ApiService {
  constructor() {
    this.baseUrl = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? `${window.location.origin}/api`
      : '/api';
    this.TOKEN_KEY = 'quizzmaster_jwt_token';
  }

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`[API] ${options.method || 'GET'} ${endpoint} failed:`, err.message);
      throw err;
    }
  }

  async isOnline() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // --- AUTH ENDPOINTS ---
  auth = {
    register: async (payload) => {
      const data = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (data.token) this.setToken(data.token);
      return data;
    },

    login: async (email, password) => {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.token) this.setToken(data.token);
      return data;
    },

    demo: async (role = 'student') => {
      const data = await this.request('/auth/demo', {
        method: 'POST',
        body: JSON.stringify({ role })
      });
      if (data.token) this.setToken(data.token);
      return data;
    },

    google: async ({ email, name, avatar, role, googleId }) => {
      const data = await this.request('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ email, name, avatar, role, googleId })
      });
      if (data.token) this.setToken(data.token);
      return data;
    },

    me: async () => {
      return await this.request('/auth/me');
    },

    updateProfile: async (payload) => {
      const data = await this.request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (data.token) this.setToken(data.token);
      return data;
    },

    logout: () => {
      this.clearToken();
    }
  };

  // --- QUIZZES ENDPOINTS ---
  quizzes = {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/quizzes${query ? '?' + query : ''}`);
    },

    getById: async (id) => {
      return await this.request(`/quizzes/${id}`);
    },

    unlock: async (id, password) => {
      return await this.request(`/quizzes/${id}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ password })
      });
    },

    create: async (quizData) => {
      return await this.request('/quizzes', {
        method: 'POST',
        body: JSON.stringify(quizData)
      });
    },

    update: async (id, quizData) => {
      return await this.request(`/quizzes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(quizData)
      });
    },

    delete: async (id) => {
      return await this.request(`/quizzes/${id}`, {
        method: 'DELETE'
      });
    }
  };

  // --- QUESTIONS ENDPOINTS ---
  questions = {
    getAll: async (quizId) => {
      return await this.request(`/quizzes/${quizId}/questions`);
    },

    create: async (quizId, questionData) => {
      return await this.request(`/quizzes/${quizId}/questions`, {
        method: 'POST',
        body: JSON.stringify(questionData)
      });
    },

    update: async (quizId, index, questionData) => {
      return await this.request(`/quizzes/${quizId}/questions/${index}`, {
        method: 'PUT',
        body: JSON.stringify(questionData)
      });
    },

    delete: async (quizId, index) => {
      return await this.request(`/quizzes/${quizId}/questions/${index}`, {
        method: 'DELETE'
      });
    },

    bulkCreate: async (quizId, questions, mode = 'append') => {
      return await this.request(`/quizzes/${quizId}/questions/bulk`, {
        method: 'POST',
        body: JSON.stringify({ questions, mode })
      });
    }
  };

  // --- ATTEMPTS & SUBMISSIONS ENDPOINTS ---
  attempts = {
    submit: async (quizId, userAnswers, timeSpentSeconds) => {
      return await this.request('/attempts', {
        method: 'POST',
        body: JSON.stringify({ quizId, userAnswers, timeSpentSeconds })
      });
    },

    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/attempts${query ? '?' + query : ''}`);
    },

    getById: async (id) => {
      return await this.request(`/attempts/${id}`);
    }
  };

  // --- LEADERBOARD ENDPOINTS ---
  leaderboard = {
    get: async (category = 'all') => {
      return await this.request(`/leaderboard?category=${encodeURIComponent(category)}`);
    }
  };

  // --- ADMIN ENDPOINTS ---
  admin = {
    getMetrics: async () => {
      return await this.request('/admin/metrics');
    },

    exportDb: async () => {
      return await this.request('/admin/export');
    },

    exportSubmissionsCsv: async () => {
      return await this.request('/admin/submissions/export-csv');
    },

    importDb: async (data) => {
      return await this.request('/admin/import', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    resetDb: async () => {
      return await this.request('/admin/reset', {
        method: 'POST'
      });
    }
  };
}

// Global API instance
window.apiService = new ApiService();
