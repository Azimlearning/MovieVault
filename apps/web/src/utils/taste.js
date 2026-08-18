import { storage } from "./storage";

const STORAGE_KEY = "tasteRatings";

export function mediaKey(item) {
  const type = item?.media_type === "tv" || item?.first_air_date ? "tv" : "movie";
  return `${type}_${item?.id}`;
}

export function getTasteRatings() {
  return storage.get(STORAGE_KEY) || {};
}

export function setTasteRating(item, rating) {
  const ratings = getTasteRatings();
  const key = mediaKey(item);
  if (rating === "like" || rating === "dislike") ratings[key] = rating;
  else delete ratings[key];
  storage.set(STORAGE_KEY, ratings);
  return ratings;
}

export function getTasteRating(item, ratings = getTasteRatings()) {
  return ratings[mediaKey(item)] || null;
}

/** A small, explainable ranking signal that stays private in the browser. */
export function scoreRecommendation(item, ratings, history = []) {
  const rating = getTasteRating(item, ratings);
  if (rating === "dislike") return -Infinity;

  let score = rating === "like" ? 1000 : 0;
  const genres = new Set(item.genre_ids || item.genres?.map((g) => g.id) || []);
  for (const watched of history.slice(0, 30)) {
    if (getTasteRating(watched, ratings) !== "like") continue;
    const watchedGenres = watched.genre_ids || watched.genres?.map((g) => g.id) || [];
    for (const genre of watchedGenres) if (genres.has(genre)) score += 12;
  }
  return score + (item.vote_average || 0);
}
