import { useEffect, useRef, useState } from 'react';
import { GameState, LogEntry, PlayerIndex } from '../game/engine';

/* ── Classification d'un événement de log en animation ────────────────────
   minor = doux et rapide (~1100 ms) ; major = plus fort et dramatique (~1700 ms). */

type Tone = 'neutral' | 'danger' | 'reveal' | 'good';
export interface GameEvent {
  id: number;
  text: string;
  weight: 'minor' | 'major';
  tone: Tone;
  icon: string; // clé ActionIcon ou '' 
}

function classify(e: LogEntry, viewer: PlayerIndex): Omit<GameEvent, 'id'> | null {
  const t = e.text.toLowerCase();
  const mine = e.actor === viewer;

  // — Dégâts : majeur, dramatique —
  if (e.kind === 'damage' || /perd 1 pv|touché|inflige|dégât/.test(t)) {
    return { text: e.text, weight: 'major', tone: 'danger', icon: 'revolver' };
  }
  // — Tir manqué —
  if (/manque|raté|à côté|aucune cible/.test(t)) {
    return { text: e.text, weight: 'minor', tone: 'neutral', icon: 'revolver' };
  }
  // — Tir (sans dégât explicite) —
  if (/tire|fait feu|coup de feu/.test(t)) {
    return { text: e.text, weight: 'major', tone: 'danger', icon: 'revolver' };
  }
  // — Révélation —
  if (e.kind === 'reveal' || /révél|repéré|position exacte|se ravitaille|saute|bond/.test(t)) {
    return { text: e.text, weight: 'major', tone: 'reveal', icon: 'antenna' };
  }
  // — Piège posé —
  if (/pose un piège|piège posé|dispositif/.test(t)) {
    return { text: e.text, weight: 'minor', tone: 'neutral', icon: 'dynamite' };
  }
  // — Piège déclenché —
  if (/piège se déclenche|déclenche|piège.*explos/.test(t)) {
    return { text: e.text, weight: 'major', tone: 'danger', icon: 'detonator' };
  }
  // — Effets de pièce spéciaux —
  if (/inonde|inondation|trappe|poussé|chute|échos/.test(t)) {
    return { text: e.text, weight: 'major', tone: 'reveal', icon: 'wave' };
  }
  // — Écoute —
  if (/écoute|entend|indique une pièce/.test(t)) {
    return { text: e.text, weight: 'minor', tone: 'neutral', icon: 'ear' };
  }
  // — Déplacement —
  if (/se déplace|disparaît dans l'ombre|repli|avance/.test(t)) {
    return { text: e.text, weight: 'minor', tone: mine ? 'good' : 'neutral', icon: 'footprint' };
  }
  // — Début de tour —
  if (/^tour \d+/.test(t)) {
    return { text: e.text.replace(/\s*:.*/, ''), weight: 'minor', tone: 'neutral', icon: 'footprint' };
  }
  // — Fin / début de tour —
  if (/fin de tour|n'a plus d'action/.test(t)) {
    return { text: e.text, weight: 'minor', tone: 'neutral', icon: '' };
  }
  return null;
}

/* File d'attente : un événement à la fois, jamais de chevauchement. */
export function useGameEvents(state: GameState, viewer: PlayerIndex) {
  const [current, setCurrent] = useState<GameEvent | null>(null);
  const queue = useRef<GameEvent[]>([]);
  const seen = useRef<number>(0); // nb d'entrées de log déjà traitées
  const idRef = useRef(0);
  const busy = useRef(false);

  // Détecte les nouvelles entrées de log visibles et les met en file
  useEffect(() => {
    const log = state.log;
    if (log.length < seen.current) seen.current = 0; // nouvelle partie
    for (let i = seen.current; i < log.length; i++) {
      const e = log[i];
      if (e.visibility !== 'both' && e.visibility !== viewer) continue;
      const c = classify(e, viewer);
      if (c) queue.current.push({ ...c, id: ++idRef.current });
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
      // petite respiration entre deux bannières
      window.setTimeout(() => {
        busy.current = false;
        pump();
      }, 160);
    }, dur);
  }

  return current;
}
