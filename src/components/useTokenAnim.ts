import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { ADJACENCY, RoomId } from '../game/board';

export interface TokenStyle {
  left: number;
  top: number;
  opacity: number;
  transition: string;
}

interface Pt { x: number; y: number; }
interface Rect { cx: number; cy: number; left: number; right: number; top: number; bottom: number; }

function rectOf(wrap: HTMLElement, el: HTMLElement): Rect {
  const wr = wrap.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  const left = er.left - wr.left;
  const top = er.top - wr.top;
  return {
    left,
    top,
    right: left + er.width,
    bottom: top + er.height,
    cx: left + er.width / 2,
    cy: top + er.height / 2,
  };
}

/** Pièce de passage plausible entre deux salles (pour le sprint). */
function pickIntermediate(from: RoomId, to: RoomId): RoomId | null {
  const a = ADJACENCY[from] || [];
  const b = ADJACENCY[to] || [];
  return a.find((r) => b.includes(r)) ?? null;
}

/**
 * Construit un trajet orthogonal (en L) entre deux pièces, passant par
 * l'interstice qui les sépare, plutôt qu'une diagonale centre-à-centre.
 * Renvoie la liste des points intermédiaires (hors centre de départ).
 */
function pathBetween(a: Rect, b: Rect): Pt[] {
  const GAP = 4; // marge dans l'interstice
  // Chevauchement horizontal et vertical des deux pièces
  const ovX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const ovY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

  // Cas 1 : les pièces se chevauchent horizontalement -> passage vertical (haut/bas)
  if (ovX > ovY && ovX > 0) {
    const midX = Math.max(Math.max(a.left, b.left), Math.min(Math.min(a.right, b.right), (a.cx + b.cx) / 2));
    // interstice vertical entre les deux
    const corridorY = a.cy < b.cy ? (a.bottom + b.top) / 2 : (a.top + b.bottom) / 2;
    return [
      { x: midX, y: corridorY }, // sort vers le couloir
      { x: b.cx, y: corridorY }, // longe jusqu'à l'axe de la destination
      { x: b.cx, y: b.cy }, // entre
    ];
  }

  // Cas 2 : chevauchement vertical -> passage horizontal (gauche/droite)
  if (ovY > 0) {
    const midY = Math.max(Math.max(a.top, b.top), Math.min(Math.min(a.bottom, b.bottom), (a.cy + b.cy) / 2));
    const corridorX = a.cx < b.cx ? (a.right + b.left) / 2 : (a.left + b.right) / 2;
    return [
      { x: corridorX, y: midY },
      { x: corridorX, y: b.cy },
      { x: b.cx, y: b.cy },
    ];
  }

  // Cas 3 : pièces en diagonale (pas de chevauchement) -> L par le coin
  void GAP;
  return [
    { x: a.cx, y: b.cy }, // descend/monte d'abord dans l'axe vertical
    { x: b.cx, y: b.cy }, // puis rejoint horizontalement
  ];
}

const STEP_MS = 150; // durée par segment élémentaire du trajet
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EASE_END = 'cubic-bezier(0.34, 1.12, 0.64, 1)';

export function useTokenAnim(
  boardWrapRef: RefObject<HTMLDivElement>,
  roomRefs: RefObject<Map<RoomId, HTMLElement>>,
  room: RoomId | null,
  visible: boolean,
  isDoubleHop: boolean,
  onPuff: (x: number, y: number) => void,
) {
  const [style, setStyle] = useState<TokenStyle>({ left: 0, top: 0, opacity: 0, transition: 'none' });
  const prevRoom = useRef<RoomId | null>(null);
  const prevVisible = useRef(false);
  const timers = useRef<number[]>([]);

  useLayoutEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const wrap = boardWrapRef.current;
    if (!wrap) return;

    if (!visible || room === null) {
      setStyle((s) => ({ ...s, opacity: 0, transition: 'opacity 200ms ease' }));
      prevVisible.current = false;
      prevRoom.current = null;
      return;
    }

    const el = roomRefs.current?.get(room);
    if (!el) return;
    const destRect = rectOf(wrap, el);
    const wasVisible = prevVisible.current;
    const from = prevRoom.current;

    if (!wasVisible || from === null) {
      // Apparition : fondu sur place (trajet inconnu -> brouillard de guerre)
      setStyle({ left: destRect.cx, top: destRect.cy, opacity: 0, transition: 'none' });
      const id = window.setTimeout(() => {
        setStyle({ left: destRect.cx, top: destRect.cy, opacity: 1, transition: 'opacity 260ms ease' });
        onPuff(destRect.cx, destRect.cy);
      }, 16);
      timers.current.push(id);
    } else if (from === room) {
      setStyle((s) => ({ ...s, left: destRect.cx, top: destRect.cy, opacity: 1 }));
    } else {
      const fromEl = roomRefs.current?.get(from);
      const fromRect = fromEl ? rectOf(wrap, fromEl) : null;

      // Construit la chaîne de pièces à traverser (départ -> [intermédiaire] -> arrivée)
      const chain: RoomId[] = [from];
      if (isDoubleHop) {
        const midId = pickIntermediate(from, room);
        if (midId && midId !== from && midId !== room) chain.push(midId);
      }
      chain.push(room);

      // Waypoints en pixels, routés par les interstices
      const rects = chain.map((r) => {
        const e = roomRefs.current?.get(r);
        return e ? rectOf(wrap, e) : null;
      });
      if (rects.some((r) => !r)) {
        // fallback direct si une mesure manque
        setStyle({ left: destRect.cx, top: destRect.cy, opacity: 1, transition: `left 450ms ${EASE}, top 450ms ${EASE}` });
        const t = window.setTimeout(() => onPuff(destRect.cx, destRect.cy), 450);
        timers.current.push(t);
      } else {
        const rawWaypoints: Pt[] = [];
        const rawStops: boolean[] = [];
        for (let i = 0; i < rects.length - 1; i++) {
          const seg = pathBetween(rects[i]!, rects[i + 1]!);
          seg.forEach((p, j) => {
            rawWaypoints.push(p);
            rawStops.push(j === seg.length - 1);
          });
        }
        // Retire les points quasi identiques consécutifs (évite les temps morts)
        const waypoints: Pt[] = [];
        const stopFlags: boolean[] = [];
        for (let i = 0; i < rawWaypoints.length; i++) {
          const prev = waypoints[waypoints.length - 1];
          const p = rawWaypoints[i];
          if (prev && Math.abs(prev.x - p.x) < 1.5 && Math.abs(prev.y - p.y) < 1.5) {
            if (rawStops[i]) stopFlags[stopFlags.length - 1] = true;
            continue;
          }
          waypoints.push(p);
          stopFlags.push(rawStops[i]);
        }

        if (fromRect) onPuff(fromRect.cx, fromRect.cy);

        // Anime en enchaînant les waypoints
        let acc = 0;
        waypoints.forEach((p, i) => {
          const isLast = i === waypoints.length - 1;
          const t = window.setTimeout(() => {
            setStyle({
              left: p.x,
              top: p.y,
              opacity: 1,
              transition: `left ${STEP_MS}ms ${isLast ? EASE_END : EASE}, top ${STEP_MS}ms ${isLast ? EASE_END : EASE}`,
            });
            // pichenette aux arrêts en pièce (arrivée dans une salle de la chaîne)
            if (stopFlags[i]) {
              const pt = window.setTimeout(() => onPuff(p.x, p.y), STEP_MS);
              timers.current.push(pt);
            }
          }, acc);
          timers.current.push(t);
          acc += STEP_MS;
        });
      }
    }

    prevVisible.current = true;
    prevRoom.current = room;

    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, visible, isDoubleHop]);

  // Repositionnement instantané au redimensionnement
  useLayoutEffect(() => {
    function snap() {
      const wrap = boardWrapRef.current;
      const r = prevRoom.current;
      if (!wrap || r === null || !prevVisible.current) return;
      const el = roomRefs.current?.get(r);
      if (!el) return;
      const rc = rectOf(wrap, el);
      setStyle((s) => ({ ...s, left: rc.cx, top: rc.cy, transition: 'none' }));
    }
    window.addEventListener('resize', snap);
    return () => window.removeEventListener('resize', snap);
  }, [boardWrapRef, roomRefs]);

  return style;
}
