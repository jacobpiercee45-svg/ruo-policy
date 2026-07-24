/**
 * RUO language policy — the single source of banned-term patterns and their
 * allowlisted exceptions. Plain ESM (not .ts) so BOTH consumers can import it:
 * the Node build-gate linter (scripts/ruo-lint.mjs) and site TS code (e.g. a
 * runtime chat post-filter) via the sibling ruo-policy.d.mts declaration.
 *
 * Three classes of violation, matching the compliance audit's taxonomy:
 *   dosing   — anything that reads as administration/consumption guidance
 *   benefit  — therapeutic/outcome claims (the FDA/FTC misbranding surface)
 *   humanUse — language that frames the products as for people
 *
 * The zod content schemas are the PRIMARY guard (claim fields don't exist);
 * these patterns are the backstop that scans the RENDERED site, so hand-written
 * .astro copy and generated text answer to the same policy.
 */

export const BANNED = {
  dosing: [
    /\b(dos(e|es|ed|age|ages|ing)|mg\s*\/\s*kg|mcg\s*\/\s*kg)\b/i,
    /\binject(s|ed|ing|ion|ions|able)?\b/i,
    /\badminist(er|ered|ering|ration)\b/i,
    /\btitrat(e|ed|ion|ing)\b/i,
    /\b(subcutaneous|intramuscular|intravenous)\b/i,
    /\btake\s+\w{0,20}\s*(daily|weekly|twice|nightly|before bed)\b/i,
    /\bcycle\s+(length|protocol)\b/i,
    /\bprotocols?\s+for\s+(use|using)\b/i,
  ],
  benefit: [
    /\b(cure|cures|cured|curing)\b/i,
    /\bheal(s|ed|ing)?\b/i,
    /\btherap(y|ies|eutic|eutics|eutically)\b/i,
    /\btreat(s|ed|ing|ment|ments)?\b/i,
    /\banti[-\s]?ag(e|ing)\b/i,
    /\b(fat|weight)[-\s]?loss\b/i,
    /\bmuscle\s+(growth|gain|building|mass)\b/i,
    /\b(boost|boosts|boosted|boosting)\b/i,
    /\bimprov(e|es|ed|ing|ement)\b/i,
    /\benhanc(e|es|ed|ing|ement)\b/i,
    /\b(reduc|lower)(e|es|ed|ing)?\s+(fat|weight|wrinkles|inflammation|pain)\b/i,
    /\b(longevity|life\s*extension|performance)\s+(benefit|effect)s?\b/i,
    /\bbenefits?\s+(of|for|include)\b/i,
    /\brecovery\s+(aid|support|benefit)s?\b/i,
    /\bwell-?being\b/i,
    /\brejuvenat(e|es|ed|ing|ion)\b/i,
  ],
  humanUse: [
    /\bpatients?\b/i,
    /\bclinical\s+use\b/i,
    /\bhuman\s+(use|application|supplementation)\b/i,
    /\bin\s+humans?\b/i,
    /\bfor\s+(people|men|women|athletes|bodybuilders)\b/i,
    /\bsupplements?\b/i,
    /\bself-?administ/i,
  ],
};

/**
 * Allowlisted phrases — a banned-term match INSIDE one of these phrase matches
 * is not a violation. Scoped by file pattern so legal/disclaimer text stays
 * permitted everywhere it legitimately appears without opening a site-wide hole.
 */
export const ALLOW = [
  // The canonical disclaimers themselves contain banned stems, negated:
  { file: /./, phrase: /not\s+(intended\s+)?(for|to)\s+(human|diagnose|treat|cure|prevent)[^.]{0,140}/gi },
  { file: /./, phrase: /not\s+for\s+human\s+(use|consumption)[^.]{0,60}/gi },
  { file: /./, phrase: /not\s+drugs?,?\s+foods?,?\s+supplements?[^.]{0,140}/gi },
  { file: /./, phrase: /no\s+(therapeutic|medical|clinical|benefit|human-use)\s+(claims?|guidance|advice)[^.]{0,80}/gi },
  // Learn/terms copy explaining WHAT RUO prohibits may name the prohibited things:
  { file: /(learn|terms|privacy|how-we-test|llms)/, phrase: /(cannot|must\s+not|may\s+not|prohibit(s|ed)?|does\s+not\s+(permit|provide|include|give)|never\s+(provides?|gives?|offers?))[^.]{0,180}/gi },
  // "in humans / human use" permitted only inside an explicit negation sentence:
  { file: /./, phrase: /\b(no|not|never|without)\b[^.]{0,100}\b(in\s+humans?|human\s+use)\b[^.]{0,60}/gi },
  // The FAQ literally asks the question so it can answer "No":
  { file: /./, phrase: /are\s+these\s+products\s+for\s+human\s+use\?/gi },
  // The FDA's name contains "Administration"; "not approved … for human use" is the negation:
  { file: /./, phrase: /food\s+and\s+drug\s+administration/gi },
  // [^.] would stop at the periods in "U.S." — bound by length + explicit tail instead:
  { file: /./, phrase: /not\s+approved\s+by.{0,140}?human\s+use/gi },
  // Terms misuse clause assigns responsibility for prohibited use — names it to prohibit it:
  { file: /terms/, phrase: /misuse[^.]{0,140}/gi },
  // Privacy policy's operational "improve the site/experience" language:
  { file: /privacy/, phrase: /improve\s+(our|the|your)\s+(website|site|experience)/gi },
  // Bibliographic citations: a published paper's real title/journal is a
  // verifiable fact we point to, not a claim we make (real titles carry stems
  // like "…as a Therapy…"). Scoped to citation field values only; these come
  // from controlled records with human sign-off (see plan risk note).
  // JSON source (compound records):
  { file: /compounds/, phrase: /"(?:title|journal)":\s*"[^"]*"/gi },
];

/**
 * A hit is also suppressed when a negator appears shortly before it in the same
 * sentence ("not intended to treat…", "we do not provide dosing…").
 */
export const NEGATORS = /\b(not|no|never|none|cannot|can't|won't|without|prohibit(s|ed)?|forbid(s|den)?)\b/i;
export const NEGATION_WINDOW = 60; // chars before the match to scan for a negator

/**
 * POLICY_VERSION — bumped on every rule change. The ops content gate compares
 * its bundled value against the canonical latest and disables auto-publish when
 * behind (fail-closed floor). Keep in sync with package.json "version".
 */
export const POLICY_VERSION = "1.0.0";
