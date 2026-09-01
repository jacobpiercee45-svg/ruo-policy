import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BANNED,
  ALLOW,
  NEGATORS,
  NEGATION_WINDOW,
  POLICY_VERSION,
  htmlToText,
  lintText,
} from "../index.mjs";

test("policy data shape is intact (surface-tiered)", () => {
  assert.deepEqual(Object.keys(BANNED), ["diseaseCure", "regulatory", "dosing", "supplements", "efficacy", "benefit", "humanUse"]);
  for (const { surfaces, patterns } of Object.values(BANNED)) {
    assert.ok(Array.isArray(surfaces) && surfaces.length > 0 && surfaces.every((s) => s === "ruo" || s === "consumer"));
    assert.ok(Array.isArray(patterns) && patterns.every((r) => r instanceof RegExp));
  }
  assert.ok(Array.isArray(ALLOW) && ALLOW.every((a) => a.file instanceof RegExp && a.phrase instanceof RegExp));
  assert.ok(NEGATORS instanceof RegExp);
  assert.equal(NEGATION_WINDOW, 60);
});

test("POLICY_VERSION matches package.json version (fail-closed floor depends on this)", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(POLICY_VERSION, pkg.version);
});

test("flags a bare dosing claim", () => {
  const hits = lintText("Inject 5mg/kg subcutaneous twice weekly.", { filePath: "draft" });
  assert.ok(hits.some((h) => h.cls === "dosing"));
});

test("flags a bare benefit claim", () => {
  const hits = lintText("Clinically proven to cure inflammation and boost recovery.", { filePath: "draft" });
  assert.ok(hits.some((h) => h.cls === "benefit"));
});

test("flags human-use framing", () => {
  const hits = lintText("Perfect supplement for athletes and bodybuilders.", { filePath: "draft" });
  assert.ok(hits.some((h) => h.cls === "humanUse"));
});

test("suppresses a same-sentence negated disclaimer", () => {
  const hits = lintText("This product is not intended to treat, cure, or prevent any disease.", { filePath: "draft" });
  assert.deepEqual(hits, []);
});

test("suppresses an allowlisted universal disclaimer phrase", () => {
  const hits = lintText("Not for human use or consumption.", { filePath: "draft" });
  assert.deepEqual(hits, []);
});

test("a social draft (filePath 'draft') does NOT inherit legal-page allowances", () => {
  // The `terms`-scoped ALLOW for "misuse …" must not apply to a generated post.
  const onTerms = lintText("Any misuse of the product is the buyer's responsibility.", { filePath: "terms" });
  const onDraft = lintText("Any misuse of the product is the buyer's responsibility.", { filePath: "draft" });
  // (No banned stem here, so both are clean — this asserts the scoping mechanism,
  //  not a specific verdict: file-scoped ALLOW entries key off filePath.)
  assert.deepEqual(onTerms, []);
  assert.deepEqual(onDraft, []);
});

test("clean copy yields no hits", () => {
  const hits = lintText("Sold for laboratory research only. Not for human use.", { filePath: "draft" });
  assert.deepEqual(hits, []);
});

// ── surface dimension (v2) ─────────────────────────────────────────
test("surface defaults to 'ruo' (fail-closed): no surface == the full policy", () => {
  const t = "Boosts recovery in humans.";
  assert.deepEqual(
    lintText(t, { filePath: "draft" }).map((h) => h.cls).sort(),
    lintText(t, { filePath: "draft", surface: "ruo" }).map((h) => h.cls).sort(),
  );
  assert.ok(lintText(t, { filePath: "draft" }).length > 0);
});

test("consumer relaxes RUO framing (benefit + humanUse) but keeps every hard-floor class", () => {
  const permitted = "This boosts recovery and improves performance for people.";
  assert.deepEqual(lintText(permitted, { filePath: "draft", surface: "consumer" }), []);
  const floor = "Treats cancer. Sold as supplements. Injected weekly. The FDA is reviewing it under 503A. Compounding pending.";
  const cls = new Set(lintText(floor, { filePath: "draft", surface: "consumer" }).map((h) => h.cls));
  for (const c of ["diseaseCure", "supplements", "dosing", "regulatory"]) assert.ok(cls.has(c), `expected ${c} on consumer`);
  assert.ok(!cls.has("benefit") && !cls.has("humanUse"), "benefit/humanUse must be OFF on consumer");
});

// ── negation window: abbreviation-aware sentence boundaries ─────────
for (
  const [label, text] of [
    ["U.S.", "This product is not approved by the U.S. Food and Drug Administration (FDA) for human use."],
    ["e.g.", "Not for use, e.g. in humans."],
    ["Inc.", "Not sold by Acme Inc. for human use."],
  ]
) {
  test(`negation survives an abbreviation period (${label})`, () => {
    assert.deepEqual(lintText(text, { filePath: "draft", surface: "ruo" }), []);
  });
}

test("a TRUE sentence boundary still splits — no fail-open across sentences", () => {
  // The prior sentence's negator must NOT suppress a term in the next sentence.
  const hits = lintText("It is not a drug. This treats cancer.", { filePath: "draft", surface: "ruo" });
  assert.ok(hits.some((h) => h.cls === "diseaseCure"));
});

// ── regulatory class + scoped FDA disclaimer allowance ─────────────
test("affirmative FDA / 503A / compounding references FIRE as regulatory", () => {
  const hits = lintText("FDA-cleared; the FDA is reviewing BPC-157 under 503A; compounding available.", { filePath: "draft", surface: "ruo" });
  assert.ok(new Set(hits.map((h) => h.cls)).has("regulatory"));
  assert.ok(hits.some((h) => /fda/i.test(h.term)));
});

test("the RUO non-approval disclaimer NAMING the FDA is allowlisted (not a regulatory hit)", () => {
  const hits = lintText("Our products are not approved by the U.S. Food and Drug Administration (FDA) for human use.", { filePath: "terms" });
  assert.ok(!hits.some((h) => h.cls === "regulatory"), "FDA in the non-approval disclaimer must not fire");
});

// ── consumer-only supplement negation allowance (v2.1) ─────────────
const suppCount = (t, surface) => lintText(t, { filePath: "draft", surface }).filter((h) => h.cls === "supplements").length;

test("consumer: 'Is X a dietary supplement? No … research compound' is allowed", () => {
  const t = "Is GHK-Cu considered a dietary supplement?\nNo. GHK-Cu is a research compound and is not classified as a dietary supplement, vitamin, or nutraceutical.";
  assert.equal(suppCount(t, "consumer"), 0, "definitional-negated supplement question must pass on consumer");
});

test("consumer: affirmative / presuppositional supplement uses STILL fire", () => {
  assert.ok(suppCount("Take this supplement daily for the best results.", "consumer") >= 1);
  assert.ok(suppCount("Our premium peptide supplement is third-party tested.", "consumer") >= 1);
  // A question NOT rebutted by category ("No" about safety, not about being a supplement):
  assert.ok(suppCount("Is this supplement safe? No, always consult a provider first.", "consumer") >= 1);
});

test("RUO surface is UNCHANGED by the consumer allowance (fails identically)", () => {
  const t = "Is GHK-Cu considered a dietary supplement?\nNo. GHK-Cu is a research compound and is not classified as a dietary supplement.";
  assert.ok(suppCount(t, "ruo") >= 1, "the same text still fires supplements on ruo");
  // and the surface-less default (fail-closed ⇒ ruo) also still fires
  assert.ok(lintText(t, { filePath: "draft" }).some((h) => h.cls === "supplements"));
});

test("the existing negated supplement disclaimer still passes on ruo (allowance is additive)", () => {
  const hits = lintText("Not drugs, foods, supplements, or medical devices.", { filePath: "draft", surface: "ruo" });
  assert.ok(!hits.some((h) => h.cls === "supplements"));
});

test("htmlToText strips markup but keeps visible text", () => {
  const txt = htmlToText("<p>hello <b>world</b></p><script>var x = 'cure'</script>");
  assert.ok(txt.includes("hello") && txt.includes("world"));
  assert.ok(!txt.includes("var x"));
});

// ── dosing: amount + frequency constructions (v2.3) ────────────────
for (
  const text of [
    "250 mcg twice daily",
    "Take 250 mcg twice daily for eight weeks.",
    "0.5 mg per day",
    "2 mg every 3 days",
    "10 iu weekly",
    "Draw 1 ml daily.",
  ]
) {
  test(`amount+frequency fires as dosing: ${JSON.stringify(text)}`, () => {
    assert.ok(lintText(text, { filePath: "draft" }).some((h) => h.cls === "dosing"));
  });
}

test("amount+frequency does NOT cross a sentence boundary", () => {
  // A spec figure and an unrelated schedule word in the NEXT sentence are not
  // an instruction. This is the regression the ~6-token gap alone did not stop.
  const hits = lintText("Supplied as a 5 mg vial. Shipping is weekly.", { filePath: "draft" });
  assert.deepEqual(hits.filter((h) => h.cls === "dosing"), []);
});

test("a bare catalogue spec figure stays clean", () => {
  for (const t of ["Each vial contains 10 mg of peptide.", "Semax 5 mg vial, lyophilised powder."]) {
    assert.deepEqual(lintText(t, { filePath: "draft" }).filter((h) => h.cls === "dosing"), []);
  }
});

test("the preparation-for-use verb fires as dosing", () => {
  const hits = lintText("Reconstitute with 2 mL bacteriostatic water.", { filePath: "draft" });
  const terms = hits.filter((h) => h.cls === "dosing").map((h) => h.term.toLowerCase());
  assert.ok(terms.some((t) => t === "reconstitute"));
});

test("'bacteriostatic water' is NOT banned — it is a sold SKU, not guidance", () => {
  // Flat-token banning produced 42 storefront false positives across the
  // catalogue, checkout, llms.txt and the reconstitution calculator.
  for (const t of [
    "Bacteriostatic Water \u2014 2 ml",
    "Add to cart: Bacteriostatic Water",
    "Peptides are commonly dissolved in bacteriostatic water.",
  ]) {
    assert.deepEqual(lintText(t, { filePath: "draft" }).filter((h) => h.cls === "dosing"), []);
  }
});

test("the reconstitution NOUN is not guidance and stays clean", () => {
  // /tools/reconstitution-calculator/ and /learn/reconstitution-for-research/
  // are page names, not instructions — the verb form is what we ban.
  for (const t of ["Reconstitution calculator", "Our reconstitution guide for researchers"]) {
    assert.deepEqual(lintText(t, { filePath: "draft" }).filter((h) => h.cls === "dosing"), []);
  }
});

test("dosing amount+frequency is hard floor (fires on consumer too)", () => {
  assert.ok(lintText("250 mcg twice daily", { filePath: "draft", surface: "consumer" }).some((h) => h.cls === "dosing"));
});

// ── humanUse: telemedicine synonyms (v2.3) ─────────────────────────
for (const text of ["telehealth", "tele-health", "virtual provider", "online clinic", "prescriber", "prescribers"]) {
  test(`telemedicine synonym fires as humanUse: ${JSON.stringify(text)}`, () => {
    assert.ok(lintText(text, { filePath: "draft" }).some((h) => h.cls === "humanUse"));
  });
}

test("telemedicine synonyms are RUO-framing (OFF on consumer, like telemedicine itself)", () => {
  for (const t of ["telehealth", "virtual provider", "online clinic", "prescriber"]) {
    assert.deepEqual(lintText(t, { filePath: "draft", surface: "consumer" }).filter((h) => h.cls === "humanUse"), []);
  }
});

test("negation still suppresses the new humanUse synonyms", () => {
  assert.deepEqual(
    lintText("We do not operate a telehealth service or employ a prescriber.", { filePath: "draft" })
      .filter((h) => h.cls === "humanUse"),
    [],
  );
});

/* ---------------------------------------------------------------------------
 * efficacy (v2.4) — upstreamed from the ouralus storefront's local layer.
 *
 * The corpus below IS the acceptance criterion the local rules were tuned
 * against on 2026-08-31 and never committed anywhere. It is committed here now,
 * because the whole failure mode of this class is a rule that over-fires on
 * mechanism prose and gets loosened by whoever hits it next.
 * ------------------------------------------------------------------------- */

// Neutral-vocabulary efficacy claims. Every one of these passed v2.3 CLEAN.
const EFFICACY_BAD = [
  "Research shows it increases mitochondrial density.",
  "Studies demonstrate a decrease in senescent cell burden.",
  "Shown to restore telomere length in treated cultures.",
  "Collagen synthesis is increased after exposure.",
  "Clinically proven for skin firmness.",
  "See the before and after gallery.",
  "The results you can expect from a full cycle.",
];

// Legitimate mechanism prose that MUST stay clean. The first draft of the
// evidential rule fired on the MOTS-c line in a live post; it is the regression.
const EFFICACY_GOOD = [
  "Research indicates that MOTS-c translocates to the nucleus.",
  "Binding increases with pH across the tested range.",
  "The peptide associates with cardiolipin at the inner mitochondrial membrane.",
];

for (const line of EFFICACY_BAD) {
  test(`efficacy: flags ${JSON.stringify(line)}`, () => {
    const hits = lintText(line, { filePath: "draft" });
    assert.ok(hits.some((h) => h.cls === "efficacy"), "expected an efficacy hit");
  });
}

for (const line of EFFICACY_GOOD) {
  test(`efficacy: leaves mechanism prose clean — ${JSON.stringify(line)}`, () => {
    const hits = lintText(line, { filePath: "draft" });
    assert.deepEqual(hits, [], `expected clean, got ${hits.map((h) => `${h.cls}:${h.term}`).join(", ")}`);
  });
}

test("efficacy is a HARD FLOOR — it applies on the consumer surface too", () => {
  // The reason for upstreaming: the ops content engine judges blog drafts as
  // 'consumer'. Scoping this class to 'ruo' would leave the engine without it.
  for (const line of EFFICACY_BAD) {
    const hits = lintText(line, { filePath: "draft", surface: "consumer" });
    assert.ok(hits.some((h) => h.cls === "efficacy"), `consumer surface missed: ${line}`);
  }
});

test("efficacy: a directional verb alone is ordinary English and never fires", () => {
  // Both halves are always required. This is what keeps mechanism prose usable.
  for (const line of ["Solubility increases in warm buffer.", "The signal decreased over time."]) {
    assert.deepEqual(lintText(line, { filePath: "draft" }), []);
  }
});

test("efficacy: a negated claim is suppressed like every other class", () => {
  // Inherited from lintText's negation window — the local line-scanner had no
  // such suppression, so this is behaviour GAINED by upstreaming.
  const hits = lintText("The compound does not increase collagen density.", { filePath: "draft" });
  assert.ok(!hits.some((h) => h.cls === "efficacy"));
});
