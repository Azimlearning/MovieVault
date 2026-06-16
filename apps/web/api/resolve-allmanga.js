const https = require("https");
const http = require("http");
const crypto = require("crypto");

// ── AllAnime hex cipher (from ani-cli) ──
const ALLANIME_HEX_MAP = {
  79: "A", "7a": "B", "7b": "C", "7c": "D", "7d": "E", "7e": "F", "7f": "G",
  70: "H", 71: "I", 72: "J", 73: "K", 74: "L", 75: "M", 76: "N", 77: "O",
  68: "P", 69: "Q", "6a": "R", "6b": "S", "6c": "T", "6d": "U", "6e": "V",
  "6f": "W", 60: "X", 61: "Y", 62: "Z", 42: "a", "5a": "b", "5b": "c",
  "5c": "d", "5d": "e", "5e": "f", "5f": "g", 50: "h", 51: "i", 52: "j",
  53: "k", 54: "l", 55: "m", 56: "n", 57: "o", 48: "p", 49: "q", "4a": "r",
  "4b": "s", "4c": "t", "4d": "u", "4e": "v", "4f": "w", 40: "x", 41: "y",
  42: "z", "08": "0", "09": "1", "0a": "2", "0b": "3", "0c": "4", "0d": "5",
  "0e": "6", "0f": "7", "00": "8", "01": "9", 15: "-", 16: ".", 67: "_",
  46: "~", "02": ":", 17: "/", "07": "?", "1b": "#", 63: "[", 65: "]",
  78: "@", 19: "!", "1c": "$", "1e": "&", 10: "(", 11: ")", 12: "*",
  13: "+", 14: ",", "03": ";", "05": "=", "1d": "%"
};

function decodeAllanimeUrl(encoded) {
  if (encoded.startsWith("--")) encoded = encoded.slice(2);
  let result = "";
  for (let i = 0; i < encoded.length; i += 2) {
    const pair = encoded.slice(i, i + 2);
    result += ALLANIME_HEX_MAP[pair] !== undefined ? ALLANIME_HEX_MAP[pair] : pair;
  }
  return result.replace(/\\u002F/gi, "/").replace(/\\\|/g, "");
}

// ── AllAnime AES-256-CTR decryption ──
const ALLANIME_KEY = crypto
  .createHash("sha256")
  .update("Xot36i3lK3:v1")
  .digest();

function decodeTobeparsed(blob) {
  try {
    const buf = Buffer.from(blob, "base64");
    const iv12 = buf.slice(1, 13);
    const iv16 = Buffer.concat([iv12, Buffer.from([0, 0, 0, 2])]);
    const ct = buf.slice(13, buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-ctr", ALLANIME_KEY, iv16);
    decipher.setAutoPadding(false);
    const plain = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString("utf8");
    const sources = [];
    for (const chunk of plain.split(/[{}]/)) {
      const urlMatch = chunk.match(/"sourceUrl"\s*:\s*"(--[^"]+)"/);
      const nameMatch = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/);
      const prioMatch = chunk.match(/"priority"\s*:\s*([0-9.]+)/);
      if (urlMatch) {
        sources.push({
          sourceUrl: urlMatch[1],
          sourceName: nameMatch ? nameMatch[1] : "",
          priority: prioMatch ? parseFloat(prioMatch[1]) : 0,
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

function parseEpisodeSourceUrls(body) {
  const tbMatch = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/);
  if (tbMatch) {
    const sources = decodeTobeparsed(tbMatch[1]);
    if (sources.length) return sources;
  }
  try {
    const sourceUrls = JSON.parse(body)?.data?.episode?.sourceUrls;
    return sourceUrls?.length ? sourceUrls : null;
  } catch {
    return null;
  }
}

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    function doGet(url) {
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Origin: "https://allmanga.to",
            Accept: "*/*",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const loc = res.headers.location.startsWith("http")
              ? res.headers.location
              : new URL(res.headers.location, url).href;
            res.resume();
            doGet(loc);
            return;
          }
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on("error", reject);
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    }
    doGet(urlStr);
  });
}

function followRedirects(urlStr, maxHops = 10) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function step(url) {
      if (++hops > maxHops) return resolve(url);
      let u;
      try {
        u = new URL(url);
      } catch {
        return reject(new Error("invalid url: " + url));
      }
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Accept: "*/*",
          },
        },
        (res) => {
          res.resume();
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const loc = res.headers.location.startsWith("http")
              ? res.headers.location
              : new URL(res.headers.location, url).href;
            step(loc);
          } else {
            resolve(url);
          }
        }
      );
      req.on("error", reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    }
    step(urlStr);
  });
}

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
const EPISODE_GQL_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

async function allanimeGQL(variables, query) {
  const body = JSON.stringify({ variables, query });
  const u = new URL("https://api.allanime.day/api");
  const res = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Origin: "https://allmanga.to",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(body);
    req.end();
  });
  return res;
}

async function allanimeGQLEpisode(variables) {
  try {
    const encodedVars = encodeURIComponent(JSON.stringify(variables));
    const extensions = JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH },
    });
    const encodedExt = encodeURIComponent(extensions);
    const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodedExt}`;

    const getRes = await new Promise((resolve, reject) => {
      const u = new URL(getUrl);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Origin: "https://youtu-chan.com",
            Accept: "*/*",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on("error", reject);
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    });

    if (getRes.body && getRes.body.includes("tobeparsed")) return getRes;
  } catch {}

  return allanimeGQL(variables, EPISODE_GQL);
}

const PROVIDER_PRIORITY = ["S-mp4", "Luf-Mp4", "Yt-mp4", "Default", "Sl-Hls"];

async function trySourceUrls(sourceUrls) {
  const decodedSources = sourceUrls
    .filter((s) => s.sourceUrl?.startsWith("--"))
    .map((s) => ({
      sourceName: s.sourceName || "",
      priority: s.priority || 0,
      path: decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json"),
    }))
    .sort((a, b) => {
      const ai = PROVIDER_PRIORITY.indexOf(a.sourceName);
      const bi = PROVIDER_PRIORITY.indexOf(b.sourceName);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  for (const src of decodedSources) {
    let fetchUrl = src.path;
    if (fetchUrl.startsWith("//")) fetchUrl = "https:" + fetchUrl;
    else if (fetchUrl.startsWith("/")) fetchUrl = "https://allanime.day" + fetchUrl;
    else if (!fetchUrl.startsWith("http")) fetchUrl = "https://allanime.day/" + fetchUrl;

    try {
      if (fetchUrl.includes("fast4speed.rsvp") || src.sourceName === "Yt-mp4") {
        const finalUrl = await followRedirects(fetchUrl).catch(() => null);
        if (!finalUrl) continue;
        if (/\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(finalUrl) || (!finalUrl.includes("youtube.com/watch") && !finalUrl.includes("youtu.be/"))) {
          return {
            url: finalUrl,
            sourceName: src.sourceName,
            isDirectMp4: !finalUrl.includes(".m3u8"),
          };
        }
        continue; // skip youtube page on serverless (yt-dlp binary isn't standard in vercel function containers)
      }

      const linkRes = await httpsGet(fetchUrl);
      if (linkRes.status !== 200 || !linkRes.body) continue;
      const linkJson = JSON.parse(linkRes.body);
      const links = linkJson?.links;
      if (!links?.length) continue;
      const allLinks = links.filter((l) => l.link);
      const mp4Links = allLinks.filter((l) => !l.link.includes(".m3u8") && !l.link.includes("master."));
      const best = (mp4Links.length ? mp4Links : allLinks).sort((a, b) => (parseInt(b.resolutionStr) || 0) - (parseInt(a.resolutionStr) || 0))[0];
      if (!best) continue;

      return {
        url: best.link,
        resolution: best.resolutionStr || "?",
        sourceName: src.sourceName,
        isDirectMp4: !best.link.includes(".m3u8"),
      };
    } catch {}
  }
  return null;
}

async function resolveEpisodeFromId(showId, epStr, dubSub) {
  const candidates = [epStr];
  if (!epStr.includes(".")) candidates.push(epStr + ".0");

  let sourceUrls = null;
  for (const attempt of candidates) {
    const epRes = await allanimeGQLEpisode({
      showId,
      translationType: dubSub,
      episodeString: attempt,
    });
    if (!epRes.body) continue;
    const urls = parseEpisodeSourceUrls(epRes.body);
    if (urls?.length) {
      sourceUrls = urls;
      break;
    }
  }
  if (!sourceUrls) return null;
  return trySourceUrls(sourceUrls);
}

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { title, season, episode, translationType } = req.query;

  if (!title || !episode) {
    return res.status(400).json({ ok: false, error: "Missing required parameters: title and episode" });
  }

  try {
    const cleanTitle = title.replace(/[''`´]/g, "").replace(/[:!.]/g, "").replace(/\s+/g, " ").trim();
    const dubSub = translationType === "dub" ? "dub" : "sub";
    const epStr = String(episode);

    // 1. Search for Show ID
    const searchRes = await allanimeGQL(
      {
        search: {
          allowAdult: true,
          allowUnknown: true,
          query: cleanTitle,
        },
        limit: 10,
        page: 1,
        translationType: dubSub,
      },
      SEARCH_GQL
    );

    if (!searchRes.body) {
      return res.status(502).json({ ok: false, error: "Empty response from AllAnime search" });
    }

    const shows = JSON.parse(searchRes.body)?.data?.shows?.edges;
    if (!shows?.length) {
      return res.status(404).json({ ok: false, error: "Show not found on AllAnime" });
    }

    // Direct match check
    let showId = null;
    const matchLower = cleanTitle.toLowerCase();
    for (const edge of shows) {
      const name = edge.name?.toLowerCase();
      if (name === matchLower || name?.replace(/\s*\(tv\)/g, "") === matchLower) {
        showId = edge._id;
        break;
      }
    }

    if (!showId) {
      showId = shows[0]._id; // fallback to top search result
    }

    // 2. Resolve episode source
    const result = await resolveEpisodeFromId(showId, epStr, dubSub);

    if (!result) {
      return res.status(404).json({ ok: false, error: `Episode ${epStr} sources could not be resolved` });
    }

    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
