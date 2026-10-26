import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DATA_PATH,
  FEED_PATH,
  generateFeedXmlFromFile,
  parseEntries,
} from "./build-industry-watch-feed.mjs";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HTTP_URL = /^https?:\/\/\S+$/i;

function isValidIsoDate(value) {
  const match = typeof value === "string" && value.match(ISO_DATE);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function collectEntryErrors(entries) {
  const errors = [];
  const seenIds = new Set();

  entries.forEach((entry, index) => {
    const where = `entries[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${where} must be an object`);
      return;
    }

    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    if (!title) errors.push(`${where} is missing a title`);

    if (!isValidIsoDate(entry.date)) {
      errors.push(`${where} is missing a date (YYYY-MM-DD)`);
    }

    const sources = Array.isArray(entry.sources) ? entry.sources : [];
    const hasSourceUrl = sources.some(
      (source) => source && typeof source.url === "string" && HTTP_URL.test(source.url.trim()),
    );
    if (!hasSourceUrl) {
      errors.push(`${where} is missing a source URL`);
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (id) {
      if (seenIds.has(id)) errors.push(`${where} repeats id "${id}"`);
      seenIds.add(id);
    }
  });

  return errors;
}

export function validateIndustryWatch({
  dataPath = DATA_PATH,
  feedPath = FEED_PATH,
} = {}) {
  const errors = [];
  let raw;

  try {
    raw = JSON.parse(readFileSync(dataPath, "utf8"));
  } catch (error) {
    return [`could not read ${dataPath}: ${error.message}`];
  }

  let entries;
  try {
    entries = parseEntries(raw);
  } catch (error) {
    return [error.message];
  }

  errors.push(...collectEntryErrors(entries));

  let expected;
  try {
    expected = generateFeedXmlFromFile(dataPath);
  } catch (error) {
    errors.push(`could not build feed: ${error.message}`);
    return errors;
  }

  let actual;
  try {
    actual = readFileSync(feedPath, "utf8");
  } catch (error) {
    errors.push(`could not read ${feedPath}: ${error.message}`);
    return errors;
  }

  if (actual !== expected) {
    errors.push(
      "industry-watch/feed.xml is stale; run: node scripts/build-industry-watch-feed.mjs",
    );
  }

  return errors;
}

const invokedAsMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsMain) {
  const errors = validateIndustryWatch();
  if (errors.length) {
    process.stderr.write(`Industry watch: ${errors.length} error(s)\n`);
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exit(1);
  }
  process.stdout.write("Industry watch: ok\n");
}
