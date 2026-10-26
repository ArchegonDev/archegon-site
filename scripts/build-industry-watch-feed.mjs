import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_PATH = join(ROOT, "data", "industry-watch.json");
export const FEED_PATH = join(ROOT, "industry-watch", "feed.xml");

const SITE = "https://www.archegon.com";
const PAGE_URL = `${SITE}/industry-watch/`;
const FEED_URL = `${SITE}/industry-watch/feed.xml`;

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function parseEntries(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("data/industry-watch.json must be an array");
  }
  return raw;
}

export function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => {
    const dateCmp = String(b?.date ?? "").localeCompare(String(a?.date ?? ""));
    if (dateCmp !== 0) return dateCmp;
    return String(b?.id ?? "").localeCompare(String(a?.id ?? ""));
  });
}

export function buildFeedXml(entries) {
  const sorted = sortNewestFirst(entries);
  const newest = sorted[0]?.date;
  const lastBuild = newest
    ? rfc822FromIsoDate(newest)
    : "Thu, 01 Jan 1970 12:00:00 GMT";

  const items = sorted.map((entry) => {
    const link = `${PAGE_URL}#${encodeURIComponent(entry.id)}`;
    const sources = Array.isArray(entry.sources)
      ? entry.sources
          .map((source) => `${source.label ?? source.url}: ${source.url}`)
          .join(" ")
      : "";
    const description = [entry.summary, entry.why_it_matters, sources]
      .filter(Boolean)
      .join("\n\n");
    return [
      "    <item>",
      `      <title>${escapeXml(entry.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(`industry-watch:${entry.id}`)}</guid>`,
      `      <pubDate>${rfc822FromIsoDate(entry.date)}</pubDate>`,
      `      <description>${escapeXml(description)}</description>`,
      "    </item>",
    ].join("\n");
  });

  const lines = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Archegon Industry watch</title>",
    `    <link>${PAGE_URL}</link>`,
    "    <description>Sourced public notes on geothermal power, grids, and compute. Allegations are labelled on the page.</description>",
    "    <language>en-GB</language>",
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ];

  return lines.join("\n");
}

export function rfc822FromIsoDate(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).toUTCString();
}

export function generateFeedXmlFromFile(dataPath = DATA_PATH) {
  const raw = JSON.parse(readFileSync(dataPath, "utf8"));
  return buildFeedXml(parseEntries(raw));
}

export function writeFeed(dataPath = DATA_PATH, feedPath = FEED_PATH) {
  mkdirSync(dirname(feedPath), { recursive: true });
  const xml = generateFeedXmlFromFile(dataPath);
  writeFileSync(feedPath, xml, "utf8");
  return feedPath;
}

const invokedAsMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsMain) {
  const path = writeFeed();
  process.stdout.write(`Wrote ${path}\n`);
}
