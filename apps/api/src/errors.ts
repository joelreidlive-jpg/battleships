/**
 * An error with the HTTP status the client should see.
 *
 * The status travels inside the message. A Durable Object rethrows on the
 * calling side as a plain `Error` — class and extra properties are lost — so
 * anything the edge needs has to survive as text.
 */
export class MatchError extends Error {
  /** The message without the status tag, which is what the client is told. */
  readonly detail: string;

  constructor(message: string, readonly status: number) {
    super(`[${status}] ${message}`);
    this.name = 'MatchError';
    this.detail = message;
  }
}

const TAGGED = /^\[(\d{3})\]\s([\s\S]*)$/;

export interface Failure {
  readonly status: number;
  readonly message: string;
}

/**
 * What to tell the client about a thrown error. Anything not raised as a
 * `MatchError` is a fault rather than a rejected request: it is reported as a
 * 500 and its message is withheld, because unhandled messages carry internals
 * — D1 said which table is missing, and the client does not need to know.
 */
export function failureFor(error: unknown): Failure {
  if (error instanceof MatchError) return { status: error.status, message: error.detail };
  const tagged = error instanceof Error ? TAGGED.exec(error.message) : null;
  if (tagged) return { status: Number(tagged[1]), message: tagged[2] };
  return { status: 500, message: 'the defence grid is offline' };
}
