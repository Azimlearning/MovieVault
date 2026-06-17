const META_URL = 'https://raw.githubusercontent.com/au2001/onepace-stremio/main/meta/series/onepace.json';
const EP_URL = 'https://raw.githubusercontent.com/DendyLusus/one-pace-map/main/data/episodes.json';
const CACHE_KEY = 'onepace_catalog_v3';
const CACHE_DURATION = 6 * 60 * 60 * 1000;

function parseChapters(fileName) {
  const match = fileName.match(/^\[One Pace\]\[([^\]]+)\]/i);
  return match ? match[1] : null;
}

function getChapterRange(chaptersStr) {
  if (!chaptersStr) return null;
  const numbers = chaptersStr.match(/\d+/g);
  if (!numbers) return null;
  const parsed = numbers.map(Number);
  return { start: Math.min(...parsed), end: Math.max(...parsed) };
}

async function fetchAndMergeCatalog() {
  const [metaRes, epRes] = await Promise.all([
    fetch(META_URL),
    fetch(EP_URL),
  ]);

  if (!metaRes.ok) throw new Error(`Failed to fetch meta: ${metaRes.status}`);
  if (!epRes.ok) throw new Error(`Failed to fetch episodes: ${epRes.status}`);

  const metaData = await metaRes.json();
  const epData = await epRes.json();

  const seasons = {};
  for (const v of metaData.meta.videos) {
    if (!seasons[v.season]) seasons[v.season] = [];
    seasons[v.season].push(v);
  }

  return epData.map((arc, index) => {
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
        .trim()
        .replace(/\s+/g, " ");

      const epResolution = arc.resolution ? `${arc.resolution}p` : '1080p';
      const directUrl = `https://pixeldrain.com/api/file/${ep.file_id}`;
      const resolutions = {};
      resolutions[epResolution] = {
        pixeldrainId: ep.file_id,
        sizeMb: Math.round(ep.size / (1024 * 1024)),
        // Pixeldrain blocks browser-originated embeds (403 "embed_not_allowed"),
        // so on the deployed web app we stream through the same-origin serverless
        // proxy (server-side requests are not blocked). Local dev hits Pixeldrain
        // directly since the proxy function only exists on Vercel.
        url: import.meta.env.PROD
          ? `/api/proxy?url=${encodeURIComponent(directUrl)}`
          : directUrl,
      };

      const subtitles = [];
      if (metaEp) {
        subtitles.push({
          id: `${metaEp.id}_eng`,
          lang: 'English',
          language: 'eng',
          url: `https://onepace.arl.sh/static/${metaEp.id}_eng.srt`,
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
        durationMin: 30,
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
      episodes,
      mangaChaptersStart: minChapter !== Infinity ? minChapter : null,
      mangaChaptersEnd: maxChapter !== -Infinity ? maxChapter : null,
      status: arc.slug === 'egghead' ? 'in_progress' : 'released',
    };
  });
}

export async function fetchOnePaceCatalog() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_DURATION) return cached.data;
  } catch {}

  const data = await fetchAndMergeCatalog();

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}

  return data;
}
