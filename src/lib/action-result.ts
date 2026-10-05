/** What every server action returns — never throws to the client. */
export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string> };
export type ActionSuccess<T> = { ok: true; data: T; message?: string };
export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function fail(error: string, fieldErrors?: Record<string, string>): ActionFailure {
  return { ok: false, error, fieldErrors };
}
