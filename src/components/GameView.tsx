import { useEffect, useMemo, useRef, useState } from 'react';
import { ADJACENCY, ALL_ROOMS, LINE_OF_SIGHT, ROOMS, RoomId, reachable } from '../game/board';
import { GameAction, GameState, PlayerIndex, hasValidAction, roomEffectCost, validTargets } from '../game/engine';
import { ActionIcon, Hearts } from './icons';
import { ROOM_DECOR } from './decor';
import { useGameEvents } from './useGameEvents';
import { useI18n } from '../i18n';
import { renderLog } from '../logI18n';
import { useTokenAnim } from './useTokenAnim';
import { DOOR_PAIRS } from './passages';

interface Props {
  state: GameState;
  viewer: PlayerIndex;
  canAct: boolean;
  onAction: (action: GameAction) => void;
  playerNames: [string, string];
  error?: string | null;
  /** Échéance du tour (timestamp ms) — affiche un compte à rebours si fourni. */
  deadline?: number | null;
}

interface WheelOption {
  icon: string;
  label: string;
  cost: string;
  action: GameAction;
  /** Au lieu d'exécuter l'action directement, ouvre un mode de sélection de pièce. */
  startPicking?: 'delayedTrap';
}

const EFFECT_INFO: Partial<Record<RoomId, { icon: string; labelKey: string }>> = {
  1: { icon: 'antenna', labelKey: 'act.echos' },
  4: { icon: 'pot', labelKey: 'act.refill' },
  5: { icon: 'hatch', labelKey: 'act.hatch' },
  6: { icon: 'wave', labelKey: 'act.flood' },
  7: { icon: 'jump', labelKey: 'act.jump' },
};

export default function GameView({ state, viewer, canAct, onAction, playerNames, error, deadline }: Props) {
  const { t } = useI18n();
  const [wheelRoom, setWheelRoom] = useState<RoomId | null>(null);
  const [wheelAnchor, setWheelAnchor] = useState<{ x: number; y: number; side: 'left' | 'right' } | null>(null);
  const [pickingDelayed, setPickingDelayed] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const gameEvent = useGameEvents(state, viewer, t, playerNames);

  const me = state.players[viewer];
  const foe = state.players[viewer === 0 ? 1 : 0];
  const foeIndex: PlayerIndex = viewer === 0 ? 1 : 0;
  const isSetup = state.phase === 'setup';
  const pendingForMe = Boolean(state.pending && state.pending.responder === viewer);
  const myTurn = state.phase === 'playing' && state.active === viewer && !state.pending && canAct;

  // Cibles valables pour poser le dispositif retardé (mode sélection depuis le Sous-sol)
  const delayedTargets: RoomId[] = useMemo(
    () => (pickingDelayed ? validTargets(state, viewer, 'activate_room') : []),
    [pickingDelayed, state, viewer],
  );
  // Sort automatiquement du mode sélection si le tour/l'état change entretemps
  useEffect(() => {
    if (pickingDelayed && (!myTurn || me.room !== 8)) setPickingDelayed(false);
  }, [pickingDelayed, myTurn, me.room]);

  // Invite « Repliez-vous » : dès qu'un repli gratuit devient disponible pour moi
  const [foldPrompt, setFoldPrompt] = useState(false);
  const prevFold = useRef(false);
  useEffect(() => {
    const canFold = myTurn && me.freeMoveAvailable && !isSetup && !pendingForMe;
    if (canFold && !prevFold.current) {
      setFoldPrompt(true);
      const t = setTimeout(() => setFoldPrompt(false), 2200);
      prevFold.current = true;
      return () => clearTimeout(t);
    }
    if (!canFold) prevFold.current = false;
  }, [myTurn, me.freeMoveAvailable, isSetup, pendingForMe]);

  // --- Animation des déplacements : mesure réelle des pièces + jetons flottants ---
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const roomRefs = useRef<Map<RoomId, HTMLElement>>(new Map());
  const stairRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [doorMarks, setDoorMarks] = useState<{ x: number; y: number; vertical: boolean }[]>([]);

  // Positionne les petites portes sur les cloisons entre pièces adjacentes
  useEffect(() => {
    function place() {
      const wrap = boardWrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const marks: { x: number; y: number; vertical: boolean }[] = [];
      for (const [a, b, axis] of DOOR_PAIRS) {
        const ea = roomRefs.current.get(a);
        const eb = roomRefs.current.get(b);
        if (!ea || !eb) continue;
        const ra = ea.getBoundingClientRect();
        const rb = eb.getBoundingClientRect();
        const aL = ra.left - wr.left, aR = ra.right - wr.left, aT = ra.top - wr.top, aB = ra.bottom - wr.top;
        const bL = rb.left - wr.left, bR = rb.right - wr.left, bT = rb.top - wr.top, bB = rb.bottom - wr.top;
        if (axis === 'h') {
          const x = aR < bL ? (aR + bL) / 2 : (bR + aL) / 2;
          const y = (Math.max(aT, bT) + Math.min(aB, bB)) / 2;
          marks.push({ x, y, vertical: true });
        } else {
          const y = aB < bT ? (aB + bT) / 2 : (bB + aT) / 2;
          const x = (Math.max(aL, bL) + Math.min(aR, bR)) / 2;
          marks.push({ x, y, vertical: false });
        }
      }
      setDoorMarks(marks);
    }
    place();
    window.addEventListener('resize', place);
    const t = window.setTimeout(place, 300);
    return () => {
      window.removeEventListener('resize', place);
      clearTimeout(t);
    };
  }, [isSetup, state.phase]);

  const [puffs, setPuffs] = useState<{ id: number; x: number; y: number }[]>([]);
  const puffId = useRef(0);
  function addPuff(x: number, y: number) {
    const id = ++puffId.current;
    setPuffs((p) => [...p.slice(-5), { id, x, y }]);
    window.setTimeout(() => setPuffs((p) => p.filter((q) => q.id !== id)), 500);
  }

  // Mon dernier déplacement loggé : détermine s'il faut animer un sprint en 2 temps
  const myLastMoveKey = useMemo(() => {
    for (let i = state.log.length - 1; i >= 0 && i >= state.log.length - 8; i--) {
      const e = state.log[i];
      if (e.actor === viewer && e.key && (e.visibility === viewer || e.visibility === 'both')) return e.key;
    }
    return null;
  }, [state.log.length, viewer]);

  const meVisible = !isSetup && me.room !== null;
  const foeVisible = !isSetup && foe.room !== null && (foe.revealedUntilMove || state.phase === 'finished');

  const meStyle = useTokenAnim(
    boardWrapRef,
    roomRefs,
    isSetup ? null : me.room,
    meVisible,
    myLastMoveKey === 'log.doubleMoveMine',
    addPuff,
    stairRefs,
  );
  const foeStyle = useTokenAnim(boardWrapRef, roomRefs, isSetup ? null : foe.room, foeVisible, false, addPuff, stairRefs);

  const directTargets: RoomId[] = useMemo(() => {
    if (isSetup) return canAct ? [...ALL_ROOMS] : [];
    if (pendingForMe && state.pending) {
      if (state.pending.kind === 'listen') return me.room ? ADJACENCY[me.room] : [];
      return state.pending.options;
    }
    return [];
  }, [state, canAct, isSetup, pendingForMe, me.room]);

  /** Les vraies portes depuis la pièce actuelle — pour la légende et le repère 🚪 */
  const neighborRooms: RoomId[] = useMemo(() => {
    if (pendingForMe && state.pending) {
      if (state.pending.kind === 'listen') return me.room ? ADJACENCY[me.room] : [];
      return state.pending.options;
    }
    if (myTurn && me.room !== null) {
      return ADJACENCY[me.room].filter((r) => !(state.basementFlood.active && r === 8));
    }
    return [];
  }, [state, pendingForMe, myTurn, me.room]);

  // Pièces dans la ligne de tir (signalées dès que Tirer est possible : mon tour, 2 PA).
  // On peut tirer sur sa propre pièce, donc elle est incluse.
  const shootRooms: RoomId[] = useMemo(() => {
    if (!myTurn || me.room === null || pendingForMe || pickingDelayed) return [];
    if (me.ap < 2) return [];
    return [me.room, ...LINE_OF_SIGHT[me.room]];
  }, [myTurn, me.room, me.ap, pendingForMe, pickingDelayed]);

  const legendText: string | null = useMemo(() => {
    if (pickingDelayed) return t('game.pickDelayedRoom');
    const names = neighborRooms.map((r) => ROOMS[r].name).join(', ');
    if (myTurn && me.room !== null && neighborRooms.length > 0)
      return me.freeMoveAvailable ? `${t('game.foldTo')} → ${names}` : `${t('game.from')} ${ROOMS[me.room].name} → ${names}`;
    if (pendingForMe && state.pending?.kind === 'listen' && neighborRooms.length > 0) return `${t('game.neighbors')} ${names}`;
    if (pendingForMe && state.pending?.kind === 'escape' && neighborRooms.length > 0) return `${t('game.escapeTo')} ${names}`;
    return null;
  }, [neighborRooms, myTurn, me.room, me.freeMoveAvailable, pendingForMe, state.pending, pickingDelayed, t]);

  function optionsFor(room: RoomId): WheelOption[] {
    if (!myTurn || me.room === null) return [];
    const opts: WheelOption[] = [];
    const flooded = state.basementFlood.active;
    const dist1 = ADJACENCY[me.room].includes(room) && !(flooded && room === 8);
    const dist2 = reachable(me.room, 2, flooded).includes(room);

    if (dist1 && (me.freeMoveAvailable || me.ap >= 1)) {
      opts.push(
        me.freeMoveAvailable
          ? { icon: 'runner', label: t('act.fold'), cost: t('act.free'), action: { type: 'move', room } }
          : { icon: 'footprint', label: t('act.move'), cost: '1 PA', action: { type: 'move', room } },
      );
    }
    if (!dist1 && room !== me.room && dist2 && !me.freeMoveAvailable && me.ap >= 2) {
      opts.push({ icon: 'footsteps', label: t('act.sprint'), cost: '2 PA', action: { type: 'double_move', room } });
    }
    if ((room === me.room || LINE_OF_SIGHT[me.room].includes(room)) && me.ap >= 2) {
      opts.push({ icon: 'revolver', label: t('act.shoot'), cost: '2 PA', action: { type: 'shoot', room } });
    }
    if (me.traps.includes(room) && me.ap >= 1) {
      opts.push({ icon: 'detonator', label: t('act.trigger'), cost: '1 PA', action: { type: 'activate_trap', room } });
    }
    if (room === me.room) {
      if (me.ap >= 1) {
        opts.push({ icon: 'ear', label: t('act.listen'), cost: '1 PA', action: { type: 'listen' } });
      }
      if (me.ap >= 1 && me.traps.length + me.delayedTraps.length < 2 && !me.traps.includes(room)) {
        opts.push({ icon: 'dynamite', label: t('act.trap'), cost: '1 PA', action: { type: 'trap' } });
      }
      const cost = roomEffectCost(state, viewer);
      const info = EFFECT_INFO[room];
      if (cost !== null && info && me.ap >= cost) {
        opts.push({
          icon: info.icon,
          label: t(info.labelKey),
          cost: cost === 0 ? 'gratuit' : `${cost} PA`,
          action: { type: 'activate_room' },
        });
      }
      // Sous-sol : dispositif retardé — déclenche le mode sélection de pièce
      if (
        room === 8 &&
        me.ap >= 1 &&
        me.traps.length + me.delayedTraps.length < 2
      ) {
        opts.push({
          icon: 'timedynamite',
          label: t('act.delayed'),
          cost: '1 PA',
          action: { type: 'activate_room' },
          startPicking: 'delayedTrap',
        });
      }
    }
    return opts;
  }

  function clickRoom(room: RoomId) {
    if (isSetup || pendingForMe) {
      if (!directTargets.includes(room)) return;
      if (isSetup) onAction({ type: 'setup', room });
      else if (state.pending?.kind === 'listen') onAction({ type: 'listen_answer', room });
      else onAction({ type: 'escape', room });
      return;
    }
    if (!myTurn) return;
    // Mode sélection du dispositif retardé : un clic sur une pièce valable le pose directement
    if (pickingDelayed) {
      if (delayedTargets.includes(room)) {
        onAction({ type: 'activate_room', room });
      }
      setPickingDelayed(false);
      return;
    }
    // Repli actif : cliquer une pièce adjacente = repli immédiat, sans passer par la roue
    if (me.freeMoveAvailable && me.room !== null && ADJACENCY[me.room].includes(room)) {
      onAction({ type: 'move', room });
      return;
    }
    if (optionsFor(room).length > 0) setWheelRoom(room);
  }

  /** Ouvre la roue centrée sur le point touché. */
  function clickRoomEl(room: RoomId, e: React.MouseEvent<HTMLButtonElement>) {
    clickRoom(room);
    if (isSetup || pendingForMe) return;
    // Mode sélection ou repli direct : pas de roue à ancrer
    if (pickingDelayed) return;
    if (me.freeMoveAvailable && me.room !== null && ADJACENCY[me.room].includes(room)) return;
    if (optionsFor(room).length === 0) return;
    // Point de toucher exact ; repli sur le centre de la pièce (clavier)
    let cx = e.clientX;
    let cy = e.clientY;
    if (!cx && !cy) {
      const rect = e.currentTarget.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    }
    const side: 'left' | 'right' = cx > window.innerWidth / 2 ? 'left' : 'right';
    const margin = 122;
    const x = Math.min(Math.max(cx, margin), window.innerWidth - margin);
    const y = Math.min(Math.max(cy, margin), window.innerHeight - margin);
    setWheelAnchor({ x, y, side });
  }

  function pick(opt: WheelOption) {
    setWheelRoom(null);
    setWheelAnchor(null);
    if (opt.startPicking === 'delayedTrap') {
      setPickingDelayed(true);
      return;
    }
    onAction(opt.action);
  }

  function closeWheel() {
    setWheelRoom(null);
    setWheelAnchor(null);
  }

  const visibleLog = state.log.filter((e) => e.visibility === 'both' || e.visibility === viewer);
  const wheelOptions = wheelRoom !== null ? optionsFor(wheelRoom) : [];

  const turnLabel = isSetup
    ? canAct
      ? t('game.chooseHideTitle')
      : t('game.oppHiding')
    : pendingForMe
      ? state.pending?.kind === 'escape'
        ? t('game.escapeBasement')
        : t('game.respond')
      : state.pending
        ? t('game.waiting')
        : state.phase === 'finished'
          ? t('game.finished')
          : myTurn
            ? t('game.yourTurn')
            : t('game.oppTurn');

  return (
    <div className="game-with-bar">
      {/* Invite de repli — prioritaire, guide le joueur */}
      {foldPrompt && (
        <div className="event-banner major tone-reveal" key="fold-prompt">
          <span className="event-icon"><ActionIcon k="runner" size={26} /></span>
          <span className="event-text">{t('game.foldPrompt')}</span>
        </div>
      )}
      {/* Bannière d'événement animée — un seul événement à la fois */}
      {!foldPrompt && gameEvent && (
        <div className={`event-banner ${gameEvent.weight} tone-${gameEvent.tone}`} key={gameEvent.id}>
          {gameEvent.icon && (
            <span className="event-icon">
              <ActionIcon k={gameEvent.icon} size={gameEvent.weight === 'major' ? 26 : 20} />
            </span>
          )}
          <span className="event-text">{gameEvent.text}</span>
        </div>
      )}
      {/* Ligne de statut unique */}
      <div className="top-strip">
        <span className={`turn-indicator ${myTurn ? 'my-turn' : ''}`}>{turnLabel}</span>
        {state.phase === 'playing' && !state.pending && (
          <span className="ap-strip"><ActionIcon k="bolt" size={13} />{state.players[state.active].ap}</span>
        )}
        {secondsLeft !== null && state.phase !== 'finished' && (
          <span className={`turn-timer ${secondsLeft <= 10 ? 'urgent' : ''}`}>⏱ {secondsLeft}s</span>
        )}
        <button className="log-toggle" onClick={() => setShowRules(true)} aria-label="Règles">❓</button>
        <button className="log-toggle" onClick={() => setShowLog(true)} aria-label="Journal">📜</button>
      </div>

      {(isSetup || pendingForMe || (state.pending && !pendingForMe)) && (
        <div className="prompt-mini">
          {isSetup && canAct && t('game.chooseHide')}
          {isSetup && !canAct && t('game.oppChoosing')}
          {pendingForMe && state.pending?.kind === 'listen' &&
            `${state.pending.source === 'echo' ? 'Échos' : 'Écoute'} — touchez une pièce adjacente à votre position réelle.`}
          {pendingForMe && state.pending?.kind === 'escape' && t('game.escapeAsk')}
          {state.pending && !pendingForMe && t('game.waitingOpp')}
        </div>
      )}
      {error && <div className="error-box error-mini">{error}</div>}
      {legendText && (
        <div className="legend-banner">
          {legendText}
          {pickingDelayed && (
            <button className="legend-cancel" onClick={() => setPickingDelayed(false)}>
              ✕
            </button>
          )}
        </div>
      )}


      {/* Les deux joueurs face à face, au-dessus du plateau */}
      <div className="players-strip">
        <span className="player-side mine">
          <span className="avatar me" title={playerNames[viewer]}>{(playerNames[viewer] || 'V')[0].toUpperCase()}</span>
          <Hearts hp={Math.max(0, me.hp)} />
          <span className="ap-pip"><ActionIcon k="bolt" size={14} />{me.ap}</span>
          {me.freeMoveAvailable && <span className="status" style={{ color: 'var(--gold)' }}>repli</span>}
        </span>
        <span className="player-side theirs">
          {foe.revealedUntilMove && <span className="status revealed">révélé</span>}
          <Hearts hp={Math.max(0, foe.hp)} />
          <span className="avatar foe" title={playerNames[foeIndex]}>{(playerNames[foeIndex] || 'A')[0].toUpperCase()}</span>
        </span>
      </div>

      {/* Plateau — occupe l'essentiel de l'écran */}
      <div className="board-wrap" ref={boardWrapRef}>
        <div className={`board ${pickingDelayed ? 'picking-delayed' : ''}`}>
          <div className="floor-label first" style={{ gridArea: 'lbl2' }}>{t('game.floor.top')}</div>
          {renderRoom('n6', 6)}
          {renderRoom('n3', 3)}
          {renderRoom('n5', 5)}
          {renderRoom('n7', 7)}
          <div className="floor-label" style={{ gridArea: 'lbl1' }}>{t('game.floor.ground')}</div>
          <div className="stair stair-left" aria-hidden="true" ref={(el) => { if (el) stairRefs.current.set('stairL', el); }} />
          <div className="stair stair-mid" aria-hidden="true" ref={(el) => { if (el) stairRefs.current.set('stairM', el); }} />
          <div className="stair stair-right" aria-hidden="true" ref={(el) => { if (el) stairRefs.current.set('stairR', el); }} />
          {renderRoom('n4', 4)}
          {renderRoom('n1', 1)}
          {renderRoom('n2', 2)}
          <div className="floor-label" style={{ gridArea: 'lbl0' }}>{t('game.floor.basement')}</div>
          {renderRoom('n8', 8)}
        </div>

        {/* Petites portes sur les cloisons entre pièces adjacentes */}
        <div className="door-layer" aria-hidden="true">
          {doorMarks.map((d, i) => (
            <span
              key={i}
              className={`door-mark ${d.vertical ? 'vert' : 'horiz'}`}
              style={{ left: d.x, top: d.y }}
            >
              <svg viewBox="0 0 12 16" width="11" height="15">
                <rect x="1.5" y="1" width="9" height="14" rx="1" />
                <circle cx="8.4" cy="8" r="1" className="knob" />
              </svg>
            </span>
          ))}
        </div>

        {/* Calque des jetons flottants — glissement animé, mesuré en pixels réels */}
        <div className="token-layer" aria-hidden="true">
          {meVisible && (
            <span
              className="token me floating"
              title={playerNames[viewer]}
              style={{ left: meStyle.left, top: meStyle.top, opacity: meStyle.opacity, transition: meStyle.transition }}
            >
              {(playerNames[viewer] || 'V')[0].toUpperCase()}
            </span>
          )}
          {foeVisible && (
            <span
              className="token foe floating"
              title={playerNames[viewer === 0 ? 1 : 0]}
              style={{ left: foeStyle.left, top: foeStyle.top, opacity: foeStyle.opacity, transition: foeStyle.transition }}
            >
              {(playerNames[viewer === 0 ? 1 : 0] || 'A')[0].toUpperCase()}
            </span>
          )}
          {puffs.map((p) => (
            <span key={p.id} className="step-puff" style={{ left: p.x, top: p.y }}>
              <ActionIcon k="footprint" size={13} />
            </span>
          ))}
        </div>
      </div>

      {/* Barre fixe : mes stats + fin de tour */}
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <button
            className={`btn ${myTurn && !hasValidAction(state, viewer) && !pendingForMe ? 'btn-gold pulse-end' : ''}`}
            disabled={!myTurn}
            onClick={() => onAction({ type: 'end_turn' })}
          >
            {t('game.endTurn')}
          </button>
          <button
            className="btn btn-danger btn-icon"
            disabled={state.phase !== 'playing' || !canAct}
            onClick={() => confirm('Abandonner la partie ?') && onAction({ type: 'resign' })}
            aria-label="Abandonner"
          >
            <ActionIcon k="flag" size={18} />
          </button>
        </div>
      </div>

      {/* Roue d'actions — ancrée sur la pièce touchée, sans fond de popup */}
      {wheelRoom !== null && wheelOptions.length > 0 && wheelAnchor && (
        <div className="wheel-catcher" onClick={closeWheel}>
          <div
            className={`wheel wheel-anchored ${wheelAnchor.side}`}
            style={{ left: wheelAnchor.x, top: wheelAnchor.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {wheelOptions.map((opt, i) => {
              const n = wheelOptions.length;
              // Répartition équilibrée tout autour du point (ex. 4 options :
              // haut, droite, bas, gauche). Départ en haut.
              const deg = -90 + (i / n) * 360;
              const rad = (deg * Math.PI) / 180;
              const r = 80;
              const x = Math.cos(rad) * r;
              const y = Math.sin(rad) * r;
              return (
                <button
                  key={i}
                  className="wheel-option"
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  onClick={() => pick(opt)}
                >
                  <span className="wheel-icon"><ActionIcon k={opt.icon} size={24} /></span>
                  <span className="wheel-label">{opt.label}</span>
                  <span className="wheel-cost">{opt.cost}</span>
                </button>
              );
            })}
            <button className="wheel-close" onClick={closeWheel}>✕</button>
          </div>
        </div>
      )}


      {/* Règles (à la demande, sans quitter la partie) */}
      {showRules && (
        <div className="wheel-overlay" onClick={() => setShowRules(false)}>
          <div className="log-modal rules-modal" onClick={(e) => e.stopPropagation()}>
            <div className="log-modal-header">
              <span>{t('home.rules')}</span>
              <button className="wheel-close-inline" onClick={() => setShowRules(false)}>✕</button>
            </div>
            <div className="rules-quick">
              <p><strong>{t('rules.goalLabel')} :</strong> {t('rules.goal')}</p>
              <p><strong>{t('rules.turnLabel')} :</strong> {t('rules.turn')}</p>
              <div className="rules-quick-section">{t('rules.actionsHeader')}</div>
              <p><ActionIcon k="footprint" size={14} /> <strong>{t('act.move')}</strong> {t('rules.act.move')}</p>
              <p><ActionIcon k="footsteps" size={14} /> <strong>{t('act.sprint')}</strong> {t('rules.act.sprint')}</p>
              <p><ActionIcon k="revolver" size={14} /> <strong>{t('act.shoot')}</strong> {t('rules.act.shoot')}</p>
              <p><ActionIcon k="ear" size={14} /> <strong>{t('act.listen')}</strong> {t('rules.act.listen')}</p>
              <p><ActionIcon k="dynamite" size={14} /> <strong>{t('act.trap')}</strong> {t('rules.act.trap')}</p>
              <p><ActionIcon k="detonator" size={14} /> <strong>{t('act.trigger')}</strong> {t('rules.act.trigger')}</p>
              <div className="rules-quick-section">{t('rules.roomsHeader')}</div>
              <p><ActionIcon k="antenna" size={14} /> <strong>{t('room.1')}</strong> {t('rules.room.foyer')}</p>
              <p><ActionIcon k="pot" size={14} /> <strong>{t('room.4')}</strong> {t('rules.room.kitchen')}</p>
              <p><ActionIcon k="hatch" size={14} /> <strong>{t('room.5')}</strong> {t('rules.room.library')}</p>
              <p><ActionIcon k="wave" size={14} /> <strong>{t('room.6')}</strong> {t('rules.room.bedroom')}</p>
              <p><ActionIcon k="jump" size={14} /> <strong>{t('room.7')}</strong> {t('rules.room.balcony')}</p>
              <p><ActionIcon k="timedynamite" size={14} /> <strong>{t('room.8')}</strong> {t('rules.room.basement')}</p>
              <p className="muted small">{t('rules.footer')}</p>
            </div>
          </div>
        </div>
      )}
      {/* Journal (à la demande) */}
      {showLog && (
        <div className="wheel-overlay" onClick={() => setShowLog(false)}>
          <div className="log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="log-modal-header">
              <span>{t('game.journal')}</span>
              <button className="wheel-close-inline" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div className="log">
              {[...visibleLog].reverse().map((e, i) => (
                <div key={i} className={`log-entry ${e.kind ?? ''}`}>{renderLog(e, t, playerNames)}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderRoom(area: string, id: RoomId) {
    const direct = directTargets.includes(id);
    const hasOptions = myTurn && optionsFor(id).length > 0;
    const clickable = direct || hasOptions;
    // Actions affichées au survol (PC) — mêmes options que la roue
    const hoverOpts = myTurn && !isSetup && !pendingForMe ? optionsFor(id) : [];
    const flooded = state.basementFlood.active && id === 8;
    const isCurrent = me.room === id && !isSetup;
    const isNeighbor = neighborRooms.includes(id);
    const isDelayedTarget = pickingDelayed && delayedTargets.includes(id);
    const isShootable = shootRooms.includes(id);
    return (
      <button
        key={id}
        ref={(el) => {
          if (el) roomRefs.current.set(id, el);
        }}
        className={`room ${id === 8 ? 'basement' : ''} ${flooded ? 'flooded' : ''} ${clickable ? 'targetable' : 'not-targetable'} ${isCurrent ? 'current' : ''} ${isNeighbor ? 'neighbor' : ''} ${isDelayedTarget ? 'delayed-target' : ''} ${isShootable ? 'shootable' : ''}`}
        style={{ gridArea: area }}
        onClick={(e) => clickRoomEl(id, e)}
        data-room={id}
        aria-label={ROOMS[id].name}
      >
        <span className="room-name">{ROOMS[id].name}</span>
        <span className="room-tags">
          {isDelayedTarget && <span className="pas-mark delayed"><ActionIcon k="timedynamite" size={15} /></span>}
          {isNeighbor && !isDelayedTarget && <span className="pas-mark"><ActionIcon k={me.freeMoveAvailable && !isSetup && !pendingForMe ? 'runner' : 'footprint'} size={15} /></span>}
          {isShootable && !isDelayedTarget && <span className="shoot-mark"><ActionIcon k="revolver" size={15} /></span>}
          {ROOM_DECOR[id] && <span className="room-decor" aria-hidden="true">{ROOM_DECOR[id]}</span>}
          {hoverOpts.length > 0 && (
            <span className="room-actions">
              {hoverOpts.map((opt, i) => (
                <span
                  key={i}
                  role="button"
                  className="room-action-chip"
                  title={`${opt.label} (${opt.cost})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(opt);
                  }}
                >
                  <ActionIcon k={opt.icon} size={13} /> {opt.label}
                </span>
              ))}
            </span>
          )}
          {me.traps.includes(id) && <span className="tag trap">piège</span>}
          {me.delayedTraps.includes(id) && <span className="tag delayed">retardé</span>}
          {flooded && <span className="tag flood">inondé</span>}
        </span>
      </button>
    );
  }
}
