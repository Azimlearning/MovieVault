const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { safeHandle } = require("./safeHandle");

const CACHE_FILE = path.join(app.getPath("userData"), "onepace-cache.json");
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Failed to fetch: ${res.statusCode}`));
      }
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

function parseChapters(fileName) {
  const match = fileName.match(/^\[One Pace\]\[([^\]]+)\]/i);
  return match ? match[1] : null;
}

function getChapterRange(chaptersStr) {
  if (!chaptersStr) return null;
  const numbers = chaptersStr.match(/\d+/g);
  if (!numbers) return null;
  const parsed = numbers.map(Number);
  return {
    start: Math.min(...parsed),
    end: Math.max(...parsed)
  };
}

async function fetchAndMergeCatalog() {
  const metaUrl = 'https://raw.githubusercontent.com/au2001/onepace-stremio/main/meta/series/onepace.json';
  const epUrl = 'https://raw.githubusercontent.com/DendyLusus/one-pace-map/main/data/episodes.json';

  const [metaRaw, epRaw] = await Promise.all([
    httpsGet(metaUrl),
    httpsGet(epUrl)
  ]);

  const metaData = JSON.parse(metaRaw);
  const epData = JSON.parse(epRaw);

  const seasons = {};
  for (const v of metaData.meta.videos) {
    if (!seasons[v.season]) {
      seasons[v.season] = [];
    }
    seasons[v.season].push(v);
  }

  const arcs = epData.map((arc, index) => {
    const seasonNum = index + 1;
    const metaVideos = seasons[seasonNum] || [];

    let minChapter = Infinity;
    let maxChapter = -Infinity;

    const episodes = arc.episodes.map(ep => {
      const metaEp = metaVideos.find(v => v.episode === ep.episode_num);
      const chaptersStr = parseChapters(ep.file_name);
      const range = getChapterRange(chaptersStr);
      
      if (range) {
        if (range.start < minChapter) minChapter = range.start;
        if (range.end > maxChapter) maxChapter = range.end;
      }

      let title = ep.file_name
        .replace(/^\[One Pace\]\[[^\]]+\]/i, "")
        .replace(/\[\d+p\]/gi, "")
        .replace(/\[[A-Fa-f0-9]+\]/gi, "")
        .replace(/\.mp4$/i, "")
        .trim();

      title = title.replace(/\s+/g, " ");

      // Clean resolutions mapping structure as required by plan
      const epResolution = arc.resolution ? `${arc.resolution}p` : '1080p';
      const resolutions = {};
      resolutions[epResolution] = {
        pixeldrainId: ep.file_id,
        sizeMb: Math.round(ep.size / (1024 * 1024)),
        url: `https://pixeldrain.com/api/file/${ep.file_id}?download`
      };

      // Add a fallback sub track
      const subtitles = [];
      if (metaEp) {
        // Look up corresponding stremio addon subtitles
        // The stremio subtitles are hosted at https://onepace.arl.sh/static/{episode_id}_eng.srt
        // which corresponds to metaEp.id (like RO_1)
        subtitles.push({
          id: `${metaEp.id}_eng`,
          lang: 'English',
          language: 'eng',
          url: `https://onepace.arl.sh/static/${metaEp.id}_eng.srt`
        });
      }

      return {
        arcId: arc.slug,
        episodeNumber: ep.episode_num,
        title: metaEp ? metaEp.title : title,
        overview: metaEp ? metaEp.overview : "No description available.",
        releaseDate: metaEp ? metaEp.released : null,
        mangaChapters: chaptersStr,
        resolutions,
        subtitles,
        durationMin: metaEp ? 30 : 30, // Default duration estimation
      };
    });

    return {
      id: arc.slug,
      name: arc.title,
      slug: arc.slug,
      playlistId: arc.playlist_id,
      resolution: arc.resolution,
      sub: arc.sub,
      dub: arc.dub,
      variant: arc.variant,
      episodeCount: episodes.length,
      episodes: episodes,
      mangaChaptersStart: minChapter !== Infinity ? minChapter : null,
      mangaChaptersEnd: maxChapter !== -Infinity ? maxChapter : null,
      status: arc.slug === 'egghead' ? 'in_progress' : 'released',
    };
  });

  return arcs;
}

let inProgressFetch = null;

async function getCatalog(forceRefresh = false) {
  let cache = null;
  let useCache = false;

  if (!forceRefresh) {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const stats = fs.statSync(CACHE_FILE);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_DURATION) {
          const data = fs.readFileSync(CACHE_FILE, "utf8");
          cache = JSON.parse(data);
          useCache = true;
        }
      }
    } catch (e) {
      console.error("Error reading One Pace cache:", e);
    }
  }

  if (useCache && cache) {
    return cache;
  }

  if (cache && !forceRefresh) {
    if (!inProgressFetch) {
      inProgressFetch = fetchAndMergeCatalog().then(data => {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf8");
        inProgressFetch = null;
        return data;
      }).catch(err => {
        console.error("Background catalog fetch failed:", err);
        inProgressFetch = null;
      });
    }
    return cache;
  }

  const data = await fetchAndMergeCatalog();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf8");
  } catch (e) {
    console.error("Failed to write One Pace cache:", e);
  }
  return data;
}

function register() {
  safeHandle("list-onepace-arcs", async () => {
    try {
      const arcs = await getCatalog();
      return {
        ok: true,
        arcs: arcs.map(a => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          playlistId: a.playlistId,
          resolution: a.resolution,
          sub: a.sub,
          dub: a.dub,
          variant: a.variant,
          episodeCount: a.episodeCount,
          status: a.status,
          mangaChaptersStart: a.mangaChaptersStart,
          mangaChaptersEnd: a.mangaChaptersEnd,
        }))
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  safeHandle("get-onepace-arc", async (_, arcId) => {
    try {
      const arcs = await getCatalog();
      const arc = arcs.find(a => a.id === arcId);
      if (!arc) return { ok: false, error: "Arc not found" };
      return { ok: true, arc };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  safeHandle("refresh-onepace", async () => {
    try {
      const arcs = await getCatalog(true);
      return { ok: true, count: arcs.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
