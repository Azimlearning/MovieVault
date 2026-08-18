// URL ↔ app-state mapping for the web build.
//
// The app's navigation model is a `{ page, selected }` pair held in App state.
// This module is the only place that knows what that pair looks like as a URL,
// so the rest of the app keeps calling `navigate(page, data)` unchanged.
//
// Two directions:
//   stateToPath(page, selected) → the address bar entry for a screen
//   pathToState(pathname, search) → the screen for an address typed, shared,
//     bookmarked or reloaded (cold start, where no in-memory object exists)
//
// A cold-start `selected` is a *stub*: only the fields recoverable from the URL.
// MoviePage/TVPage fetch full details from `item.id` on mount, so a stub is
// enough to render the real page — the title fills in when the fetch lands.

const slugify = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// Pages with no parameters, so the mapping is a plain lookup both ways.
const STATIC_ROUTES = {
  home: "/",
  history: "/library",
  downloads: "/downloads",
  settings: "/settings",
  onepace: "/one-pace",
};

const STATIC_PAGES = Object.fromEntries(
  Object.entries(STATIC_ROUTES).map(([page, path]) => [path, page]),
);

export function stateToPath(page, selected) {
  if (STATIC_ROUTES[page]) return STATIC_ROUTES[page];

  const id = selected?.id;
  const title = selected?.title || selected?.name;

  if (page === "movie" && id) {
    const slug = slugify(title);
    return `/movie/${id}${slug ? `/${slug}` : ""}`;
  }

  if (page === "tv" && id) {
    const slug = slugify(title);
    const params = new URLSearchParams();
    if (selected?.season != null) params.set("s", String(selected.season));
    if (selected?.episode != null) params.set("e", String(selected.episode));
    const query = params.toString();
    return `/tv/${id}${slug ? `/${slug}` : ""}${query ? `?${query}` : ""}`;
  }

  if (page === "onepaceArc") {
    const slug = slugify(selected?.title || selected?.name || selected?.slug);
    return slug ? `/one-pace/${slug}` : "/one-pace";
  }

  if (page === "onepacePlayer") {
    const slug = slugify(
      selected?.arc?.title || selected?.arc?.name || selected?.arc?.slug,
    );
    return slug ? `/one-pace/${slug}/watch` : "/one-pace";
  }

  // Unknown page: keep the current address rather than inventing one.
  return null;
}

export function pathToState(pathname, search = "") {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";

  if (STATIC_PAGES[path]) return { page: STATIC_PAGES[path], selected: null };

  const segments = path.split("/").filter(Boolean);
  const params = new URLSearchParams(search);

  if ((segments[0] === "movie" || segments[0] === "tv") && segments[1]) {
    const id = Number(segments[1]);
    if (!Number.isFinite(id)) return null;
    const mediaType = segments[0];
    const season = params.get("s");
    const episode = params.get("e");
    return {
      page: mediaType,
      selected: {
        id,
        media_type: mediaType,
        // Placeholders so components that read these before their TMDB fetch
        // resolves render an empty string rather than "undefined".
        title: "",
        name: "",
        poster_path: null,
        ...(season != null ? { season: Number(season) } : {}),
        ...(episode != null ? { episode: Number(episode) } : {}),
      },
    };
  }

  // One Pace arcs are addressed by slug, but an arc object can only be rebuilt
  // from the arc list that OnePacePage loads. A cold hit lands on the list.
  if (segments[0] === "one-pace") return { page: "onepace", selected: null };

  return null;
}

// A deep link is shared with whatever slug the sender had; a cold start derives
// its state from the id alone, so the slug can be missing or stale. Once TMDB
// resolves the real title, upgrade the address in place — same history entry,
// so this never adds a Back step.
export function canonicaliseTitleSlug(id, title) {
  const slug = slugify(title);
  if (!slug || !id) return;
  const match = window.location.pathname.match(
    /^\/(movie|tv)\/(\d+)(?:\/([^/]*))?$/,
  );
  if (!match || Number(match[2]) !== Number(id)) return;
  if (match[3] === slug) return;
  window.history.replaceState(
    window.history.state,
    "",
    `/${match[1]}/${match[2]}/${slug}${window.location.search}`,
  );
}

// Full path (with query) for the current app state, or null when the state has
// no address of its own.
export function stateToUrl(page, selected) {
  return stateToPath(page, selected);
}

export function currentPathState() {
  return pathToState(window.location.pathname, window.location.search);
}
