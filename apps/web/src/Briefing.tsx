import { useState } from 'react';
import { FLEET, HULLS, STARFLEET_NAMES, STORY, TOTAL_SECTIONS } from '@bs/rules';
import { Ship } from './Ship.js';
import type { Commission } from './commission.js';

const CELL = 34;

/**
 * The briefing a captain reads once, before their first campaign: who is
 * attacking, what they are given to fight it with, and who they are.
 *
 * The roster is drawn from `FLEET`, artwork included, so a change to the fleet
 * shows up here without anyone remembering to update a screen.
 */
export function Briefing({ onCommission }: { onCommission: (commission: Commission) => void }) {
  const [captain, setCaptain] = useState('');
  const [suggestion, setSuggestion] = useState(0);
  const [starfleet, setStarfleet] = useState(STARFLEET_NAMES[0]);
  const ready = captain.trim() !== '' && starfleet.trim() !== '';

  const nextSuggestion = () => {
    const index = (suggestion + 1) % STARFLEET_NAMES.length;
    setSuggestion(index);
    setStarfleet(STARFLEET_NAMES[index]);
  };

  return (
    <section className="brief">
      <h2>Incoming transmission — Earth Defence Command</h2>
      <p className="brief__story">{STORY}</p>

      <h3>Your fleet</h3>
      <p className="brief__note">
        {HULLS.length} hulls, {TOTAL_SECTIONS} sections. Every hull fires once a turn; length is what separates
        them — the long ones take a beating but are far easier for the Kraal to find.
      </p>
      <ul className="brief__fleet">
        {FLEET.map((ship) => (
          <li key={ship.id} className="brief__ship">
            <svg viewBox={`0 0 ${4 * CELL} ${CELL}`} role="img" aria-label={ship.earthName}>
              <Ship
                hull={`${ship.id}-1`}
                orientation="horizontal"
                cx={(ship.sections * CELL) / 2}
                cy={CELL / 2}
                cell={CELL}
                side="earth"
              />
            </svg>
            <div>
              <strong>
                {ship.earthName} <span className="brief__count">x{ship.count}</span>
              </strong>
              <p>{ship.blurb}</p>
              <dl className="ratings">
                <Rating label="Speed" value={ship.ratings.speed} />
                <Rating label="Defence" value={ship.ratings.defence} />
                <Rating label="Firepower" value={ship.ratings.firepower} />
              </dl>
            </div>
          </li>
        ))}
      </ul>

      <h3>Sign your commission</h3>
      <form
        className="brief__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onCommission({ captain: captain.trim(), starfleet: starfleet.trim() });
        }}
      >
        <label>
          Captain
          <input
            type="text"
            value={captain}
            maxLength={24}
            placeholder="Your name"
            onChange={(event) => setCaptain(event.target.value)}
          />
        </label>
        <label>
          Starfleet
          <input
            type="text"
            value={starfleet}
            maxLength={24}
            onChange={(event) => setStarfleet(event.target.value)}
          />
        </label>
        <button type="button" onClick={nextSuggestion}>
          Suggest a name
        </button>
        <button type="submit" className="primary" disabled={!ready}>
          Take command
        </button>
      </form>
      {ready ? (
        <p className="brief__seal">
          Captain {captain.trim()}, {starfleet.trim()} Starfleet — Earth is yours to hold.
        </p>
      ) : null}
    </section>
  );
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div className="rating">
      <dt>{label}</dt>
      <dd aria-label={`${value} out of 5`}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={index < value ? 'pip pip--on' : 'pip'} aria-hidden="true" />
        ))}
      </dd>
    </div>
  );
}
