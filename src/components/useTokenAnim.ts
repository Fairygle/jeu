import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { ADJACENCY, RoomId } from '../game/board';

export interface TokenStyle {
  left: number;
  top: number;
  opacity: number;
  transition: string;
}

function centerOf(wrap: HTMLElement, el: HTMLElement) {
  const wr = wrap.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return { x: er.left - wr.left + er.width / 2, y: er.top - wr.top + er.height / 2 };
}

/** Pièce de passage plausible entre deux salles pour l'animation du sprint. */
function pickIntermediate(from: RoomId, to: RoomId): RoomId | null {
  const a = ADJACENCY[from] || [];
  const b = ADJACENCY[to] || [];
  return a.find((r) => b.includes(r)) ?? null;
}

const LEG_MS = 225; // 2 x 225 ≈ 450 ms pour un sprint complet
const SINGLE_MS = 450;
const PAUSE_MS = 40; // arrêt quasi imperceptible entre les deux bonds du sprint
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * Anime un jeton d'une pièce à l'autre (glissement FLIP, mesuré en pixels réels).
 * Les sprints (isDoubleHop) marquent un arrêt visible dans la pièce de passage.
 * Une apparition sans position précédente connue (brouillard de guerre) se fait
 * en fondu sur place, jamais en glissement, pour ne pas suggérer un trajet vu.
 */
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
    const dest = centerOf(wrap, el);
    const wasVisible = prevVisible.current;
    const from = prevRoom.current;

    if (!wasVisible || from === null) {
      // Apparition : fondu sur place (on ne connaît pas le trajet réel)
      setStyle({ left: dest.x, top: dest.y, opacity: 0, transition: 'none' });
      const id = window.setTimeout(() => {
        setStyle({ left: dest.x, top: dest.y, opacity: 1, transition: 'opacity 260ms ease' });
        onPuff(dest.x, dest.y);
      }, 16);
      timers.current.push(id);
    } else if (from === room) {
      setStyle((s) => ({ ...s, left: dest.x, top: dest.y, opacity: 1 }));
    } else {
      const fromEl = roomRefs.current?.get(from);
      if (fromEl) {
        const start = centerOf(wrap, fromEl);
        onPuff(start.x, start.y);
      }
      if (isDoubleHop) {
        const midId = pickIntermediate(from, room);
        const midEl = midId ? roomRefs.current?.get(midId) : null;
        if (midEl) {
          const mid = centerOf(wrap, midEl);
          setStyle({
            left: mid.x,
            top: mid.y,
            opacity: 1,
            transition: `left ${LEG_MS}ms ${EASE}, top ${LEG_MS}ms ${EASE}`,
          });
          const t1 = window.setTimeout(() => {
            onPuff(mid.x, mid.y);
            setStyle({
              left: dest.x,
              top: dest.y,
              opacity: 1,
              transition: `left ${LEG_MS}ms ${EASE}, top ${LEG_MS}ms ${EASE}`,
            });
            const t2 = window.setTimeout(() => onPuff(dest.x, dest.y), LEG_MS);
            timers.current.push(t2);
          }, LEG_MS + PAUSE_MS);
          timers.current.push(t1);
        } else {
          setStyle({ left: dest.x, top: dest.y, opacity: 1, transition: `left ${SINGLE_MS}ms ${EASE}, top ${SINGLE_MS}ms ${EASE}` });
          const t = window.setTimeout(() => onPuff(dest.x, dest.y), SINGLE_MS);
          timers.current.push(t);
        }
      } else {
        setStyle({ left: dest.x, top: dest.y, opacity: 1, transition: `left ${SINGLE_MS}ms ${EASE}, top ${SINGLE_MS}ms ${EASE}` });
        const t = window.setTimeout(() => onPuff(dest.x, dest.y), SINGLE_MS);
        timers.current.push(t);
      }
    }

    prevVisible.current = true;
    prevRoom.current = room;

    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, visible, isDoubleHop]);

  // Repositionnement instantané au redimensionnement (rotation d'écran…)
  useLayoutEffect(() => {
    function snap() {
      const wrap = boardWrapRef.current;
      const r = prevRoom.current;
      if (!wrap || r === null || !prevVisible.current) return;
      const el = roomRefs.current?.get(r);
      if (!el) return;
      const dest = centerOf(wrap, el);
      setStyle((s) => ({ ...s, left: dest.x, top: dest.y, transition: 'none' }));
    }
    window.addEventListener('resize', snap);
    return () => window.removeEventListener('resize', snap);
  }, [boardWrapRef, roomRefs]);

  return style;
}
