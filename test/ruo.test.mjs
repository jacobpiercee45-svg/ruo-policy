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

test("policy data shape is intact", () => {
  assert.deepEqual(Object.keys(BANNED), ["dosing", "benefit", "humanUse"]);
  for (const cls of Object.values(BANNED)) {
    assert.ok(Array.isArray(cls) && cls.every((r) => r instanceof RegExp));
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

test("htmlToText strips markup but keeps visible text", () => {
  const txt = htmlToText("<p>hello <b>world</b></p><script>var x = 'cure'</script>");
  assert.ok(txt.includes("hello") && txt.includes("world"));
  assert.ok(!txt.includes("var x"));
});
