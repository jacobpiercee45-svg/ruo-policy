/**
 * ruo-policy — the shared Research-Use-Only compliance standard.
 *
 * ONE source of truth, imported by every consumer so there is never a second,
 * weaker copy:
 *   - the ouralus storefront build gate (scripts/ruo-lint.mjs) — walks dist/ +
 *     src and calls lintText() per file;
 *   - the ops content engine's compliance gate — calls lintText() on each
 *     generated draft before it can be queued to publish.
 *
 * The banned-term patterns and allowlist live in ./ruo-policy.mjs (data). The
 * matching SEMANTICS live here (allowlist-range suppression + same-sentence
 * negation window) so every consumer reaches an identical verdict. Lifted
 * verbatim from the storefront's original ruo-lint.mjs — behavior unchanged,
 * just relocated so it can be shared.
 *
 * Pure: no filesystem, no network, no Date.now — runs identically in Node, in a
 * Deno edge function, and in a unit test. Callers own file discovery / I/O.
 */
import {
  BANNED,
  ALLOW,
  NEGATORS,
  NEGATION_WINDOW,
  POLICY_VERSION,
} from "./ruo-policy.mjs";

export { BANNED, ALLOW, NEGATORS, NEGATION_WINDOW, POLICY_VERSION };

/** Strip tags/scripts from HTML so we judge visible text + JSON-LD, not markup. */
export function htmlToText(html) {
  return html
    .replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/g, " ");
}

/** Ranges of allowlisted phrase matches for this file. */
function allowRanges(text, filePath) {
  const ranges = [];
  for (const { file, phrase } of ALLOW) {
    if (!file.test(filePath)) continue;
    const re = new RegExp(phrase.source, phrase.flags.includes("g") ? phrase.flags : phrase.flags + "g");
    for (const m of text.matchAll(re)) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

const inRange = (ranges, start, end) => ranges.some(([a, b]) => start >= a && end <= b);

// Abbreviations whose internal/trailing periods are NOT sentence boundaries. The bare
// "last period is the sentence start" heuristic breaks on these: "…not approved by the
// U.S. Food…" hid the preceding "not" (false positive), and symmetrically a period inside
// an abbreviation can fail OPEN by making a real, un-negated term look same-sentence with
// an earlier negator. We neutralize these periods before locating the last true stop.
const ABBREVIATION =
  /\b(?:U\.S\.A|U\.S|U\.K|e\.g|i\.e|etc|vs|Inc|Ltd|Corp|Co|Dr|Mrs|Mr|Ms|Ph\.?D|a\.m|p\.m|approx|Fig|et\s+al)\./gi;

function negatedNearby(text, idx) {
  const from = Math.max(0, idx - NEGATION_WINDOW);
  const window = text.slice(from, idx);
  // Mask abbreviation periods (same length in → indices stay valid), then split on the
  // last TRUE sentence stop (. ? !). A negator must sit in that same-sentence tail.
  const masked = window.replace(ABBREVIATION, (m) => m.replace(/\./g, ""));
  const lastStop = Math.max(masked.lastIndexOf("."), masked.lastIndexOf("?"), masked.lastIndexOf("!"));
  return NEGATORS.test(lastStop >= 0 ? window.slice(lastStop + 1) : window);
}

function lineOf(text, idx) {
  return text.slice(0, idx).split("\n").length;
}

/**
 * Evaluate already-extracted text against the RUO policy.
 *
 * @param {string} text  Plain text to scan (caller runs htmlToText first for HTML).
 * @param {{ filePath?: string, surface?: "ruo"|"consumer" }} [opts]  filePath drives
 *   ALLOW's file-scoping (synthetic path e.g. "draft" for a social caption). `surface`
 *   selects which class tier applies and DEFAULTS to "ruo" (fail-closed): a caller that
 *   passes no surface gets the full policy. "consumer" turns OFF the RUO-framing classes
 *   (benefit, humanUse) but keeps every HARD-FLOOR class (diseaseCure, regulatory, dosing,
 *   supplements).
 * @returns {Array<{file:string,line:number,cls:"diseaseCure"|"regulatory"|"dosing"|"supplements"|"benefit"|"humanUse",term:string,ctx:string}>}
 *   One entry per un-suppressed violation. Empty array = clean.
 */
export function lintText(text, { filePath = "", surface = "ruo" } = {}) {
  const ranges = allowRanges(text, filePath);
  const hits = [];
  for (const [cls, { surfaces, patterns }] of Object.entries(BANNED)) {
    if (!surfaces.includes(surface)) continue; // class does not apply on this surface (fail-closed: default 'ruo')
    for (const re of patterns) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      for (const m of text.matchAll(g)) {
        const start = m.index, end = m.index + m[0].length;
        if (inRange(ranges, start, end)) continue;
        if (negatedNearby(text, start)) continue;
        const ctx = text.slice(Math.max(0, start - 50), Math.min(text.length, end + 50)).replace(/\s+/g, " ").trim();
        hits.push({ file: filePath, line: lineOf(text, start), cls, term: m[0], ctx });
      }
    }
  }
  return hits;
}
