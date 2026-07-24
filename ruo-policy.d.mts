/**
 * Type surface for the shared ruo-policy package. Covers the policy data
 * (./policy subpath and re-exported from the root) plus the evaluator that the
 * storefront build gate and the ops compliance gate both call.
 */
export declare const BANNED: Record<"dosing" | "benefit" | "humanUse", RegExp[]>;
export declare const ALLOW: { file: RegExp; phrase: RegExp }[];
export declare const NEGATORS: RegExp;
export declare const NEGATION_WINDOW: number;
export declare const POLICY_VERSION: string;

export type RuoClass = "dosing" | "benefit" | "humanUse";

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

/** Evaluate already-extracted text against the RUO policy. Empty array = clean. */
export declare function lintText(
  text: string,
  opts?: { filePath?: string },
): RuoHit[];
