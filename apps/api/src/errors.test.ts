import { describe, expect, it } from 'vitest';
import { MatchError, failureFor } from './errors.js';

/**
 * A Durable Object rethrows on the calling side as a plain `Error`: the class
 * and any extra property is gone by the time the edge sees it. Only the
 * message survives, so these are the two cases that matter.
 */
describe('what the client is told about a failure', () => {
  it('keeps the status of a rejected request', () => {
    expect(failureFor(new MatchError('this is not your campaign', 403))).toEqual({
      status: 403,
      message: 'this is not your campaign',
    });
  });

  it('recovers the status after the error has crossed the object boundary', () => {
    const thrown = new MatchError('campaign already exists', 409);
    // What the caller actually catches: the message, and nothing else.
    expect(failureFor(new Error(thrown.message))).toEqual({ status: 409, message: 'campaign already exists' });
  });

  it('withholds anything that was not raised as a rejection', () => {
    expect(failureFor(new Error('D1_ERROR: no such table: leaderboard'))).toEqual({
      status: 500,
      message: 'the defence grid is offline',
    });
  });

  it('withholds a thrown non-error too', () => {
    expect(failureFor('boom').status).toBe(500);
  });
});
