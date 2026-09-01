# ruo-policy

The **single shared Research-Use-Only (RUO) compliance standard**. One versioned
source of truth, imported by every consumer so there is never a second, weaker copy.

- **`ruo-policy.mjs`** — the policy *data*: `BANNED` (diseaseCure / regulatory /
  dosing / supplements / efficacy / benefit / humanUse patterns), `ALLOW`
  (file-scoped allowlist), `NEGATORS`, `NEGATION_WINDOW`, and `POLICY_VERSION`.
- **`index.mjs`** — the *evaluator*: `lintText(text, { filePath })` +
  `htmlToText(html)`. Pure (no fs / network / clock) so it runs identically in
  Node, a Deno edge function, and tests.

## Consumers

| Consumer | How it imports |
| --- | --- |
| ouralus storefront build gate (`scripts/ruo-lint.mjs`) | walks `dist/` + `src`, calls `lintText()` per file |
| ops content-engine compliance gate | calls `lintText()` on each generated draft before it can be queued to publish |

The ops gate composes a **stricter pet/animal overlay on top** of this base — it
only ever *adds* bans, never relaxes one.

## Versioning & the fail-closed floor

`POLICY_VERSION` (kept in sync with `package.json` `version` — a test enforces
this) is the contract behind the ops gate's **fail-closed version floor**: when
the ops gate's bundled `POLICY_VERSION` is behind the canonical latest, it
**disables auto-publish** and routes everything to the human queue. A stale pin
can never silently ship something the storefront would now block.

Tighten the policy → bump the version → consumers pin the new tag. Never lower a
consumer's pin below the storefront's current floor.

## Test

```
npm test   # node --test
```
