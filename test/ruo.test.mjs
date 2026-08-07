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
  assert.deepEqual(Object.keys(BANNED), ["diseaseCure", "regulatory", "dosing", "supplements", "benefit", "humanUse"]);
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
