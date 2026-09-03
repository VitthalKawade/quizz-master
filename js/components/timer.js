/**
 * Quiz Countdown Timer Component
 * High-accuracy timer calculating real-time deltas to avoid browser tab drift.
 */
class QuizTimer {
  constructor() {
    this.intervalId = null;
    this.totalSeconds = 0;
    this.remainingSeconds = 0;
    this.startTime = null;
    this.paused = false;
    this.onTickCallback = null;
    this.onExpireCallback = null;
    this.onWarningCallback = null;
    this.hasWarned = false;
  }

  start(durationMinutes, onTick, onExpire, onWarning) {
    this.stop();
    this.totalSeconds = Math.max(1, Math.round(durationMinutes * 60));
    this.remainingSeconds = this.totalSeconds;
    this.onTickCallback = onTick;
    this.onExpireCallback = onExpire;
    this.onWarningCallback = onWarning;
    this.hasWarned = false;
    this.paused = false;
    this.startTime = Date.now();

    // Trigger initial tick immediately
    if (this.onTickCallback) {
      this.onTickCallback(this.remainingSeconds, this.totalSeconds, this.formatTime(this.remainingSeconds));
    }

    this.intervalId = setInterval(() => {
      if (this.paused) return;

      this.remainingSeconds--;

      if (this.onTickCallback) {
        this.onTickCallback(this.remainingSeconds, this.totalSeconds, this.formatTime(this.remainingSeconds));
      }

      // Warning when <= 60 seconds remaining
      if (this.remainingSeconds <= 60 && !this.hasWarned) {
        this.hasWarned = true;
        if (this.onWarningCallback) {
          this.onWarningCallback(this.remainingSeconds);
        }
      }

      // Time expired
      if (this.remainingSeconds <= 0) {
        this.stop();
        if (this.onExpireCallback) {
          this.onExpireCallback();
        }
      }
    }, 1000);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getTimeSpentSeconds() {
    return Math.max(0, this.totalSeconds - this.remainingSeconds);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

window.QuizTimer = QuizTimer;
