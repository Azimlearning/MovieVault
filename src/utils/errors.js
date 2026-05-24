export const ErrorCodes = {
  NETWORK_OFFLINE: "NETWORK_OFFLINE",
  TMDB_RATE_LIMIT: "TMDB_RATE_LIMIT",
  SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
  SCRAPER_PARSE_FAIL: "SCRAPER_PARSE_FAIL",
  FFMPEG_MISSING: "FFMPEG_MISSING",
  WYZIE_KEY_MISSING: "WYZIE_KEY_MISSING",
  IPC_ERROR: "IPC_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

/**
 * Creates a standardized error result object.
 * @param {string} code
 * @param {string} message
 * @param {boolean} [retryable=true]
 */
export const createError = (code, message, retryable = true) => ({
  ok: false,
  error: {
    code,
    message,
    retryable,
  },
});
