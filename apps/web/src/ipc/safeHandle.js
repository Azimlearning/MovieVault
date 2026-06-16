const { ipcMain } = require("electron");

/**
 * Standardizes an IPC handler to prevent unhandled exceptions across the IPC boundary.
 * Wraps results in `{ ok: true, data }` or `{ ok: false, error }`.
 * Retains compatibility with handlers that already return `{ ok: true, ... }` or `{ ok: false, error: ... }`.
 *
 * @param {string} channel
 * @param {Function} handler
 */
function safeHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await handler(event, ...args);

      // If the result is already in some format containing { ok: ... }
      if (result && typeof result === "object" && "ok" in result) {
        // If it already matches the exact target format:
        if ("data" in result || "error" in result) {
          if (result.ok && !("data" in result)) {
            // Already standard ok structure, but let's make sure data is present
            const { ok, ...rest } = result;
            return { ok: true, data: rest, ...rest };
          }
          return result;
        }

        // If it has ok property but custom fields, wrap them into data while preserving top level
        if (result.ok) {
          const { ok, ...rest } = result;
          return { ok: true, data: rest, ...rest };
        } else {
          // If it failed and has custom error fields:
          const errMsg = typeof result.error === "string" ? result.error : (result.error?.message || "An IPC error occurred");
          const errCode = result.error?.code || "IPC_ERROR";
          const retryable = result.error?.retryable !== false;
          return {
            ok: false,
            error: {
              code: errCode,
              message: errMsg,
              retryable,
            },
            ...result,
          };
        }
      }

      // Standard raw success wrapping
      return { ok: true, data: result };
    } catch (err) {
      console.error(`[IPC Error] ${channel}:`, err);
      return {
        ok: false,
        error: {
          code: err.code || "IPC_ERROR",
          message: err.message || "An IPC error occurred",
          retryable: err.retryable !== false,
        },
      };
    }
  });
}

module.exports = { safeHandle };
