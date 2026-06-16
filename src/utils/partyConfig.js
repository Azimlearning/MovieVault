const isDev = typeof window !== "undefined" && window.location.href.includes("localhost:");

const RELAY_HOST = isDev ? "localhost:3000" : "movievault-party.up.railway.app";
const SECURE = !isDev;

export const PARTY_HTTP = `${SECURE ? "https" : "http"}://${RELAY_HOST}`;
export const PARTY_WS   = `${SECURE ? "wss"   : "ws"}://${RELAY_HOST}`;
export const GUEST_APP_ORIGIN = "https://movievault-party.vercel.app";
