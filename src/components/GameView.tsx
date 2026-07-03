import { useEffect, useMemo, useState } from 'react';
import { ADJACENCY, ALL_ROOMS, LINE_OF_SIGHT, ROOMS, RoomId, reachable } from '../game/board';
import { GameAction, GameState, PlayerIndex, roomEffectCost } from '../game/engine';

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
}

const EFFECT_INFO: Partial<Record<RoomId, { icon: string; label: string }>> = {
  1: { icon: '🔔', label: 'Échos' },
  4: { icon: '🍲', label: 'Ravitailler' },
  5: { icon: '🕳️', label: 'Trappe' },
  6: { icon: '🌊', label: 'Inonder' },
  7: { icon: '🪂', label: 'Sauter' },
};

export default function GameView({ state, viewer, canAct, onAction, playerNames, error, deadline }: Props) {
  /** Journal façon partie parlée : les pseudos remplacent "Joueur 1/2". */
  const named = (text: string) =>
    text
      .replace(/[Ll]e joueur ([12])/g, (_, d) => playerNames[Number(d) - 1])
      .replace(/[Jj]oueur ([12])/g, (_, d) => playerNames[Number(d) - 1]);
  const [wheelRoom, setWheelRoom] = useState<RoomId | null>(null);
  const [wheelAnchor, setWheelAnchor] = useState<{ x: number; y: number; side: 'left' | 'right' } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const me = state.players[viewer];
  const foe = state.players[viewer === 0 ? 1 : 0];
  const foeIndex: PlayerIndex = viewer === 0 ? 1 : 0;
  const isSetup = state.phase === 'setup';
  const pendingForMe = Boolean(state.pending && state.pending.responder === viewer);
  const myTurn = state.phase === 'playing' && state.active === viewer && !state.pending && canAct;

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

  const legendText: string | null = useMemo(() => {
    const names = neighborRooms.map((r) => ROOMS[r].name).join(', ');
    if (myTurn && me.room !== null && neighborRooms.length > 0) return `Depuis ${ROOMS[me.room].name} → ${names}`;
    if (pendingForMe && state.pending?.kind === 'listen' && neighborRooms.length > 0) return `Pièces voisines : ${names}`;
    if (pendingForMe && state.pending?.kind === 'escape' && neighborRooms.length > 0) return `Fuyez vers : ${names}`;
    return null;
  }, [neighborRooms, myTurn, me.room, pendingForMe, state.pending]);

  function optionsFor(room: RoomId): WheelOption[] {
    if (!myTurn || me.room === null) return [];
    const opts: WheelOption[] = [];
    const flooded = state.basementFlood.active;
    const dist1 = ADJACENCY[me.room].includes(room) && !(flooded && room === 8);
    const dist2 = reachable(me.room, 2, flooded).includes(room);

    if (dist1 && (me.freeMoveAvailable || me.ap >= 1)) {
      opts.push(
        me.freeMoveAvailable
          ? { icon: '🪶', label: 'Repli', cost: 'gratuit', action: { type: 'move', room } }
          : { icon: '👣', label: 'Aller', cost: '1 PA', action: { type: 'move', room } },
      );
    }
    if (!dist1 && room !== me.room && dist2 && !me.freeMoveAvailable && me.ap >= 2) {
      opts.push({ icon: '🏃', label: 'Sprint', cost: '2 PA', action: { type: 'double_move', room } });
    }
    if ((room === me.room || LINE_OF_SIGHT[me.room].includes(room)) && me.ap >= 2) {
      opts.push({ icon: '🔫', label: 'Tirer', cost: '2 PA', action: { type: 'shoot', room } });
    }
    if (me.traps.includes(room) && me.ap >= 1) {
      opts.push({ icon: '💥', label: 'Déclencher', cost: '1 PA', action: { type: 'activate_trap', room } });
    }
    if (
      me.room === 8 &&
      me.ap >= 1 &&
      me.traps.length + me.delayedTraps.length < 2 &&
      !me.traps.includes(room) &&
      !me.delayedTraps.includes(room)
    ) {
      opts.push({ icon: '⏳', label: 'Retardé', cost: '1 PA', action: { type: 'activate_room', room } });
    }
    if (room === me.room) {
      if (me.ap >= 1) {
        opts.push({ icon: '👂', label: 'Écouter', cost: '1 PA', action: { type: 'listen' } });
      }
      if (me.ap >= 1 && me.traps.length + me.delayedTraps.length < 2 && !me.traps.includes(room)) {
        opts.push({ icon: '🪤', label: 'Piège', cost: '1 PA', action: { type: 'trap' } });
      }
      const cost = roomEffectCost(state, viewer);
      const info = EFFECT_INFO[room];
      if (cost !== null && info && me.ap >= cost) {
        opts.push({
          icon: info.icon,
          label: info.label,
          cost: cost === 0 ? 'gratuit' : `${cost} PA`,
          action: { type: 'activate_room' },
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
    if (optionsFor(room).length > 0) setWheelRoom(room);
  }

  /** Ouvre la roue directement sur la pièce touchée, avec un arc orienté
   *  vers le centre de l'écran pour rester visible. */
  function clickRoomEl(room: RoomId, el: HTMLButtonElement) {
    clickRoom(room);
    if (isSetup || pendingForMe) return;
    if (optionsFor(room).length === 0) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const side: 'left' | 'right' = cx > window.innerWidth / 2 ? 'left' : 'right';
    const margin = 152;
    const x = Math.min(Math.max(cx, margin), window.innerWidth - margin);
    const y = Math.min(Math.max(cy, margin), window.innerHeight - margin);
    setWheelAnchor({ x, y, side });
  }

  function pick(opt: WheelOption) {
    setWheelRoom(null);
    setWheelAnchor(null);
    onAction(opt.action);
  }

  function closeWheel() {
    setWheelRoom(null);
    setWheelAnchor(null);
  }

  const visibleLog = state.log.filter((e) => e.visibility === 'both' || e.visibility === viewer);
  const lastEvents = visibleLog
    .filter((e) => !e.text.startsWith('Tour '))
    .slice(-2);
  const wheelOptions = wheelRoom !== null ? optionsFor(wheelRoom) : [];

  const turnLabel = isSetup
    ? canAct
      ? 'Choisissez votre cachette'
      : "L'adversaire se cache…"
    : pendingForMe
      ? state.pending?.kind === 'escape'
        ? 'Fuyez le sous-sol'
        : 'Répondez'
      : state.pending
        ? 'Attente…'
        : state.phase === 'finished'
          ? 'Terminé'
          : myTurn
            ? 'Votre tour'
            : "Tour adverse";

  return (
    <div className="game-with-bar">
      {/* Ligne de statut unique */}
      <div className="top-strip">
        <span className={`turn-indicator ${myTurn ? 'my-turn' : ''}`}>{turnLabel}</span>
        {state.phase === 'playing' && !state.pending && (
          <span className="ap-strip">⚡{state.players[state.active].ap}</span>
        )}
        {secondsLeft !== null && state.phase !== 'finished' && (
          <span className={`turn-timer ${secondsLeft <= 10 ? 'urgent' : ''}`}>⏱ {secondsLeft}s</span>
        )}
        <span className="opp-stats">
          <span className="avatar foe" title={playerNames[foeIndex]}>{(playerNames[foeIndex] || 'A')[0].toUpperCase()}</span>
          <span className="hp-heart">{'♥'.repeat(Math.max(0, foe.hp))}{'♡'.repeat(Math.max(0, 2 - foe.hp))}</span>
          {foe.revealedUntilMove && <span className="status revealed">révélé</span>}
        </span>
        <button className="log-toggle" onClick={() => setShowRules(true)} aria-label="Règles">❓</button>
        <button className="log-toggle" onClick={() => setShowLog(true)} aria-label="Journal">📜</button>
      </div>

      {(isSetup || pendingForMe || (state.pending && !pendingForMe)) && (
        <div className="prompt-mini">
          {isSetup && canAct && 'Touchez une pièce pour vous y cacher, en secret.'}
          {isSetup && !canAct && "L'adversaire choisit sa position…"}
          {pendingForMe && state.pending?.kind === 'listen' &&
            `${state.pending.source === 'echo' ? 'Échos' : 'Écoute'} — touchez une pièce adjacente à votre position réelle.`}
          {pendingForMe && state.pending?.kind === 'escape' && 'Touchez une pièce de refuge adjacente.'}
          {state.pending && !pendingForMe && "En attente de l'adversaire…"}
        </div>
      )}
      {error && <div className="error-box error-mini">{error}</div>}
      {legendText && <div className="legend-banner">{legendText}</div>}


      {/* Dernière action, bien visible */}
      {lastEvents.length > 0 && (
        <div className="ticker">
          {lastEvents.map((e, i) => (
            <div key={`${e.turn}-${e.text}-${i}`} className={`ticker-line ${e.kind ?? ''} ${i === lastEvents.length - 1 ? 'latest' : ''}`}>
              {named(e.text)}
            </div>
          ))}
        </div>
      )}
      {/* Plateau — occupe l'essentiel de l'écran */}
      <div className="board-wrap">
        <div className="board">
          <div className="floor-label first" style={{ gridArea: 'lbl2' }}>Étage</div>
          {renderRoom('n6', 6)}
          {renderRoom('n3', 3)}
          {renderRoom('n5', 5)}
          {renderRoom('n7', 7)}
          <div className="floor-label" style={{ gridArea: 'lbl1' }}>Rez-de-chaussée</div>
          {renderRoom('n4', 4)}
          {renderRoom('n1', 1)}
          {renderRoom('n2', 2)}
          <div className="floor-label" style={{ gridArea: 'lbl0' }}>Sous-sol</div>
          {renderRoom('n8', 8)}
        </div>
      </div>

      {/* Barre fixe : mes stats + fin de tour */}
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <span className="bar-stats">
            <span className="avatar me" title={playerNames[viewer]}>{(playerNames[viewer] || 'V')[0].toUpperCase()}</span>
            <span className="hp-heart">{'♥'.repeat(Math.max(0, me.hp))}{'♡'.repeat(Math.max(0, 2 - me.hp))}</span>
            <span className="ap-pip">⚡{me.ap}</span>
            {me.freeMoveAvailable && <span className="status" style={{ color: 'var(--gold)' }}>repli</span>}
          </span>
          <button className="btn" disabled={!myTurn} onClick={() => onAction({ type: 'end_turn' })}>
            Fin de tour
          </button>
          <button
            className="btn btn-danger btn-icon"
            disabled={state.phase !== 'playing' || !canAct}
            onClick={() => confirm('Abandonner la partie ?') && onAction({ type: 'resign' })}
            aria-label="Abandonner"
          >
            🏳
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
            <div className="wheel-center">
              <span className="wheel-room-name">{ROOMS[wheelRoom].name}</span>
            </div>
            {wheelOptions.map((opt, i) => {
              const n = wheelOptions.length;
              const facing = wheelAnchor.side === 'left' ? 180 : 0;
              const span = n > 1 ? Math.min(160, 46 * (n - 1)) : 0;
              const start = facing - span / 2;
              const deg = n > 1 ? start + (i / (n - 1)) * span : facing;
              const rad = (deg * Math.PI) / 180;
              const r = 108;
              const x = Math.cos(rad) * r;
              const y = Math.sin(rad) * r;
              return (
                <button
                  key={i}
                  className="wheel-option"
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  onClick={() => pick(opt)}
                >
                  <span className="wheel-icon">{opt.icon}</span>
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
              <span>Règles</span>
              <button className="wheel-close-inline" onClick={() => setShowRules(false)}>✕</button>
            </div>
            <div className="rules-quick">
              <p><strong>But :</strong> réduire l'adversaire à 0 ♥ (chacun en a 2).</p>
              <p><strong>Tour :</strong> 2 ⚡ (3 si vous commencez dans la Cuisine). Touchez une pièce pour agir.</p>
              <div className="rules-quick-section">Actions</div>
              <p>👣 <strong>Aller</strong> (1⚡) — pièce voisine, vous redevenez caché.</p>
              <p>🏃 <strong>Sprint</strong> (2⚡) — jusqu'à 2 pièces.</p>
              <p>🔫 <strong>Tirer</strong> (2⚡) — votre pièce ou en ligne de vue. Vous êtes révélé, puis 🪶 repli gratuit.</p>
              <p>👂 <strong>Écouter</strong> (1⚡) — l'adversaire désigne une pièce voisine de la sienne.</p>
              <p>🪤 <strong>Piège</strong> (1⚡, max 2) — posé dans votre pièce, invisible pour l'autre.</p>
              <p>💥 <strong>Déclencher</strong> (1⚡) — active votre piège : −1♥ si l'adversaire y est.</p>
              <div className="rules-quick-section">Effets des pièces</div>
              <p>🔔 <strong>Foyer</strong> (gratuit) — révèle l'adversaire s'il est à l'étage, sinon il indique une pièce voisine.</p>
              <p>🍲 <strong>Cuisine</strong> (gratuit) — si vous y commencez votre tour, activez le ravitaillement : +1⚡ (vous êtes révélé).</p>
              <p>🕳️ <strong>Bibliothèque</strong> (1⚡) — un adversaire en Cuisine chute au Sous-sol.</p>
              <p>🌊 <strong>Chambre</strong> (1⚡) — inonde le Sous-sol : −1♥ à qui s'y trouve, accès bloqué un tour.</p>
              <p>🪂 <strong>Balcon</strong> (gratuit) — saut vers la Cuisine, vous êtes révélé.</p>
              <p>⏳ <strong>Sous-sol</strong> (1⚡) — piège retardé n'importe où, se déclenche à votre prochain tour.</p>
              <p className="muted small">Activer un effet vous révèle jusqu'à votre prochain déplacement. ⏱ 60 s par tour, 2 tours inactifs = forfait.</p>
            </div>
          </div>
        </div>
      )}
      {/* Journal (à la demande) */}
      {showLog && (
        <div className="wheel-overlay" onClick={() => setShowLog(false)}>
          <div className="log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="log-modal-header">
              <span>Journal</span>
              <button className="wheel-close-inline" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div className="log">
              {[...visibleLog].reverse().map((e, i) => (
                <div key={i} className={`log-entry ${e.kind ?? ''}`}>{e.text}</div>
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
    const flooded = state.basementFlood.active && id === 8;
    const showMe = me.room === id && !isSetup;
    const showFoe = foe.room === id && (foe.revealedUntilMove || state.phase === 'finished');
    const isCurrent = me.room === id && !isSetup;
    const isNeighbor = neighborRooms.includes(id);
    return (
      <button
        key={id}
        className={`room ${id === 8 ? 'basement' : ''} ${flooded ? 'flooded' : ''} ${clickable ? 'targetable' : 'not-targetable'} ${isCurrent ? 'current' : ''} ${isNeighbor ? 'neighbor' : ''}`}
        style={{ gridArea: area }}
        onClick={(e) => clickRoomEl(id, e.currentTarget)}
        aria-label={ROOMS[id].name}
      >
        <span className="room-name">{ROOMS[id].name}</span>
        <span className="room-tags">
          {showMe && <span className="token me" title={playerNames[viewer]}>{(playerNames[viewer] || 'V')[0].toUpperCase()}</span>}
          {showFoe && <span className="token foe" title={playerNames[viewer === 0 ? 1 : 0]}>{(playerNames[viewer === 0 ? 1 : 0] || 'A')[0].toUpperCase()}</span>}
          {me.traps.includes(id) && <span className="tag trap">piège</span>}
          {me.delayedTraps.includes(id) && <span className="tag delayed">retardé</span>}
          {flooded && <span className="tag flood">inondé</span>}
        </span>
      </button>
    );
  }
}
