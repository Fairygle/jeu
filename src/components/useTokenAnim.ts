import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { ADJACENCY, RoomId } from '../game/board';
import { passageBetween } from './passages';

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

    const pushPt = (p: Pt, stop: boolean) => {
      const prev = cursor;
      if (Math.abs(p.x - prev.x) > 1.5 || Math.abs(p.y - prev.y) > 1.5) {
        waypoints.push(p); stops.push(stop); cursor = p;
      } else if (stop && stops.length) {
        stops[stops.length - 1] = true;
      }
    };

    // Calcule le point de passage (porte/escalier) entre deux pièces, avec son
    // axe de franchissement. Renvoie { x, y, kind } où kind indique l'axe droit.
    const gateOf = (ra: Rect, rb: Rect, pass: NonNullable<ReturnType<typeof passageBetween>>) => {
      if (pass.via !== 'door') {
        const stEl =
          pass.via === 'stairL' ? stairRefs?.current?.get('stairL')
          : pass.via === 'stairM' ? stairRefs?.current?.get('stairM')
          : stairRefs?.current?.get('stairR');
        const x = stEl ? rectOf(wrap, stEl).cx : (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2;
        const y = ra.cy < rb.cy ? (ra.bottom + rb.top) / 2 : (ra.top + rb.bottom) / 2;
        return { x, y, kind: 'vertical' as const };
      }
      if (pass.axis === 'v') {
        const x = (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2;
        const y = ra.cy < rb.cy ? (ra.bottom + rb.top) / 2 : (ra.top + rb.bottom) / 2;
        return { x, y, kind: 'vertical' as const };
      }
      const y = (Math.max(ra.top, rb.top) + Math.min(ra.bottom, rb.bottom)) / 2;
      const x = ra.cx < rb.cx ? (ra.right + rb.left) / 2 : (ra.left + rb.right) / 2;
      return { x, y, kind: 'horizontal' as const };
    };

    // Pré-calcule tous les passages de la chaîne
    const rectsChain = chain.map(rectFor);
    if (rectsChain.some((r) => !r)) ok = false;
    const gates = ok
      ? chain.slice(0, -1).map((_, i) => {
          const p = passageBetween(chain[i], chain[i + 1]);
          return p ? gateOf(rectsChain[i]!, rectsChain[i + 1]!, p) : null;
        })
      : [];
    if (gates.some((g) => !g)) ok = false;

    if (ok) {
      for (let i = 0; i < chain.length - 1; i++) {
        const rb = rectsChain[i + 1]!;
        const gate = gates[i]!;
        const isFinal = i === chain.length - 2;

        // 1) s'aligner face au passage (dans la pièce courante)
        if (gate.kind === 'vertical') {
          pushPt({ x: gate.x, y: cursor.y }, false);
          pushPt({ x: gate.x, y: gate.y }, false); // au niveau du seuil
        } else {
          pushPt({ x: cursor.x, y: gate.y }, false);
          pushPt({ x: gate.x, y: gate.y }, false);
        }

        // 2) entrer dans la pièce suivante
        if (isFinal) {
          const destRoom = chain[i + 1];
          // Cas particulier : le Sous-sol est un grand bandeau avec plusieurs
          // entrées sur son bord haut. On s'arrête dans l'axe de l'entrée
          // franchie (juste en dessous), pas au centre du bandeau.
          const stopInAxis = destRoom === 8 && gate.kind === 'vertical';
          if (gate.kind === 'vertical') {
            const targetX = stopInAxis ? gate.x : rb.cx;
            pushPt({ x: gate.x, y: rb.cy }, targetX === gate.x);
            if (targetX !== gate.x) pushPt({ x: rb.cx, y: rb.cy }, true);
          } else {
            pushPt({ x: rb.cx, y: gate.y }, false);
            pushPt({ x: rb.cx, y: rb.cy }, true);
          }
        }
        // pièce de transit : on ne va PAS au centre, on repart directement vers
        // le passage suivant depuis le seuil actuel (cursor est déjà sur le seuil).
      }
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
