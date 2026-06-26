package ratelimit

import (
	"testing"
	"time"
)

func TestLimiter_AllowsUpToMax(t *testing.T) {
	l := NewLimiter(5, 15*time.Minute)

	for i := 0; i < 5; i++ {
		allowed, _ := l.Allow("test-key")
		if !allowed {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
	}
}

func TestLimiter_BlocksAfterMax(t *testing.T) {
	l := NewLimiter(5, 15*time.Minute)

	for i := 0; i < 5; i++ {
		l.Allow("test-key")
	}

	allowed, retryAfter := l.Allow("test-key")
	if allowed {
		t.Fatal("6th attempt should be blocked")
	}
	if retryAfter <= 0 {
		t.Errorf("retryAfter should be > 0, got %d", retryAfter)
	}
}

func TestLimiter_ResetClears(t *testing.T) {
	l := NewLimiter(2, 15*time.Minute)

	l.Allow("test-key")
	l.Allow("test-key")

	allowed, _ := l.Allow("test-key")
	if allowed {
		t.Fatal("3rd attempt should be blocked before reset")
	}

	l.Reset("test-key")

	allowed, _ = l.Allow("test-key")
	if !allowed {
		t.Fatal("should be allowed after reset")
	}
}

func TestLimiter_SeparateKeys(t *testing.T) {
	l := NewLimiter(1, 15*time.Minute)

	l.Allow("key-a")

	// key-a should be blocked
	allowed, _ := l.Allow("key-a")
	if allowed {
		t.Fatal("key-a should be blocked")
	}

	// key-b should still be allowed
	allowed, _ = l.Allow("key-b")
	if !allowed {
		t.Fatal("key-b should be allowed")
	}
}

func TestLimiter_WindowExpiry(t *testing.T) {
	// Use a very short window for testing.
	l := NewLimiter(2, 10*time.Millisecond)

	l.Allow("test-key")
	l.Allow("test-key")

	allowed, _ := l.Allow("test-key")
	if allowed {
		t.Fatal("3rd attempt should be blocked")
	}

	time.Sleep(15 * time.Millisecond)

	// Window should have expired.
	allowed, _ = l.Allow("test-key")
	if !allowed {
		t.Fatal("should be allowed after window expiry")
	}
}
