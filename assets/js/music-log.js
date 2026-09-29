/* Music log (/music/): turns share links into players when their month is opened */
(() => {
  const root = document.querySelector(".music");
  if (!root) return;

  const seconds = (value) => {
    if (!value) return 0;
    if (/^\d+$/.test(value)) return Number(value);
    const match = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
  };

  function parse(link) {
    let url;
    try {
      url = new URL(link);
    } catch {
      return null;
    }
    const host = url.hostname.replace(/^(www|m)\./, "");
    const path = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" || host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const id = host === "youtu.be" ? path[0] : url.searchParams.get("v") || (["shorts", "live", "embed"].includes(path[0]) ? path[1] : null);
      if (!id) return null;
      return { kind: "youtube", id, start: seconds(url.searchParams.get("t") || url.searchParams.get("start")) };
    }
    if (host === "open.spotify.com") {
      const parts = path[0] && path[0].startsWith("intl-") ? path.slice(1) : path;
      const [type, id] = parts;
      if (!["track", "album", "playlist", "episode", "show", "artist"].includes(type) || !id) return null;
      const compact = type === "track" || type === "episode";
      return { kind: "iframe", src: `https://open.spotify.com/embed/${type}/${id}`, height: compact ? 152 : 352, title: "Spotify" };
    }
    if (host === "music.apple.com") {
      const single = url.searchParams.has("i") || path[1] === "song";
      return { kind: "iframe", src: `https://embed.music.apple.com${url.pathname}${url.search}`, height: single ? 175 : 450, title: "Apple Music" };
    }
    if (host === "soundcloud.com") {
      const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&visual=false&show_comments=false`;
      return { kind: "iframe", src, height: 166, title: "SoundCloud" };
    }
    return null;
  }

  function iframe(src, attrs = {}) {
    const frame = document.createElement("iframe");
    frame.src = src;
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    frame.allowFullscreen = true;
    Object.assign(frame, attrs);
    return frame;
  }

  // A thumbnail stands in for the YouTube player until it's clicked, so opening a month with many videos stays light
  function youtube(box, { id, start }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-yt";
    button.setAttribute("aria-label", "Play video");
    const thumb = document.createElement("img");
    thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    thumb.alt = "";
    thumb.loading = "lazy";
    const title = document.createElement("span");
    title.className = "music-yt-title";
    const play = document.createElement("span");
    play.className = "music-yt-play";
    button.append(thumb, title, play);
    button.addEventListener("click", () => {
      const params = new URLSearchParams({ autoplay: "1", rel: "0" });
      if (start) params.set("start", start);
      box.replaceChildren(iframe(`https://www.youtube-nocookie.com/embed/${id}?${params}`, { title: title.textContent || "YouTube video" }));
    });
    box.replaceChildren(button);

    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((info) => {
        if (!info) return;
        title.textContent = info.title;
        button.setAttribute("aria-label", `Play ${info.title}`);
      })
      .catch(() => {});
  }

  function hydrate(entry) {
    if (entry.dataset.ready) return;
    entry.dataset.ready = "true";
    const link = entry.dataset.url;
    const media = parse(link);
    const box = entry.querySelector(".music-embed");
    if (!media) return; // unknown site: keep the plain link
    box.classList.add(`is-${media.kind}`);
    if (media.kind === "youtube") youtube(box, media);
    else box.replaceChildren(iframe(media.src, { height: media.height, title: media.title }));
  }

  const hydrateMonth = (month) => month.querySelectorAll(".music-entry").forEach(hydrate);

  for (const month of root.querySelectorAll(".music-month")) {
    if (month.open) hydrateMonth(month);
    month.addEventListener("toggle", () => month.open && hydrateMonth(month));
  }

  for (const button of root.querySelectorAll(".music-toggle")) {
    button.addEventListener("click", () => {
      const open = button.dataset.open === "true";
      for (const section of root.querySelectorAll("details")) section.open = open;
    });
  }
})();
