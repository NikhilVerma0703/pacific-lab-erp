/** Read a nested error message from React Hook Form's error tree by dotted path ("bodies.0.postPress.l"). */
export function errorAt(errors: unknown, path: string): string | undefined {
  let cur: unknown = errors;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  const msg = (cur as { message?: unknown } | undefined)?.message;
  return typeof msg === "string" ? msg : undefined;
}
