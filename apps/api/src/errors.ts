/** An error with the HTTP status the client should see. */
export class MatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
