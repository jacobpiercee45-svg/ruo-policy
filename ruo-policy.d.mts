/**
 * Type surface for the shared ruo-policy package. Covers the policy data
 * (./policy subpath and re-exported from the root) plus the evaluator that the
 * storefront build gate and the ops compliance gate both call.
 */
/** The surfaces a rule can apply on. "ruo" is the fail-closed default. */
export type Surface = "ruo" | "consumer";

export type RuoClass =
  | "diseaseCure"
  | "regulatory"
  | "dosing"
  | "supplements"
  | "benefit"
  | "humanUse";

/** Each class declares the surfaces it applies on plus its banned-term patterns. */
export declare const BANNED: Record<RuoClass, { surfaces: Surface[]; patterns: RegExp[] }>;
export declare const SURFACES: Surface[];
export declare const ALLOW: { file: RegExp; phrase: RegExp; surface?: Surface }[];
export declare const NEGATORS: RegExp;
export declare const NEGATION_WINDOW: number;
export declare const POLICY_VERSION: string;

export interface RuoHit {
  /** filePath passed by the caller (drives ALLOW file-scoping). */
  file: string;
  /** 1-based line number of the match within `text`. */
  line: number;
  cls: RuoClass;
  /** The matched substring. */
  term: string;
  /** ±50 chars of surrounding context, whitespace-collapsed. */
  ctx: string;
}

/** Strip tags/scripts from HTML so only visible text + JSON-LD is judged. */
export declare function htmlToText(html: string): string;

/**
 * Evaluate already-extracted text against the RUO policy. Empty array = clean.
 * `surface` selects the class tier and DEFAULTS to "ruo" (fail-closed): "consumer"
 * turns off the RUO-framing classes (benefit, humanUse) but keeps every hard-floor
 * class (diseaseCure, regulatory, dosing, supplements).
 */
export declare function lintText(
  text: string,
  opts?: { filePath?: string; surface?: Surface },
): RuoHit[];
