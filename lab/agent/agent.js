/* ======================================================================
 * Archegon — visitor agent (prototype)
 *
 * Answers questions about the thesis using ONLY the published corpus in
 * kb.json, which is generated from evidence/, blog/ and the page copy.
 *
 * Design constraints, in priority order:
 *
 *   1. Compliance first. Anything touching returns, capital requirements,
 *      valuation or terms is refused BEFORE retrieval and routed to email.
 *      This is a deny-list check on the raw question, so it cannot be
 *      talked around by a model that is trying to be helpful.
 *   2. Grounded only. Every answer is assembled from retrieved corpus
 *      entries and cites them. If nothing scores above threshold, the
 *      agent says it does not know rather than improvising.
 *   3. No key in the client. This prototype runs fully offline with
 *      deterministic retrieval so it can be evaluated without a backend.
 *      An LLM can be added later behind a proxy; the guardrail and the
 *      retrieval boundary stay exactly where they are.
 * ====================================================================== */

const KB_URL = "kb.json";
const CONTACT = "hello@archegon.com";

/* Commercially sensitive territory. Deliberately broad: a false refusal is
 * cheap, a stray statement about returns is not. */
const REFUSE = [
  /\b(irr|roi|return|returns|yield|multiple|moic)\b/i,
  /\b(valuation|pre-?money|post-?money|cap table|equity|dilution|share price)\b/i,
  /\b(how much (are you |do you )?(raising|need|want)|raise|ticket size|minimum investment)\b/i,
  /\b(capex per mw|capital requirement|capital stack|debt terms|financial model)\b/i,
  /\b(payback|profit|revenue forecast|projection|forecast)\b/i,
  /\b(invest in you|can i invest|buy shares|allocation)\b/i,
];

/* Attempts to override instructions. Logged so the prototype surfaces how
 * often it happens, which is itself useful evidence. */
const INJECTION = [
  /ignore (all |your |previous |above )?(instructions|rules|prompt)/i,
  /disregard (the |your )?(above|instructions|rules)/i,
  /you are (now|actually) (a|an|no longer)/i,
  /(system|developer) prompt/i,
  /pretend (to be|that you)/i,
  /roleplay|jailbreak|DAN mode/i,
];

const STOP = new Set(
  ("a an and are as at be but by for from has have how i in is it its of on or that the this to " +
   "was what when where which who why will with you your do does can could would should").split(" ")
);

let KB = null;

/* ── retrieval ──────────────────────────────────────────────────────── */

const terms = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

function corpus() {
  const docs = [];
  for (const s of KB.sources) {
    docs.push({
      type: "source",
      id: s.id,
      title: s.title,
      body: `${s.title} ${s.summary} ${s.kind}`,
      cite: s.title,
      anchor: `../../${s.anchor}`,
      external: s.url,
    });
  }
  for (const n of KB.notes) {
    docs.push({
      type: "note", id: n.id, title: n.title, body: `${n.title} ${n.body}`,
      cite: `Research note — ${n.title}`, anchor: `../../${n.anchor}`,
    });
  }
  for (const s of KB.sections) {
    docs.push({
      type: "section", id: s.id, title: s.title, body: `${s.title} ${s.body}`,
      cite: s.title, anchor: `../index.html${s.anchor}`,
    });
  }
  return docs;
}

/* Substance-bearing prose lives in page sections and research notes. Source
 * entries are only one-line catalogue blurbs, so left unweighted they win on
 * raw term density and the agent ends up reciting bibliography instead of
 * answering. Weight by what a doc can actually say. */
const PRIOR = { section: 1.0, note: 0.85, source: 0.28 };

/* BM25-style scoring: saturating term frequency plus length normalisation,
 * which stops a 190-character blurb outranking a 900-character explanation. */
function rank(question, docs) {
  const q = terms(question);
  if (!q.length) return [];

  const df = new Map();
  for (const d of docs) {
    for (const t of new Set(terms(d.body))) df.set(t, (df.get(t) || 0) + 1);
  }

  const lens = docs.map((d) => terms(d.body).length);
  const avgLen = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const k1 = 1.2;
  const b = 0.5;

  return docs
    .map((d) => {
      const words = terms(d.body);
      const tf = new Map();
      for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);

      let score = 0;
      let matched = 0;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        matched++;
        const idf = Math.log(1 + (docs.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
        const norm = f * (k1 + 1) / (f + k1 * (1 - b + b * (words.length / avgLen)));
        score += idf * norm;
        if (terms(d.title).includes(t)) score += 0.8;
      }

      // Reward covering more of the question, not just hammering one term.
      const coverage = matched / q.length;
      return { ...d, score: score * PRIOR[d.type] * (0.55 + 0.45 * coverage) };
    })
    .filter((d) => d.score > 0.5)
    .sort((a, b) => b.score - a.score);
}

/* ── answering ──────────────────────────────────────────────────────── */

const refusal = () => ({
  kind: "refused",
  text:
    `That is a commercial question, and this site deliberately does not publish ` +
    `return figures, capital requirements, or terms — they belong in a proper ` +
    `diligence conversation, not a chat window. Email ${CONTACT} and Anthony ` +
    `will take it from there.`,
  cites: [],
});

const unknown = () => ({
  kind: "unknown",
  text:
    `I do not have anything published on that, and I would rather say so than ` +
    `guess. This prototype only answers from the thesis, research notes, and ` +
    `the 29 cited sources on this site. For anything else, email ${CONTACT}.`,
  cites: [],
});

/* Pull the sentences that actually overlap the question, so answers quote
 * published wording rather than paraphrasing it into something new.
 *
 * Without a language model this is extraction, not synthesis: a sentence has
 * to genuinely address the question or it is discarded. The threshold is set
 * deliberately high because on an investor-facing site a confident
 * non-answer is far more damaging than "I do not know". */
const MIN_OVERLAP = 2; // distinct question terms a sentence must contain

function extract(question, doc, max = 2) {
  const q = new Set(terms(question));
  const sentences = doc.body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 45);

  const scored = sentences
    .map((s) => {
      const ws = terms(s);
      const distinct = new Set(ws.filter((w) => q.has(w)));
      return {
        s,
        hits: distinct.size,
        score: distinct.size / Math.sqrt(ws.length || 1),
      };
    })
    .filter((x) => x.hits >= MIN_OVERLAP)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map((x) => x.s);
}

export function answer(question) {
  const text = (question || "").trim();
  if (!text) return unknown();

  const injected = INJECTION.some((r) => r.test(text));
  if (REFUSE.some((r) => r.test(text))) return { ...refusal(), injected };

  const ranked = rank(text, corpus());
  if (!ranked.length) return { ...unknown(), injected };

  /* Answer from prose (sections and notes). Source entries are catalogue
   * blurbs, so they are offered as further reading rather than quoted as if
   * they were an answer. */
  const prose = ranked.filter((d) => d.type !== "source").slice(0, 3);
  const refs = ranked.filter((d) => d.type === "source").slice(0, 2);

  const parts = [];
  const cites = [];
  for (const h of prose) {
    const lines = extract(text, h);
    if (!lines.length) continue;
    parts.push(lines.join(" "));
    cites.push({ label: h.cite, anchor: h.anchor, type: h.type });
    if (parts.length >= 2) break;
  }

  /* Nothing was responsive enough to quote. Rather than stitching together
   * loosely related sentences, point at the most relevant published material
   * and be explicit that this is a pointer, not an answer. */
  if (!parts.length) {
    const near = [...prose, ...refs].slice(0, 3);
    if (!near.length) return { ...unknown(), injected };
    return {
      kind: "partial",
      text:
        `I do not have a direct answer to that in the published material, so I ` +
        `will not improvise one. The closest relevant material is below, and ` +
        `${CONTACT} will get you a proper answer.`,
      cites: near.map((d) => ({
        label: d.cite, anchor: d.anchor, external: d.external, type: d.type,
      })),
      injected,
    };
  }

  for (const r of refs) {
    cites.push({ label: r.cite, anchor: r.anchor, external: r.external, type: r.type });
  }

  return { kind: "answered", text: parts.join(" "), cites, injected };
}

export async function load() {
  if (KB) return KB;
  const res = await fetch(KB_URL);
  if (!res.ok) throw new Error(`kb.json ${res.status}`);
  KB = await res.json();
  return KB;
}

export const _internals = { REFUSE, INJECTION, rank, corpus, terms };
