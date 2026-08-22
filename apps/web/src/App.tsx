import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HULLS,
  type Placement,
  STRAPLINE,
  type Side,
  TOTAL_SECTIONS,
  formatCell,
} from '@bs/rules';
import type { LeaderboardResponse, MatchView, ProgressResponse } from '@bs/protocol';
import { Board } from './Board.js';
import { Briefing } from './Briefing.js';
import { type Commission, saveCommission, storedCommission } from './commission.js';
import { Deploy } from './Deploy.js';
import { DOCTRINE_LABEL } from './doctrine.js';
import { Flypast } from './Flypast.js';
import { Manual } from './Manual.js';
import { ALIEN_PAUSE_MS, beforeReply } from './pace.js';
import { Portrait, type Reaction } from './Portrait.js';
import * as api from './api.js';
import * as sound from './sound.js';

/** How long a raised fist or a laugh holds before the portrait settles. */
const REACTION_MS = 3200;

/** Exchanges kept on screen: enough to read the last volley, no more. */
const LOG_LINES = 3;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function App() {
  const [match, setMatch] = useState<MatchView | null>(null);
  const [career, setCareer] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [commission, setCommission] = useState<Commission | null>(storedCommission);
  const [mute, setMute] = useState(sound.muted);
  /** Set when a campaign ends, cleared once the flypast has run. */
  const [flypast, setFlypast] = useState<{ readonly won: boolean; readonly highScore: boolean } | null>(null);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [reaction, setReaction] = useState<Reaction>('none');
  /** Log entries already sounded, so a re-render never replays an explosion. */
  const heard = useRef(0);

  const dismissFlypast = useCallback(() => setFlypast(null), []);

  const refreshCareer = useCallback(() => {
    if (!api.playerToken()) return;
    api.progress().then(setCareer).catch(() => undefined);
  }, []);

  useEffect(refreshCareer, [refreshCareer]);
  useEffect(() => sound.primeVoices(), []);

  /**
   * One bang per side per exchange, plus the heavier callout when a hull dies
   * and the warning when only one of ours is left. Order is all that is set
   * here: the sound channel holds each cue until the one before it has
   * finished, across exchanges as well as within one.
   */
  const announce = (view: MatchView) => {
    const fresh = view.log.filter((entry) => entry.seq > heard.current);
    heard.current = view.log.reduce((max, entry) => Math.max(max, entry.seq), heard.current);
    const outcome = (side: Side) => {
      const entries = fresh.filter((entry) => entry.side === side);
      if (entries.some((entry) => entry.outcome === 'sunk')) return 'sunk';
      return entries.some((entry) => entry.outcome === 'hit') ? 'hit' : 'none';
    };

    const earth = outcome('earth');
    if (earth === 'sunk') sound.playAlienHullLost();
    else if (earth === 'hit') sound.playDirectHit();

    const alien = outcome('alien');
    if (alien === 'sunk') sound.playOwnHullLost();
    else if (alien === 'hit') sound.playIncomingHit();

    const afloat = HULLS.length - view.defence.sunk.length;
    if (alien === 'sunk' && afloat === 1 && view.status === 'playing') sound.playLastHullWarning();

    if (earth === 'sunk') setReaction('cheer');
    else if (alien === 'sunk') setReaction('laugh');
  };

  useEffect(() => {
    if (reaction === 'none') return undefined;
    const timer = window.setTimeout(() => setReaction('none'), REACTION_MS);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  const run = async (action: () => Promise<MatchView>) => {
    setBusy(true);
    setError(null);
    try {
      const view = await action();
      // The invader's reply is held back so the exchange reads as two turns
      // rather than one, at roughly the pace of a person taking their shot.
      const paused = beforeReply(view);
      if (paused) {
        setMatch(paused);
        announce(paused);
        await wait(ALIEN_PAUSE_MS);
      }
      setMatch(view);
      announce(view);
      if (view.status === 'finished') {
        const highScore = view.score.total > (career?.progress.bestScore ?? 0);
        refreshCareer();
        setBoard(null);
        api.leaderboard().then(setBoard).catch(() => undefined);
        setFlypast({ won: view.winner === 'earth', highScore });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'the transmission failed');
    } finally {
      setBusy(false);
    }
  };

  const launch = (fleet: readonly Placement[] | undefined) => {
    if (commission === null) return Promise.resolve();
    heard.current = 0;
    sound.resetCallouts();
    setFlypast(null);
    setReaction('none');
    const { captain, starfleet } = commission;
    return run(() => api.createMatch(commission.doctrine, { captain, starfleet }, fleet));
  };

  const toggleMute = () => {
    const next = !mute;
    sound.setMuted(next);
    setMute(next);
  };

  return (
    <div className={match === null ? 'shell' : 'shell shell--campaign'}>
      <div className="scanlines" aria-hidden="true" />
      <header className="masthead">
        <div>
          <h1>Orbital Battleships Command</h1>
          <p>
            {commission
              ? `Captain ${commission.captain} · ${commission.starfleet} Starfleet · ${DOCTRINE_LABEL[commission.doctrine].name}`
              : STRAPLINE}
          </p>
        </div>
        {match === null ? null : <TransmissionLog match={match} />}
        <div className="masthead__right">
          {career ? (
            <p className="career">
              {career.rank} · {career.progress.wins}/{career.progress.games} won · best{' '}
              {career.progress.bestScore.toLocaleString()}
            </p>
          ) : null}
          <button type="button" onClick={toggleMute} aria-pressed={mute}>
            {mute ? 'Comms muted' : 'Comms live'}
          </button>
          <button type="button" onClick={() => setManual(true)}>
            Field manual
          </button>
        </div>
      </header>

      {error ? <p className="alert">{error}</p> : null}

      {commission === null ? (
        <Briefing
          onCommission={(signed) => {
            saveCommission(signed);
            setCommission(signed);
          }}
        />
      ) : match === null ? (
        <Deploy onLaunch={launch} busy={busy} starfleet={commission.starfleet} />
      ) : (
        <Battle
          match={match}
          busy={busy}
          captain={commission.captain}
          hiScore={Math.max(career?.progress.bestScore ?? 0, match.score.total)}
          reaction={reaction}
          onFire={(cell) => run(() => api.fire(match.matchId, cell))}
          onResign={() => run(() => api.resign(match.matchId))}
          onNewCampaign={() => setMatch(null)}
        />
      )}

      {flypast === null ? null : (
        <Flypast
          won={flypast.won}
          highScore={flypast.highScore}
          board={board}
          onDone={dismissFlypast}
        />
      )}

      {manual ? <Manual onClose={() => setManual(false)} /> : null}
    </div>
  );
}

/** The last few exchanges, in the masthead so a campaign holds one screen. */
function TransmissionLog({ match }: { match: MatchView }) {
  return (
    <section className="log">
      <h2>Transmission log</h2>
      <ol>
        {[...match.log]
          .reverse()
          .slice(0, LOG_LINES)
          .map((entry) => (
            <li key={entry.seq} className={`log__${entry.side}`}>
              <span className="log__ref">{entry.cell >= 0 ? formatCell(entry.cell) : '--'}</span>
              {entry.text}
            </li>
          ))}
      </ol>
    </section>
  );
}

interface BattleProps {
  readonly match: MatchView;
  readonly busy: boolean;
  readonly captain: string;
  readonly hiScore: number;
  readonly reaction: Reaction;
  readonly onFire: (cell: number) => void;
  readonly onResign: () => void;
  readonly onNewCampaign: () => void;
}

function Battle({
  match,
  busy,
  captain,
  hiScore,
  reaction,
  onFire,
  onResign,
  onNewCampaign,
}: BattleProps) {
  const finished = match.status === 'finished';
  const won = match.winner === 'earth';

  return (
    <>
      {finished ? (
        <section className={won ? 'verdict verdict--win' : 'verdict verdict--loss'}>
          <h2>{won ? 'The invasion is broken' : 'Earth has fallen'}</h2>
          <ScoreTable match={match} />
          <button type="button" className="primary" onClick={onNewCampaign}>
            New campaign
          </button>
        </section>
      ) : null}

      <div className="boards">
        <Board
          title="Invasion Grid — Kraal"
          portrait={
            <Portrait
              who="kraal"
              name="Kraal Overlord"
              active={match.turn === 'alien'}
              reaction={reaction}
            />
          }
          subtitle={finished ? 'Invader deployment revealed.' : 'Choose a cell to fire on.'}
          shots={match.offence.shots}
          fleet={match.alienFleet ?? match.offence.wrecks}
          onFire={onFire}
          disabled={busy || finished}
          side="alien"
          sunk={match.offence.sunk}
        />
        <Board
          title="Home Grid — Starfleet"
          subtitle={`Sections intact: ${match.stats.earth.sectionsRemaining}/${TOTAL_SECTIONS}`}
          portrait={
            <Portrait
              who="captain"
              name={`Capt. ${captain}`}
              active={match.turn === 'earth'}
              reaction={reaction}
            />
          }
          shots={match.defence.shots}
          fleet={match.defence.fleet}
          disabled
          sunk={match.defence.sunk}
        />
      </div>

      <section className="statusbar">
        <Stat label="Hi score" value={hiScore.toLocaleString()} />
        <Stat label="Score" value={match.score.total.toLocaleString()} />
        <Stat label="Shots" value={String(match.stats.earth.shots)} />
        <Stat label="Accuracy" value={`${Math.round(match.stats.earth.accuracy * 100)}%`} />
        <Stat label="Invader ships" value={`${HULLS.length - match.offence.sunk.length} afloat`} />
        <Stat label="Your ships" value={`${HULLS.length - match.defence.sunk.length} afloat`} />
        {finished ? null : (
          <button type="button" className="statusbar__resign" onClick={onResign} disabled={busy}>
            Abandon defence
          </button>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

function ScoreTable({ match }: { match: MatchView }) {
  const { score } = match;
  const lines: [string, number][] = [
    ['Hits', score.hits],
    ['Ships destroyed', score.sinks],
    ['Accuracy bonus', score.accuracy],
    ['Fleet preserved', score.survival],
    ['Victory', score.victory],
    ['Wasted ordnance', score.wastedShots === 0 ? 0 : -score.wastedShots],
  ];
  return (
    <table className="score">
      <tbody>
        {lines.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value.toLocaleString()}</td>
          </tr>
        ))}
        <tr>
          <th scope="row">Doctrine multiplier</th>
          <td>x{score.multiplier}</td>
        </tr>
        <tr className="score__total">
          <th scope="row">Total</th>
          <td>{score.total.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  );
}
