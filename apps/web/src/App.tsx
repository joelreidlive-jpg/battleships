import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  type Difficulty,
  HULLS,
  type Placement,
  STRAPLINE,
  type Side,
  TOTAL_SECTIONS,
  formatCell,
} from '@bs/rules';
import type { MatchView, ProgressResponse } from '@bs/protocol';
import { Board } from './Board.js';
import { Briefing } from './Briefing.js';
import { type Commission, saveCommission, storedCommission } from './commission.js';
import { Deploy } from './Deploy.js';
import { Manual } from './Manual.js';
import * as api from './api.js';
import * as sound from './sound.js';

const DIFFICULTY_LABEL: Record<Difficulty, { name: string; blurb: string }> = {
  scout: { name: 'Scout Wave', blurb: 'Unco-ordinated probing fire. Score x1.' },
  raider: { name: 'Raider Flight', blurb: 'Sweeps, then hunts what it finds. Score x1.5.' },
  overmind: { name: 'Overmind', blurb: 'Reasons about every hull you could still have. Score x2.' },
};

export function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('raider');
  const [match, setMatch] = useState<MatchView | null>(null);
  const [career, setCareer] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [commission, setCommission] = useState<Commission | null>(storedCommission);
  const [mute, setMute] = useState(sound.muted);
  /** Log entries already sounded, so a re-render never replays an explosion. */
  const heard = useRef(0);

  const refreshCareer = useCallback(() => {
    if (!api.playerToken()) return;
    api.progress().then(setCareer).catch(() => undefined);
  }, []);

  useEffect(refreshCareer, [refreshCareer]);
  useEffect(() => sound.primeVoices(), []);

  /** One bang per side per exchange, sequenced so the two callouts never overlap. */
  const announce = (view: MatchView) => {
    const fresh = view.log.filter((entry) => entry.seq > heard.current);
    heard.current = view.log.reduce((max, entry) => Math.max(max, entry.seq), heard.current);
    const landed = (side: Side) =>
      fresh.some((entry) => entry.side === side && (entry.outcome === 'hit' || entry.outcome === 'sunk'));
    if (landed('earth')) sound.playDirectHit();
    if (landed('alien')) sound.playIncomingHit(landed('earth') ? 2200 : 0);
  };

  const run = async (action: () => Promise<MatchView>) => {
    setBusy(true);
    setError(null);
    try {
      const view = await action();
      setMatch(view);
      announce(view);
      if (view.status === 'finished') refreshCareer();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'the transmission failed');
    } finally {
      setBusy(false);
    }
  };

  const launch = (fleet: readonly Placement[] | undefined) => {
    heard.current = 0;
    return run(() => api.createMatch(difficulty, fleet));
  };

  const toggleMute = () => {
    const next = !mute;
    sound.setMuted(next);
    setMute(next);
  };

  return (
    <div className="shell">
      <div className="scanlines" aria-hidden="true" />
      <header className="masthead">
        <div>
          <h1>Orbital Battleships Command</h1>
          <p>
            {commission
              ? `Captain ${commission.captain} · ${commission.starfleet} Starfleet`
              : STRAPLINE}
          </p>
        </div>
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
        <>
          <section className="briefing">
            <h2>Select invasion doctrine</h2>
            <div className="doctrines">
              {DIFFICULTIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === difficulty ? 'doctrine doctrine--active' : 'doctrine'}
                  onClick={() => setDifficulty(id)}
                >
                  <strong>{DIFFICULTY_LABEL[id].name}</strong>
                  <span>{DIFFICULTY_LABEL[id].blurb}</span>
                </button>
              ))}
            </div>
          </section>
          <Deploy onLaunch={launch} busy={busy} starfleet={commission.starfleet} />
        </>
      ) : (
        <Battle
          match={match}
          busy={busy}
          starfleet={commission.starfleet}
          onFire={(cell) => run(() => api.fire(match.matchId, cell))}
          onResign={() => run(() => api.resign(match.matchId))}
          onNewCampaign={() => setMatch(null)}
        />
      )}

      {manual ? <Manual onClose={() => setManual(false)} /> : null}
    </div>
  );
}

interface BattleProps {
  readonly match: MatchView;
  readonly busy: boolean;
  readonly starfleet: string;
  readonly onFire: (cell: number) => void;
  readonly onResign: () => void;
  readonly onNewCampaign: () => void;
}

function Battle({ match, busy, starfleet, onFire, onResign, onNewCampaign }: BattleProps) {
  const finished = match.status === 'finished';
  const won = match.winner === 'earth';

  return (
    <>
      <section className="statusbar">
        <Stat label="Score" value={match.score.total.toLocaleString()} />
        <Stat label="Shots" value={String(match.stats.earth.shots)} />
        <Stat label="Accuracy" value={`${Math.round(match.stats.earth.accuracy * 100)}%`} />
        <Stat label="Invader hulls" value={`${HULLS.length - match.offence.sunk.length} afloat`} />
        <Stat label="Your hulls" value={`${HULLS.length - match.defence.sunk.length} afloat`} />
      </section>

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
          title="Invasion Grid"
          subtitle={finished ? 'Invader deployment revealed.' : 'Choose a cell to fire on.'}
          shots={match.offence.shots}
          {...(match.alienFleet ? { fleet: match.alienFleet } : {})}
          onFire={onFire}
          disabled={busy || finished}
          side="alien"
          sunk={match.offence.sunk}
        />
        <Board
          title={`Home Grid — ${starfleet} Starfleet`}
          subtitle={`Sections intact: ${match.stats.earth.sectionsRemaining}/${TOTAL_SECTIONS}`}
          shots={match.defence.shots}
          fleet={match.defence.fleet}
          disabled
          sunk={match.defence.sunk}
        />
      </div>

      <section className="log">
        <h2>Transmission log</h2>
        <ol>
          {[...match.log]
            .reverse()
            .slice(0, 40)
            .map((entry) => (
              <li key={entry.seq} className={`log__${entry.side}`}>
                <span className="log__ref">{entry.cell >= 0 ? formatCell(entry.cell) : '--'}</span>
                {entry.text}
              </li>
            ))}
        </ol>
        {!finished ? (
          <button type="button" onClick={onResign} disabled={busy}>
            Abandon defence
          </button>
        ) : null}
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
    ['Hulls destroyed', score.sinks],
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
