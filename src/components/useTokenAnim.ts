import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { ADJACENCY, RoomId } from '../game/board';
import { Axis, passageBetween } from './passages';

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
  return { left, top, right: left + er.width, bottom: top + er.height, cx: left + er.width / 2, cy: top + er.height / 2 };
}

function pickIntermediate(from: RoomId, to: RoomId): RoomId | null {
  const a = ADJACENCY[from] || [];
  const b = ADJACENCY[to] || [];
  return a.find((r) => b.includes(r)) ?? null;
}

/** Milieu de la cloison mitoyenne entre deux pièces (pour une porte). */
function doorPoint(a: Rect, b: Rect, axis: Axis): Pt {
  if (axis === 'h') {
    // passage horizontal : x au milieu de l'espace entre les deux, y aligné sur le recouvrement
    const x = a.cx < b.cx ? (a.right + b.left) / 2 : (a.left + b.right) / 2;
    const y = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
    return { x, y };
  }
  const y = a.cy < b.cy ? (a.bottom + b.top) / 2 : (a.top + b.bottom) / 2;
  const x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
  return { x, y };
}

const STEP_MS = 140;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EASE_END = 'cubic-bezier(0.34, 1.1, 0.64, 1)';

export function useTokenAnim(
  boardWrapRef: RefObject<HTMLDivElement>,
  roomRefs: RefObject<Map<RoomId, HTMLElement>>,
  room: RoomId | null,
  visible: boolean,
  isDoubleHop: boolean,
  onPuff: (x: number, y: number) => void,
  stairRefs?: RefObject<Map<string, HTMLElement>>,
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

    const settle = () => {
      prevVisible.current = true;
      prevRoom.current = room;
    };

    if (!wasVisible || from === null) {
      // Apparition en fondu (brouillard de guerre : trajet inconnu)
      setStyle({ left: destRect.cx, top: destRect.cy, opacity: 0, transition: 'none' });
      const id = window.setTimeout(() => {
        setStyle({ left: destRect.cx, top: destRect.cy, opacity: 1, transition: 'opacity 260ms ease' });
        onPuff(destRect.cx, destRect.cy);
      }, 16);
      timers.current.push(id);
      settle();
      return;
    }

    if (from === room) {
      setStyle((s) => ({ ...s, left: destRect.cx, top: destRect.cy, opacity: 1 }));
      settle();
      return;
    }

    // Chaîne de pièces à traverser
    const chain: RoomId[] = [from];
    if (isDoubleHop) {
      const midId = pickIntermediate(from, room);
      if (midId && midId !== from && midId !== room) chain.push(midId);
    }
    chain.push(room);

    const rectFor = (r: RoomId) => {
      const e = roomRefs.current?.get(r);
      return e ? rectOf(wrap, e) : null;
    };

    // Construit les waypoints : pour chaque étape, un point de passage puis le centre.
    const waypoints: Pt[] = [];
    const stops: boolean[] = [];
    let cursor: Pt = (() => { const r = rectFor(from)!; return { x: r.cx, y: r.cy }; })();
    let ok = true;

    const goTo = (target: Pt, axis: Axis, stop: boolean) => {
      // trajet en L strict selon l'axe demandé
      const first: Pt = axis === 'h' ? { x: target.x, y: cursor.y } : { x: cursor.x, y: target.y };
      if (Math.abs(first.x - cursor.x) > 1.5 || Math.abs(first.y - cursor.y) > 1.5) {
        waypoints.push(first); stops.push(false); cursor = first;
      }
      if (Math.abs(target.x - cursor.x) > 1.5 || Math.abs(target.y - cursor.y) > 1.5) {
        waypoints.push(target); stops.push(stop); cursor = target;
      } else if (stop && stops.length) {
        stops[stops.length - 1] = true;
      }
    };

    for (let i = 0; i < chain.length - 1 && ok; i++) {
      const a = chain[i], b = chain[i + 1];
      const ra = rectFor(a), rb = rectFor(b);
      const pass = passageBetween(a, b);
      if (!ra || !rb || !pass) { ok = false; break; }

      // Point de passage : centre de l'escalier, ou milieu de cloison pour une porte
      let gate: Pt;
      if (pass.via !== 'door' && stairRefs?.current) {
        const stEl =
          pass.via === 'stairL' ? stairRefs.current.get('stairL')
          : pass.via === 'stairM' ? stairRefs.current.get('stairM')
          : stairRefs.current.get('stairR');
        if (stEl) { const r = rectOf(wrap, stEl); gate = { x: r.cx, y: r.cy }; }
        else gate = doorPoint(ra, rb, pass.axis);
      } else {
        gate = doorPoint(ra, rb, pass.axis);
      }

      goTo(gate, pass.axis, false);
      goTo({ x: rb.cx, y: rb.cy }, pass.axis, true);
    }

    if (!ok || waypoints.length === 0) {
      // Repli : trajet direct simple (jamais bloquant)
      setStyle({ left: destRect.cx, top: destRect.cy, opacity: 1, transition: `left 400ms ${EASE}, top 400ms ${EASE}` });
      const t = window.setTimeout(() => onPuff(destRect.cx, destRect.cy), 400);
      timers.current.push(t);
      settle();
      return;
    }

    const startR = rectFor(from)!;
    onPuff(startR.cx, startR.cy);

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
        if (stops[i]) {
          const pt = window.setTimeout(() => onPuff(p.x, p.y), STEP_MS);
          timers.current.push(pt);
        }
      }, acc);
      timers.current.push(t);
      acc += STEP_MS;
    });

    settle();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, visible, isDoubleHop]);

  // Repositionnement au redimensionnement
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
