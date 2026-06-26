package ratelimit

import (
	"sync"
	"time"
)

// entry tracks failed login attempts within a time window.
type entry struct {
	count    int
	windowStart time.Time
}

// Limiter provides in-memory rate limiting keyed by a string (email or IP).
type Limiter struct {
	mu       sync.Mutex
	entries  map[string]*entry
	maxAttempts int
	window      time.Duration
}

// NewLimiter creates a rate limiter that allows maxAttempts per window.
func NewLimiter(maxAttempts int, window time.Duration) *Limiter {
	return &Limiter{
		entries:     make(map[string]*entry),
		maxAttempts: maxAttempts,
		window:      window,
	}
}

// Allow returns true if the request is allowed. If not, it returns the
// number of seconds until the window resets.
func (l *Limiter) Allow(key string) (allowed bool, retryAfter int) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	e, exists := l.entries[key]

	if !exists || now.Sub(e.windowStart) > l.window {
		// First attempt or window expired — reset.
		l.entries[key] = &entry{count: 1, windowStart: now}
		return true, 0
	}

	e.count++
	if e.count <= l.maxAttempts {
		return true, 0
	}

	// Over limit — calculate retry after.
	remaining := l.window - now.Sub(e.windowStart)
	if remaining < 0 {
		remaining = 0
	}
	return false, int(remaining.Seconds())
}

// DebugCount returns the current count for a key (test helper).
func (l *Limiter) DebugCount(key string) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	e, ok := l.entries[key]
	if !ok {
		return 0
	}
	return e.count
}

// Reset clears the counter for a key (e.g., after successful login).
func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

// Cleanup removes expired entries. Call periodically.
func (l *Limiter) Cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for k, e := range l.entries {
		if now.Sub(e.windowStart) > l.window {
			delete(l.entries, k)
		}
	}
}
