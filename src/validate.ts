/**
 * Runtime validator for {@link EventProperties}.
 *
 * The compile-time type covers most consumers, but it can be bypassed
 * (`as any`, plain JavaScript callers, dynamic data from `JSON.parse`).
 * This module is the runtime safety net that fails loudly when an
 * unsupported shape is about to be sent to the server.
 *
 * Allowed value shapes:
 * - scalar:        `string | number | boolean | null`
 * - scalar array:  `(string | number | boolean | null)[]`
 *
 * Anything else (objects, nested arrays, `undefined`, functions, symbols,
 * `NaN`, `Infinity`) throws synchronously with a message that names the
 * bad key, the position in the array, and the calling method.
 */

import type { EventProperties } from "./types.js";

function isScalar(v: unknown): boolean {
  if (v === null) return true;
  const t = typeof v;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") {
    // JSON.stringify silently turns NaN / ±Infinity into the literal `null`,
    // which would corrupt downstream queries. Reject up front.
    return Number.isFinite(v as number);
  }
  return false;
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number" && !Number.isFinite(v)) return String(v); // NaN / Infinity
  return typeof v;
}

/**
 * Validates a properties object before it is enqueued or sent.
 *
 * @param props  - The properties to validate. Mutates nothing.
 * @param method - The public method name calling the validator
 *                 (`"track"` or `"identify"`). Included in error
 *                 messages to make debugging painless.
 *
 * @throws {Error} If any value (or array element) is not a JSON-safe scalar.
 */
export function validateProperties(props: EventProperties, method: string): void {
  for (const key of Object.keys(props)) {
    const value = (props as Record<string, unknown>)[key];

    if (isScalar(value)) continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (isScalar(item)) continue;
        throw new Error(
          `[tgram-analytics] TGA.${method}(): properties[${JSON.stringify(key)}][${i}] must be a string, number, boolean, or null — got ${describe(item)}. Arrays may only contain scalar primitives; objects, nested arrays, undefined, NaN, and Infinity are not allowed.`,
        );
      }
      continue;
    }

    throw new Error(
      `[tgram-analytics] TGA.${method}(): properties[${JSON.stringify(key)}] must be a scalar (string, number, boolean, null) or an array of scalars — got ${describe(value)}.`,
    );
  }
}
