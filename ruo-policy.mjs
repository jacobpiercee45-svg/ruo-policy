/**
 * RUO language policy — the single source of banned-term patterns and their
 * allowlisted exceptions. Plain ESM (not .ts) so BOTH consumers can import it:
 * the Node build-gate linter (scripts/ruo-lint.mjs) and site TS code (e.g. a
 * runtime chat post-filter) via the sibling ruo-policy.d.mts declaration.
 *
 * SURFACE dimension (v2). Each class declares the SURFACES it applies on:
 *   'ruo'      — storefront, /compounds/, all 7 social accounts. The DEFAULT
 *                (fail-closed): anything that does not pass an explicit surface
 *                is judged as 'ruo'. This is the full, unchanged v1 policy.
 *   'consumer' — blog only. Human-directed framing is PERMITTED (benefit +
 *                human-use), so those classes are OFF here — but the HARD FLOOR
 *                below still applies.
 *
 * Classes, by tier:
 *   HARD FLOOR (both surfaces, never relaxes):
 *     diseaseCure — disease-treatment / cure claims (carved out of v1 'benefit'
 *                   so relaxing benefit on 'consumer' can never relax cure/treat-
 *                   a-disease)
 *     regulatory  — references to the FDA, the 503A/BPC-157 review, or
 *                   compounding status (NEW in v2; applies to both surfaces)
 *     dosing      — administration/consumption guidance
 *     supplements — the DSHEA-regulated category term (carved out of v1
 *                   'humanUse'; a category claim, not mere human framing)
 *     efficacy    — a claimed RESULT in neutral vocabulary (NEW in v2.4): a
 *                   directional verb aimed at a biological object, or an
 *                   evidential frame pointed at one. Hard floor because a blog
 *                   asserting a proven outcome reads to an acquirer exactly as
 *                   the storefront doing it.
 *   RUO FRAMING ('ruo' only, relaxed on 'consumer'):
 *     benefit     — therapeutic/outcome claims (minus cure → diseaseCure)
 *     humanUse    — frames the products as for people (minus supplements)
 *
 * v1 behaviour is preserved on 'ruo': the union of every class on surface 'ruo'
 * reproduces the v1 verdict, EXCEPT for the intentional new hard-floor coverage
 * (regulatory; prevent/reverse-a-disease) — surfaced by the behavior-diff.
 *
 * The zod content schemas are the PRIMARY guard (claim fields don't exist);
 * these patterns are the backstop that scans the RENDERED site, so hand-written
 * .astro copy and generated text answer to the same policy.
 */

/** The surfaces a rule can apply on. 'ruo' is the fail-closed default. */
export const SURFACES = ["ruo", "consumer"];

/** Disease / condition objects — a treat/prevent/reverse near one of these is a
 *  disease-treatment claim (hard floor), distinct from a cosmetic "treats dullness". */
const DISEASE =
  "(?:disease|diseases|cancer|tumou?rs?|diabetes|arthritis|injur(?:y|ies)|wounds?|" +
  "inflammation|chronic\\s+pain|illness(?:es)?|disorders?|syndrome|infections?|" +
  "depression|anxiety|osteoporosis|neuropathy|fibrosis|ulcers?|hypertension|obesity)";

/** Biological objects that turn a directional verb into an outcome claim (v2.4).
 *  Distinct from DISEASE above: these are not conditions being treated, they are
 *  measurable things in a body that a claim asserts moved. */
const BIO_OBJECT =
  "(?:mitochondrial|telomere|telomerase|senescen\\w*|collagen|elastin|melanin|" +
  "growth\\s+hormone|igf-?1|glucose|insulin|appetite|adipos\\w*|lean\\s+mass|" +
  "muscle|bone\\s+density|skin|hair|wound|scar|angiogenes\\w*|neurogenes\\w*|" +
  "bdnf|cognition|memory|sleep|libido|energy|endurance|recovery|longevity|lifespan|" +
  "inflammat\\w*|oxidative|free\\s+radical|cell\\s+(?:death|survival|turnover))";

/** Verbs of directional change. Ordinary English on their own — see the
 *  `efficacy` class for why they are never matched alone. */
const DIRECTIONAL =
  "(?:increas(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|rais(?:e|es|ed)|lower(?:s|ed|ing)?|" +
  "restor(?:e|es|ed|ing)|stimulat(?:e|es|ed|ing)|accelerat(?:e|es|ed|ing)|reveres?|" +
  "promot(?:e|es|ed|ing)|optimis(?:e|es|ed)|optimiz(?:e|es|ed)|regenerat(?:e|es|ed|ing))";

export const BANNED = {
  // ── HARD FLOOR — applies on EVERY surface, never relaxes ──
  diseaseCure: {
    surfaces: ["ruo", "consumer"],
    patterns: [
      /\b(cure|cures|cured|curing)\b/i, // a cure claim is always hard floor
      // a treatment verb within a short same-sentence window of a disease object
      new RegExp(
        "\\b(?:treat(?:s|ed|ing|ment|ments)?|prevent(?:s|ed|ing|ion)?|revers(?:e|es|ed|ing)|" +
          "manag(?:e|es|ed|ing|ement)|remed(?:y|ies)|heal(?:s|ed|ing)?)\\b[^.!?\\n]{0,30}\\b" + DISEASE + "\\b",
        "i",
      ),
      new RegExp("\\b" + DISEASE + "\\b[^.!?\\n]{0,30}\\b(?:treatment|cure|therapy|remedy)\\b", "i"),
    ],
  },
  regulatory: {
    surfaces: ["ruo", "consumer"],
    patterns: [
      /\bFDA\b/, // the agency (acronym; case-sensitive — always uppercase)
      /\bfood\s+and\s+drug\s+administration\b/i,
      /\b503\s?[AB]\b/, // 503A / 503B compounding pathways — where the BPC-157 review sits
      /\bcompound(?:ed|ing)\b/i, // compounding STATUS — not "compound(s)", the product noun
      /\b(?:approved|cleared|evaluated|reviewed)\s+by\s+the\s+(?:fda|food\s+and\s+drug\s+administration)\b/i,
      /\bBPC[-\s]?157\b[^.!?\n]{0,40}\b(?:503\s?a|compound(?:ed|ing)|fda|review(?:s|ed|ing)?)\b/i,
    ],
  },
  dosing: {
    surfaces: ["ruo", "consumer"], // administration guidance stays banned on consumer (approved)
    patterns: [
      /\b(dos(e|es|ed|age|ages|ing)|mg\s*\/\s*kg|mcg\s*\/\s*kg)\b/i,
      /\binject(s|ed|ing|ion|ions|able)?\b/i,
      /\badminist(er|ered|ering|ration)\b/i,
      /\btitrat(e|ed|ion|ing)\b/i,
      /\b(subcutaneous|intramuscular|intravenous)\b/i,
      /\btake\s+\w{0,20}\s*(daily|weekly|twice|nightly|before bed)\b/i,
      /\bcycle\s+(length|protocol)\b/i,
      /\bprotocols?\s+for\s+(use|using)\b/i,
      // Amount + frequency, as one instruction (v2.3 — Defect 5). The literal
      // tokens "dose"/"dosage" are absent from "250 mcg twice daily", so every
      // policy through v2.2 read that as clean. The amount and the frequency
      // must sit within ~6 intervening tokens of each other: a bare spec figure
      // ("5 mg vial") and a schedule word elsewhere in the same paragraph are
      // NOT an instruction, and joining them at any distance would fire on the
      // catalogue. `ml` is included because reconstitution volumes carry it.
      // The gap excludes . ! ? and newline so the two halves must be in ONE
      // sentence — otherwise "5 mg vial. Shipping is weekly" reads as a dose.
      new RegExp(
        "\\b\\d+(?:\\.\\d+)?\\s*(?:mcg|mg|iu|ml)\\b(?:[^.!?\\n\\w]+\\w+){0,6}?[^.!?\\n\\w]+" +
          "(?:daily|twice|weekly|per\\s+day|every\\s+\\d+)\\b",
        "i",
      ),
      // Preparation-for-use instruction. Deliberately the VERB form only:
      // "reconstitution" (the noun) names the calculator and the learn page and
      // is not itself guidance — it appears 28x across the compound records.
      // NOTE: "bacteriostatic water" is deliberately NOT banned. It is a sold
      // SKU (bacteriostatic-water-2ml/-10ml/-10pack-2ml, category "Lab
      // accessory"); as a flat token it produced 42 storefront false positives,
      // and no instructional frame separates the product from the instruction
      // ("Add to cart", "Bacteriostatic Water — 2 ml"). The guidance it was
      // meant to catch is already covered by `reconstitute` + amount/frequency.
      /\breconstitute\b/i,
    ],
  },
  supplements: {
    surfaces: ["ruo", "consumer"], // DSHEA category term — hard floor even on consumer (approved)
    patterns: [/\bsupplements?\b/i],
  },
  // Efficacy claims made in NEUTRAL vocabulary (v2.4 — upstreamed from the
  // storefront's local layer, where it ran as six ad-hoc rules from 2026-08-31).
  //
  // `benefit` catches the benefit VOCABULARY well: improve, enhance, boost,
  // heal, therapeutic, and reduce/lower against a fixed object list. What it
  // never caught is the same claim with a neutral verb and an arbitrary object:
  //
  //     "research shows it increases mitochondrial density"
  //     "studies demonstrate a decrease in senescent cell burden"
  //     "shown to restore telomere length"
  //
  // Every one of those passed v2.3 clean. None contains a banned word. All three
  // are efficacy claims, which is the specific thing that makes a peptide
  // merchant account unbankable — an acquirer reading the page sees a product
  // being sold for an outcome.
  //
  // HARD FLOOR, on both surfaces, and that is the point of upstreaming it. The
  // consumer relaxation exists so a blog may address a person and name a
  // benefit; it was never meant to permit asserting a PROVEN RESULT. A blog post
  // lives on the selling origin and an acquirer reads it as the storefront's own
  // voice, so "research proves it increases collagen" is closer to `diseaseCure`
  // than to "benefits of". Scoping this to `ruo` would leave the ops content
  // engine — whose drafts are judged as `consumer` — without the check.
  //
  // Fires on the FRAME, not the vocabulary. Both halves are always required.
  efficacy: {
    surfaces: ["ruo", "consumer"],
    patterns: [
      // THE PRECISE ONE, and the rule that carries this class: a directional
      // verb aimed at a biological object, in a single sentence. "increases
      // collagen", "restores telomere length", "promotes wound closure".
      // DIRECTIONAL alone is ordinary English and appears in real mechanism
      // prose ("binding increases with pH"), so the object is what makes it a
      // claim about a result in a body.
      new RegExp("\\b" + DIRECTIONAL + "\\b[^.!?\\n]{0,30}\\b" + BIO_OBJECT + "\\b", "i"),
      // The same claim with the object first: "collagen synthesis is increased".
      new RegExp("\\b" + BIO_OBJECT + "\\b[^.!?\\n]{0,30}\\b(?:is|are|was|were)\\s+" + DIRECTIONAL + "\\b", "i"),
      // An evidential frame is NOT flagged on its own, and that is deliberate.
      // Describing what published literature examines is the entire content
      // strategy — "research indicates that MOTS-c translocates to the nucleus"
      // is mechanism, is correct, and must stay. The first draft of this rule
      // fired on exactly that sentence in the live MOTS-c post. What is flagged
      // is an evidential frame POINTED AT AN OUTCOME: the frame and a
      // directional verb in the same sentence.
      new RegExp(
        "\\b(?:research|studies|study|trials?|data|evidence)\\b[^.!?\\n]{0,40}" +
          "\\b(?:show(?:s|n|ed)?|demonstrat(?:e|es|ed)|prov(?:e|es|en)|confirm(?:s|ed)?)\\b" +
          "[^.!?\\n]{0,40}\\b" + DIRECTIONAL + "\\b",
        "i",
      ),
      // Pure marketing frames. No mechanism prose says "clinically proven".
      /\b(?:clinically|scientifically)\s+(?:proven|validated)\b/i,
      /\bbefore\s*(?:\/|and|&|-)\s*after\b/i,
      /\b(?:results?|outcomes?)\s+(?:you\s+can\s+)?(?:expect|see|achieve)\b/i,
    ],
  },
  // ── RUO FRAMING — 'ruo' only; PERMITTED on 'consumer' ──
  benefit: {
    surfaces: ["ruo"],
    patterns: [
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
      /\bentertainment\s+purposes\b/i, // RUO storefront is not "entertainment" (v2.2 — Defect 3)
    ],
  },
  humanUse: {
    surfaces: ["ruo"],
    patterns: [
      /\bpatients?\b/i,
      /\bclinical\s+use\b/i,
      /\bhuman\s+(use|application|supplementation)\b/i,
      /\bin\s+humans?\b/i,
      /\bfor\s+(people|men|women|athletes|bodybuilders)\b/i,
      /\bself-?administ/i,
      // Clinical-oversight framing — implies a medical/telemedicine pathway (v2.2 — Defect 3, semax).
      /\btelemedicine\b/i,
      /\b(licensed|qualified)\s+(provider|clinician|physician|practitioner|healthcare\s+professional)\b/i,
      /\bmedical\s+(oversight|supervision)\b/i,
      /\bunsupervised\s+use\b/i,
      /\bregimens?\b/i,
      /\b(individual|personal)(ized)?\s+health\s+(profile|history)\b/i,
      // Telemedicine synonyms (v2.3 — Defect 6). v2.2 shipped `telemedicine`
      // alone, so the same pathway described in any other words passed clean.
      /\btele-?health\b/i,
      /\bvirtual\s+provider\b/i,
      /\bonline\s+clinic\b/i,
      /\bprescribers?\b/i,
    ],
  },
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
  // Defense in depth for the `regulatory` class: the RUO non-approval disclaimer
  // legitimately NAMES the FDA to disclaim it. Permit the acronym ONLY inside the negated
  // "not {approved/evaluated/reviewed/cleared/endorsed} by … (FDA)" frame (cross-line
  // tolerant, covers the parenthetical acronym). Affirmative references ("FDA-cleared",
  // "the FDA is reviewing") sit OUTSIDE this frame and still fire.
  { file: /./, phrase: /\bnot\s+(?:approved|evaluated|reviewed|cleared|endorsed)\s+by[\s\S]{0,100}?\(?\bFDA\b\)?/gi },
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
  // CONSUMER surface ONLY (v2.1): answering the top consumer question "Is X a dietary
  // supplement?" in the negative is DEFINING AGAINST the DSHEA category, not claiming it —
  // and that's good positioning. Suppress `supplement` ONLY inside an interrogative that is
  // answered "no/not …" AND rebutted by category (research compound / not a … / dietary
  // supplement / nutraceutical / drug / food). Affirmative or presuppositional uses ("take
  // this supplement", "is this supplement safe? No, consult…") lack the rebuttal frame and
  // still FIRE. `surface: "consumer"` ⇒ RUO surface is completely unaffected.
  {
    surface: "consumer",
    file: /./,
    phrase:
      /\b(?:is|are)\s+[^.?!]{0,60}?\bsupplements?\b[^?]{0,10}\?\s+(?:no\b|not\b)[\s\S]{0,140}?\b(?:research\s+(?:compound|chemical|peptide)|not\s+(?:a|an|classified|intended)|dietary\s+supplement|nutraceutical|drug|food)\b/gi,
  },
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
export const POLICY_VERSION = "2.4.0";
