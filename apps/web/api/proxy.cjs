const https = require("https");
const http = require("http");

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range,Accept,Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { url, referer } = req.query;

  if (!url) {
    return res.status(400).end("Missing url parameter");
  }

  try {
    const targetUrl = new URL(url);
    const lib = targetUrl.protocol === "https:" ? https : http;
    const currentVideoReferer = referer || "https://allmanga.to";

    const proxyReq = lib.request(
      {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method || "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: currentVideoReferer,
          Range: req.headers["range"] || "",
          Accept: "*/*",
        },
      },
      (proxyRes) => {
        // Forward essential headers
        const passHeaders = {};
        for (const h of [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "last-modified",
          "etag",
        ]) {
          if (proxyRes.headers[h]) {
            passHeaders[h] = proxyRes.headers[h];
          }
        }

        passHeaders["Access-Control-Allow-Origin"] = "*";
        passHeaders["Cache-Control"] = "no-store";

        res.writeHead(proxyRes.statusCode, passHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.error("Proxy request error:", err);
      res.status(502).end();
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).end(err.message);
  }
};
