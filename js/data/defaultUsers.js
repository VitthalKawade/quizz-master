/**
 * Default Users & Seed Records
 * Provides demo accounts for students and administrators,
 * along with mock leaderboard entries to make the platform interactive.
 */
const DEFAULT_USERS = [
  {
    id: "user_student_1",
    name: "Alex Johnson",
    email: "student@quiz.com",
    password: "student123",
    role: "student",
    avatar: "🎓",
    createdAt: "2026-08-20T10:00:00.000Z"
  },
  {
    id: "user_admin_1",
    name: "Dr. Sarah Mitchell",
    email: "admin@quiz.com",
    password: "admin123",
    role: "admin",
    avatar: "⚡",
    createdAt: "2026-08-15T08:30:00.000Z"
  }
];

const DEFAULT_ATTEMPTS = [
  {
    id: "att_1",
    userId: "user_student_1",
    userName: "Alex Johnson",
    userAvatar: "🎓",
    quizId: "quiz-java-core",
    quizTitle: "Java Programming Fundamentals",
    category: "Programming",
    score: 18,
    totalMarks: 20,
    percentage: 90,
    passed: true,
    totalQuestions: 10,
    correctCount: 9,
    wrongCount: 1,
    unansweredCount: 0,
    timeSpentSeconds: 420,
    completedAt: "2026-08-30T14:22:00.000Z"
  },
  {
    id: "att_2",
    userId: "user_seed_2",
    userName: "Emma Watson",
    userAvatar: "🌟",
    quizId: "quiz-java-core",
    quizTitle: "Java Programming Fundamentals",
    category: "Programming",
    score: 20,
    totalMarks: 20,
    percentage: 100,
    passed: true,
    totalQuestions: 10,
    correctCount: 10,
    wrongCount: 0,
    unansweredCount: 0,
    timeSpentSeconds: 380,
    completedAt: "2026-08-29T11:15:00.000Z"
  },
  {
    id: "att_3",
    userId: "user_seed_3",
    userName: "David Miller",
    userAvatar: "🚀",
    quizId: "quiz-general-knowledge",
    quizTitle: "World General Knowledge & Trivia",
    category: "General Knowledge",
    score: 16,
    totalMarks: 20,
    percentage: 80,
    passed: true,
    totalQuestions: 10,
    correctCount: 8,
    wrongCount: 2,
    unansweredCount: 0,
    timeSpentSeconds: 290,
    completedAt: "2026-08-30T09:40:00.000Z"
  },
  {
    id: "att_4",
    userId: "user_seed_4",
    userName: "Sophia Chen",
    userAvatar: "💡",
    quizId: "quiz-mathematics",
    quizTitle: "Mathematics & Quantitative Aptitude",
    category: "Mathematics",
    score: 20,
    totalMarks: 20,
    percentage: 100,
    passed: true,
    totalQuestions: 10,
    correctCount: 10,
    wrongCount: 0,
    unansweredCount: 0,
    timeSpentSeconds: 510,
    completedAt: "2026-08-30T16:05:00.000Z"
  },
  {
    id: "att_5",
    userId: "user_seed_5",
    userName: "Liam O'Connor",
    userAvatar: "🔥",
    quizId: "quiz-science",
    quizTitle: "General Science & Everyday Technology",
    category: "Science",
    score: 14,
    totalMarks: 20,
    percentage: 70,
    passed: true,
    totalQuestions: 10,
    correctCount: 7,
    wrongCount: 3,
    unansweredCount: 0,
    timeSpentSeconds: 340,
    completedAt: "2026-08-31T08:12:00.000Z"
  }
];

if (typeof window !== "undefined") {
  window.DEFAULT_USERS = DEFAULT_USERS;
  window.DEFAULT_ATTEMPTS = DEFAULT_ATTEMPTS;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_USERS, DEFAULT_ATTEMPTS };
}
