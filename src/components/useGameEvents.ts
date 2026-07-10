import { useEffect, useRef, useState } from 'react';
import { GameState, LogEntry, PlayerIndex } from '../game/engine';
import { renderLog } from '../logI18n';

/* ── Classification d'un événement de log en animation ────────────────────
   minor = doux (~2200 ms) ; major = fort et dramatique (~4000 ms).
   Les actions de l'ADVERSAIRE sont systématiquement promues en "major" :
   en multi ce sont les informations cruciales à ne pas rater. */

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
  'log.listen',
  'log.moveMine',
  'log.moveFreeMine',
  'log.doubleMoveMine',
  'log.escapeMine',
  'log.endTurnManual',
  'log.turnStart',
]);

const DANGER_KEYS = new Set(['log.damage', 'log.shoot', 'log.trapTrigger', 'log.delayedTrigger']);
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
]);

export const LOG_ICONS: Record<string, string> = {
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

function classify(e: LogEntry, viewer: PlayerIndex): Omit<GameEvent, 'id' | 'text'> | null {
  if (!e.key) return null;
  if (e.key === 'log.setupStart' || e.key === 'log.kitchenAvailable' || e.key === 'log.floodRecedes') return null;
  if (e.key === 'log.playerPositioned') return null; // discret, pas d'animation
  const isOpponentAction = e.actor !== null && e.actor !== viewer;
  const weight: 'minor' | 'major' = isOpponentAction || !MINOR_KEYS.has(e.key) ? 'major' : 'minor';
  const tone: Tone = DANGER_KEYS.has(e.key) ? 'danger' : REVEAL_KEYS.has(e.key) ? 'reveal' : 'neutral';
  return { weight, tone, icon: LOG_ICONS[e.key] ?? '' };
}

const DUR_MINOR = 2200;
const DUR_MAJOR = 4000;
const MAX_VISIBLE = 3;

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* non supporté : silencieux */
  }
}

/** Empilement : jusqu'à MAX_VISIBLE événements affichés simultanément,
    chacun avec sa propre durée de vie. Les plus récents en premier. */
export function useGameEvents(state: GameState, viewer: PlayerIndex, t: Tfn, playerNames: [string, string]) {
  const [current, setCurrent] = useState<GameEvent[]>([]);
  const queue = useRef<GameEvent[]>([]);
  const seen = useRef<number>(0);
  const idRef = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const log = state.log;
    if (log.length < seen.current) seen.current = 0; // nouvelle partie
    for (let i = seen.current; i < log.length; i++) {
      const e = log[i];
      if (e.visibility !== 'both' && e.visibility !== viewer) continue;
      const c = classify(e, viewer);
      if (c) queue.current.push({ ...c, text: renderLog(e, t, playerNames), id: ++idRef.current });
    }
    seen.current = log.length;
    pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.log.length]);

  // Nettoyage des timers au démontage
  useEffect(() => () => {
    timers.current.forEach((h) => clearTimeout(h));
    timers.current.clear();
  }, []);

  function dismiss(id: number) {
    const h = timers.current.get(id);
    if (h) clearTimeout(h);
    timers.current.delete(id);
    setCurrent((cur) => cur.filter((e) => e.id !== id));
    // Un slot se libère : on dépile la file
    window.setTimeout(pump, 120);
  }

  function pump() {
    setCurrent((cur) => {
      let next = cur;
      while (next.length < MAX_VISIBLE && queue.current.length > 0) {
        const ev = queue.current.shift()!;
        next = [ev, ...next]; // le plus récent en haut
        if (ev.tone === 'danger') vibrate(ev.weight === 'major' ? [90, 60, 120] : 60);
        const dur = ev.weight === 'major' ? DUR_MAJOR : DUR_MINOR;
        const h = window.setTimeout(() => dismiss(ev.id), dur);
        timers.current.set(ev.id, h);
      }
      return next;
    });
  }

  return { events: current, dismiss };
}
