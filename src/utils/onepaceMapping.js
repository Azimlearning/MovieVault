// Mapping of One Pace arc slug to their highest original anime episode equivalent
export const ONE_PACE_EPISODE_MAP = {
  "romance-dawn": 3,
  "orange-town": 8,
  "syrup-village": 18,
  "gaimon": 18,
  "baratie": 30,
  "arlong-park": 44,
  "the-adventures-of-buggys-crew": 47,
  "loguetown": 53,
  "reverse-mountain": 63,
  "whisky-peak": 67,
  "the-trials-of-koby-meppo": 69,
  "little-garden": 77,
  "drum-island": 91,
  "alabasta": 130,
  "jaya": 152,
  "skypiea": 195,
  "long-ring-long-land": 219,
  "water-seven": 263,
  "enies-lobby": 312,
  "post-enies-lobby": 325,
  "thriller-bark": 381,
  "sabaody-archipelago": 405,
  "amazon-lily": 417,
  "impel-down": 452,
  "if-you-could-go-anywhere-the-adventures-of-the-straw-hats": 456,
  "marineford": 489,
  "post-war": 516,
  "return-to-sabaody": 522,
  "fishman-island": 574,
  "punk-hazard": 625,
  "dressrosa": 746,
  "zou": 779,
  "whole-cake-island": 877,
  "reverie": 889,
  "wano": 1085,
  "egghead": 1120, // Ongoing, approximate range
  "one-piece-fan-letter": 1122,
  "warship-island-01-april-fools-2025": 1122
};

export const getHighestOriginalEpisode = (arcSlug) => {
  return ONE_PACE_EPISODE_MAP[arcSlug] || null;
};
