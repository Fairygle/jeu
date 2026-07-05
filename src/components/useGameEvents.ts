import { useEffect, useRef, useState } from 'react';
import { GameState, LogEntry, PlayerIndex } from '../game/engine';
import { renderLog } from '../logI18n';

/* ── Classification d'un événement de log en animation ────────────────────
   minor = doux et rapide (~1100 ms) ; major = plus fort et dramatique (~1700 ms). */

type Tone = 'neutral' | 'danger' | 'reveal' | 'good';
export interface GameEvent {
  id: number;
  text: string;
  weight: 'minor' | 'major';
  tone: Tone;
  icon: string;
}

type Tfn = (key: string, params?: Record<string, string | number>) => string;

const MINOR_KEYS = new Set([
  'log.trapMine',
  'log.trapOpp',
  'log.listen',
  'log.moveMine',
  'log.moveFreeMine',
  'log.moveOpp',
  'log.doubleMoveMine',
  'log.doubleMoveOpp',
  'log.escapeMine',
  'log.escapeOpp',
  'log.endTurnManual',
  'log.turnStart',
]);

const DANGER_KEYS = new Set(['log.damage', 'log.shoot', 'log.trapTrigger']);
const REVEAL_KEYS = new Set([
  'log.echoTrigger',
  'log.echoRevealExact',
  'log.echoAnswer',
  'log.listenAnswer',
  'log.hatchTrigger',
  'log.hatchPush',
  'log.floodLever',
  'log.balconyJump',
  'log.kitchenRefill',
  'log.basementDeviceOpp',
  'log.delayedTrigger',
]);

const ICONS: Record<string, string> = {
  'log.trapMine': 'dynamite',
  'log.trapOpp': 'dynamite',
  'log.trapTrigger': 'detonator',
  'log.delayedTrigger': 'timedynamite',
  'log.listen': 'ear',
  'log.listenAnswer': 'ear',
  'log.echoAnswer': 'antenna',
  'log.echoTrigger': 'antenna',
  'log.echoRevealExact': 'antenna',
  'log.moveMine': 'footprint',
  'log.moveFreeMine': 'runner',
  'log.moveOpp': 'footprint',
  'log.doubleMoveMine': 'footsteps',
  'log.doubleMoveOpp': 'footsteps',
  'log.escapeMine': 'footprint',
  'log.escapeOpp': 'footprint',
  'log.shoot': 'revolver',
  'log.shootMiss': 'revolver',
  'log.damage': 'revolver',
  'log.hatchTrigger': 'hatch',
  'log.hatchPush': 'hatch',
  'log.floodLever': 'wave',
  'log.balconyJump': 'jump',
  'log.kitchenRefill': 'pot',
  'log.basementDeviceOpp': 'timedynamite',
};

function classify(e: LogEntry): Omit<GameEvent, 'id' | 'text'> | null {
  if (!e.key) return null;
  if (e.key === 'log.setupStart' || e.key === 'log.kitchenAvailable' || e.key === 'log.floodRecedes') return null;
  if (e.key === 'log.playerPositioned') return null; // discret, pas d'animation
  const weight: 'minor' | 'major' = MINOR_KEYS.has(e.key) ? 'minor' : 'major';
  const tone: Tone = DANGER_KEYS.has(e.key) ? 'danger' : REVEAL_KEYS.has(e.key) ? 'reveal' : 'neutral';
  return { weight, tone, icon: ICONS[e.key] ?? '' };
}

/** File d'attente : un événement à la fois, jamais de chevauchement. */
export function useGameEvents(state: GameState, viewer: PlayerIndex, t: Tfn, playerNames: [string, string]) {
  const [current, setCurrent] = useState<GameEvent | null>(null);
  const queue = useRef<GameEvent[]>([]);
  const seen = useRef<number>(0);
  const idRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const log = state.log;
    if (log.length < seen.current) seen.current = 0; // nouvelle partie
    for (let i = seen.current; i < log.length; i++) {
      const e = log[i];
      if (e.visibility !== 'both' && e.visibility !== viewer) continue;
      const c = classify(e);
      if (c) queue.current.push({ ...c, text: renderLog(e, t, playerNames), id: ++idRef.current });
    }
    seen.current = log.length;
    pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.log.length]);

  function pump() {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    setCurrent(next);
    const dur = next.weight === 'major' ? 1700 : 1100;
    window.setTimeout(() => {
      setCurrent(null);
      window.setTimeout(() => {
        busy.current = false;
        pump();
      }, 160);
    }, dur);
  }

  return current;
}
