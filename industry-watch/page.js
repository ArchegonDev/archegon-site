const DATA_URL = "../data/industry-watch.json";
const EMPTY_COPY = "First notes coming soon";

const listEl = document.querySelector("[data-watch-list]");
const filtersEl = document.querySelector("[data-watch-filters]");

const formatDate = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso || "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const sortNewestFirst = (entries) =>
  [...entries].sort((a, b) => {
    const dateCmp = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCmp !== 0) return dateCmp;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });

const uniqueTags = (entries) => {
  const tags = new Set();
  entries.forEach((entry) => {
    (entry.tags || []).forEach((tag) => {
      if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
    });
  });
  return [...tags].sort((a, b) => a.localeCompare(b));
};

const escapeText = (value) => {
  const node = document.createElement("div");
  node.textContent = value == null ? "" : String(value);
  return node.innerHTML;
};

const sourceLinks = (sources) =>
  (Array.isArray(sources) ? sources : [])
    .filter((source) => source && /^https?:\/\//i.test(String(source.url || "")))
    .map((source) => {
      const label = source.label || source.url;
      return `<a href="${escapeText(source.url)}" rel="noopener noreferrer">${escapeText(label)}</a>`;
    })
    .join("");

const renderEntry = (entry) => {
  const tags = (entry.tags || [])
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => `<span>${escapeText(tag.trim())}</span>`)
    .join("");
  const allegation = entry.allegation
    ? '<span class="source-badge watch-allegation">Allegation</span>'
    : "";
  const why = entry.why_it_matters
    ? `<p class="watch-why"><span>Why it matters</span>${escapeText(entry.why_it_matters)}</p>`
    : "";

  return `
    <article class="watch-entry" id="${escapeText(entry.id || "")}">
      <div class="watch-entry-head">
        <p class="post-meta">${escapeText(formatDate(entry.date))}</p>
        ${allegation}
      </div>
      <h2>${escapeText(entry.title)}</h2>
      <p class="watch-summary">${escapeText(entry.summary || "")}</p>
      ${why}
      <div class="tag-row">${tags}</div>
      <div class="watch-sources">${sourceLinks(entry.sources)}</div>
    </article>
  `;
};

const renderEmpty = () => {
  listEl.innerHTML = `<p class="watch-empty">${EMPTY_COPY}</p>`;
};

const renderList = (entries, activeTag) => {
  const visible = activeTag
    ? entries.filter((entry) => (entry.tags || []).includes(activeTag))
    : entries;
  if (!visible.length) {
    renderEmpty();
    return;
  }
  listEl.innerHTML = visible.map(renderEntry).join("");
};

const renderFilters = (tags, activeTag) => {
  if (!tags.length) {
    filtersEl.hidden = true;
    filtersEl.innerHTML = "";
    return;
  }
  filtersEl.hidden = false;
  const buttons = [
    { label: "All", value: "" },
    ...tags.map((tag) => ({ label: tag, value: tag })),
  ];
  filtersEl.innerHTML = buttons
    .map(
      (button) =>
        `<button type="button" aria-pressed="${button.value === activeTag}" data-tag="${escapeText(button.value)}">${escapeText(button.label)}</button>`,
    )
    .join("");
};

const start = async () => {
  if (!listEl || !filtersEl) return;

  let entries = [];
  try {
    const response = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    entries = sortNewestFirst(Array.isArray(raw) ? raw : []);
  } catch (error) {
    listEl.innerHTML = `<p class="watch-empty">${EMPTY_COPY}</p>`;
    console.error("Industry watch failed to load", error);
    return;
  }

  const tags = uniqueTags(entries);
  let activeTag = "";

  const paint = () => {
    renderFilters(tags, activeTag);
    renderList(entries, activeTag);
  };

  filtersEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tag]");
    if (!button) return;
    activeTag = button.dataset.tag || "";
    paint();
  });

  paint();
};

start();
