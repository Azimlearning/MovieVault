import { useState, useEffect, useRef } from "react";

const normalizeState = (state) => {
  if (state === null || state === undefined) {
    return { loading: false, error: null, empty: false };
  }
  if (typeof state === "string") {
    return {
      loading: state === "loading",
      error: state === "error" ? { code: "UNKNOWN_ERROR", message: "An error occurred" } : null,
      empty: state === "empty",
    };
  }
  return {
    loading: !!state.loading,
    error: state.error || null,
    empty: !!state.empty,
  };
};

export default function AsyncBoundary({
  state,
  onRetry,
  loadingComponent,
  emptyComponent,
  children,
}) {
  const { loading, error, empty } = normalizeState(state);
  const [attempts, setAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const getBackoffTime = (attempt) => {
    if (attempt === 1) return 1;
    if (attempt === 2) return 2;
    if (attempt === 3) return 5;
    return 0; // give up
  };

  useEffect(() => {
    // Reset state if error disappears (e.g. successful reload/nav)
    if (!error) {
      setAttempts(0);
      setCountdown(0);
    }
  }, [error]);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (countdown === 0 && attempts > 0 && attempts <= 3) {
      // Cooldown finished, automatically trigger retry
      onRetry?.();
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown, attempts, onRetry]);

  const handleRetryClick = () => {
    if (countdown > 0) return;
    const nextAttempt = attempts + 1;
    const backoff = getBackoffTime(nextAttempt);
    if (backoff > 0) {
      setAttempts(nextAttempt);
      setCountdown(backoff);
    } else {
      // Show give up state
      setAttempts(nextAttempt);
    }
  };

  if (loading) {
    if (loadingComponent) return loadingComponent;
    return (
      <div className="loader" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    const errorCode = error.code || "UNKNOWN_ERROR";
    const errorMessage = error.message || "An unexpected error occurred.";
    const isGivenUp = attempts > 3;

    return (
      <div
        className="empty-state fade-in"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px",
          gap: 16,
          background: "rgba(255, 255, 255, 0.01)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          margin: "24px",
        }}
      >
        <span style={{ fontSize: 48 }}>⚠️</span>
        <h3 style={{ margin: 0, fontSize: 20, color: "var(--text)" }}>Something went wrong</h3>
        <p style={{ margin: 0, color: "var(--text3)", fontSize: 13, maxWidth: 450, textAlign: "center", lineHeight: 1.5 }}>
          {errorMessage}
        </p>
        <div style={{ fontSize: 11, color: "var(--red)", background: "rgba(229, 9, 20, 0.06)", border: "1px solid rgba(229, 9, 20, 0.15)", padding: "4px 10px", borderRadius: 4, fontFamily: "monospace" }}>
          Code: {errorCode}
        </div>

        {isGivenUp ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
              Failed after multiple retry attempts. Please check your connection.
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setAttempts(0);
                setCountdown(0);
                onRetry?.();
              }}
            >
              Reset & Try Again
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleRetryClick}
            disabled={countdown > 0}
            style={{
              minWidth: 140,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 8,
              transition: "all 0.2s ease"
            }}
          >
            {countdown > 0 ? (
              <>
                <span className="apikey-spinner" style={{ width: 12, height: 12, borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.3)", borderTopColor: "#fff" }} />
                Retrying in {countdown}s...
              </>
            ) : (
              "Retry"
            )}
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    if (emptyComponent) return emptyComponent;
    return (
      <div className="empty-state fade-in">
        <span style={{ fontSize: 48 }}>📭</span>
        <h3>No content found</h3>
        <p>There is nothing to display here at the moment.</p>
      </div>
    );
  }

  return children;
}
