import { storage } from "./storage";

export const getTraktConfig = () => ({
  clientId: storage.get("traktClientId") || "a0957591745427d142168923a1ef5d45d3c8c7ef8b8989a3f25c7e0b5f10b777",
  clientSecret: storage.get("traktClientSecret") || "d66f68c347f89761e0bcf51e1889c2598379ba925695028479e0f06f52e3cc33"
});

export const getAnilistConfig = () => ({
  clientId: storage.get("anilistClientId") || "21220",
  clientSecret: storage.get("anilistClientSecret") || "O3xQ194qVj4k0o7R71V9f740nS3i2v5X8R64P2y1"
});

export async function exchangeTraktCode(code) {
  const config = getTraktConfig();
  const response = await fetch("https://api.trakt.tv/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: "http://localhost:34882/callback",
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) {
    throw new Error("Failed to exchange Trakt authorization code");
  }
  const data = await response.json();
  storage.set("traktToken", data);
  return data;
}

export async function exchangeAnilistCode(code) {
  const config = getAnilistConfig();
  const response = await fetch("https://anilist.co/api/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: "http://localhost:34882/callback",
      code
    })
  });
  if (!response.ok) {
    throw new Error("Failed to exchange AniList authorization code");
  }
  const data = await response.json();
  storage.set("anilistToken", data);
  return data;
}

export async function scrobbleTrakt(item, progress, action = "watch") {
  const token = storage.get("traktToken");
  if (!token?.access_token) return;

  const config = getTraktConfig();
  const body = {
    progress: Math.round(progress)
  };

  if (item.media_type === "movie") {
    body.movie = {
      ids: { tmdb: parseInt(item.id) }
    };
  } else {
    body.show = {
      ids: { tmdb: parseInt(item.id) }
    };
    body.episode = {
      season: parseInt(item.season || 1),
      number: parseInt(item.episode || 1)
    };
  }

  const endpoint = `https://api.trakt.tv/scrobble/${action === "watch" ? "start" : action === "completed" ? "stop" : "pause"}`;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token.access_token}`,
        "trakt-api-version": "2",
        "trakt-api-key": config.clientId
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("Trakt scrobble failed:", err);
  }
}

export async function scrobbleAnilist(anilistId, progress, status = "CURRENT") {
  const token = storage.get("anilistToken");
  if (!token?.access_token) return;

  const query = `
    mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
      SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
        id
        progress
        status
      }
    }
  `;

  try {
    await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token.access_token}`
      },
      body: JSON.stringify({
        query,
        variables: {
          mediaId: parseInt(anilistId),
          progress: parseInt(progress),
          status
        }
      })
    });
  } catch (err) {
    console.error("AniList scrobble failed:", err);
  }
}
