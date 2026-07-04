import { useEffect, useMemo, useState } from 'react';
import { ADJACENCY, ALL_ROOMS, LINE_OF_SIGHT, ROOMS, RoomId, reachable } from '../game/board';
import { GameAction, GameState, PlayerIndex, roomEffectCost } from '../game/engine';
import { ActionIcon, Hearts } from './icons';
import { ROOM_DECOR } from './decor';
import { useGameEvents } from './useGameEvents';

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
  1: { icon: 'antenna', label: 'Échos' },
  4: { icon: 'pot', label: 'Ravitailler' },
  5: { icon: 'hatch', label: 'Trappe' },
  6: { icon: 'wave', label: 'Inonder' },
  7: { icon: 'jump', label: 'Sauter' },
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

  const gameEvent = useGameEvents(state, viewer);

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
    if (myTurn && me.room !== null && neighborRooms.length > 0)
      return `${me.freeMoveAvailable ? 'Repli' : 'Depuis'} ${me.freeMoveAvailable ? 'vers' : ROOMS[me.room].name} → ${names}`;
    if (pendingForMe && state.pending?.kind === 'listen' && neighborRooms.length > 0) return `Pièces voisines : ${names}`;
    if (pendingForMe && state.pending?.kind === 'escape' && neighborRooms.length > 0) return `Fuyez vers : ${names}`;
    return null;
  }, [neighborRooms, myTurn, me.room, me.freeMoveAvailable, pendingForMe, state.pending]);

  function optionsFor(room: RoomId): WheelOption[] {
    if (!myTurn || me.room === null) return [];
    const opts: WheelOption[] = [];
    const flooded = state.basementFlood.active;
    const dist1 = ADJACENCY[me.room].includes(room) && !(flooded && room === 8);
    const dist2 = reachable(me.room, 2, flooded).includes(room);

    if (dist1 && (me.freeMoveAvailable || me.ap >= 1)) {
      opts.push(
        me.freeMoveAvailable
          ? { icon: 'runner', label: 'Repli', cost: 'gratuit', action: { type: 'move', room } }
          : { icon: 'footprint', label: 'Aller', cost: '1 PA', action: { type: 'move', room } },
      );
    }
    if (!dist1 && room !== me.room && dist2 && !me.freeMoveAvailable && me.ap >= 2) {
      opts.push({ icon: 'footsteps', label: 'Sprint', cost: '2 PA', action: { type: 'double_move', room } });
    }
    if ((room === me.room || LINE_OF_SIGHT[me.room].includes(room)) && me.ap >= 2) {
      opts.push({ icon: 'revolver', label: 'Tirer', cost: '2 PA', action: { type: 'shoot', room } });
    }
    if (me.traps.includes(room) && me.ap >= 1) {
      opts.push({ icon: 'detonator', label: 'Déclencher', cost: '1 PA', action: { type: 'activate_trap', room } });
    }
    if (
      me.room === 8 &&
      me.ap >= 1 &&
      me.traps.length + me.delayedTraps.length < 2 &&
      !me.traps.includes(room) &&
      !me.delayedTraps.includes(room)
    ) {
      opts.push({ icon: 'timedynamite', label: 'Retardé', cost: '1 PA', action: { type: 'activate_room', room } });
    }
    if (room === me.room) {
      if (me.ap >= 1) {
        opts.push({ icon: 'ear', label: 'Écouter', cost: '1 PA', action: { type: 'listen' } });
      }
      if (me.ap >= 1 && me.traps.length + me.delayedTraps.length < 2 && !me.traps.includes(room)) {
        opts.push({ icon: 'dynamite', label: 'Piège', cost: '1 PA', action: { type: 'trap' } });
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

  /** Ouvre la roue centrée sur le point touché. */
  function clickRoomEl(room: RoomId, e: React.MouseEvent<HTMLButtonElement>) {
    clickRoom(room);
    if (isSetup || pendingForMe) return;
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
      {/* Bannière d'événement animée — un seul événement à la fois */}
      {gameEvent && (
        <div className={`event-banner ${gameEvent.weight} tone-${gameEvent.tone}`} key={gameEvent.id}>
          {gameEvent.icon && (
            <span className="event-icon">
              <ActionIcon k={gameEvent.icon} size={gameEvent.weight === 'major' ? 26 : 20} />
            </span>
          )}
          <span className="event-text">{named(gameEvent.text)}</span>
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
      <div className="board-wrap">
        <div className="board">
          <div className="floor-label first" style={{ gridArea: 'lbl2' }}>Étage</div>
          {renderRoom('n6', 6)}
          {renderRoom('n3', 3)}
          {renderRoom('n5', 5)}
          {renderRoom('n7', 7)}
          <div className="floor-label" style={{ gridArea: 'lbl1' }}>Rez-de-chaussée</div>
          <div className="stair stair-left" aria-hidden="true" />
          <div className="stair stair-mid" aria-hidden="true" />
          <div className="stair stair-right" aria-hidden="true" />
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
          <button className="btn" disabled={!myTurn} onClick={() => onAction({ type: 'end_turn' })}>
            Fin de tour
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
              <span>Règles</span>
              <button className="wheel-close-inline" onClick={() => setShowRules(false)}>✕</button>
            </div>
            <div className="rules-quick">
              <p><strong>But :</strong> réduire l'adversaire à 0 ♥ (chacun en a 2).</p>
              <p><strong>Tour :</strong> 2 ⚡ (3 si vous commencez dans la Cuisine). Touchez une pièce pour agir.</p>
              <div className="rules-quick-section">Actions</div>
              <p><ActionIcon k="footprint" size={14} /> <strong>Aller</strong> (1⚡) — pièce voisine, vous redevenez caché.</p>
              <p><ActionIcon k="footsteps" size={14} /> <strong>Sprint</strong> (2⚡) — jusqu'à 2 pièces.</p>
              <p><ActionIcon k="revolver" size={14} /> <strong>Tirer</strong> (2⚡) — votre pièce ou en ligne de vue. Vous êtes révélé, puis repli gratuit.</p>
              <p><ActionIcon k="ear" size={14} /> <strong>Écouter</strong> (1⚡) — l'adversaire désigne une pièce voisine de la sienne.</p>
              <p><ActionIcon k="dynamite" size={14} /> <strong>Piège</strong> (1⚡, max 2) — posé dans votre pièce, invisible pour l'autre.</p>
              <p><ActionIcon k="detonator" size={14} /> <strong>Déclencher</strong> (1⚡) — active votre piège : −1♥ si l'adversaire y est.</p>
              <div className="rules-quick-section">Effets des pièces</div>
              <p><ActionIcon k="antenna" size={14} /> <strong>Foyer</strong> (gratuit) — révèle l'adversaire s'il est à l'étage, sinon il indique une pièce voisine.</p>
              <p><ActionIcon k="pot" size={14} /> <strong>Cuisine</strong> (gratuit) — si vous y commencez votre tour, activez le ravitaillement : +1⚡ (vous êtes révélé).</p>
              <p><ActionIcon k="hatch" size={14} /> <strong>Bibliothèque</strong> (1⚡) — un adversaire en Cuisine chute au Sous-sol.</p>
              <p><ActionIcon k="wave" size={14} /> <strong>Chambre</strong> (1⚡) — inonde le Sous-sol : −1♥ à qui s'y trouve, accès bloqué un tour.</p>
              <p><ActionIcon k="jump" size={14} /> <strong>Balcon</strong> (gratuit) — saut vers la Cuisine, vous êtes révélé.</p>
              <p><ActionIcon k="timedynamite" size={14} /> <strong>Sous-sol</strong> (1⚡) — piège retardé n'importe où, se déclenche à votre prochain tour.</p>
              <p className="muted small">Activer un effet vous révèle jusqu'à votre prochain déplacement. 60 s par tour, 2 tours inactifs = forfait. Icônes : game-icons.net (CC BY).</p>
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
    // Actions affichées au survol (PC) — mêmes options que la roue
    const hoverOpts = myTurn && !isSetup && !pendingForMe ? optionsFor(id) : [];
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
        onClick={(e) => clickRoomEl(id, e)}
        data-room={id}
        aria-label={ROOMS[id].name}
      >
        <span className="room-name">{ROOMS[id].name}</span>
        <span className="room-tags">
          {isNeighbor && <span className="pas-mark"><ActionIcon k={me.freeMoveAvailable && !isSetup && !pendingForMe ? 'runner' : 'footprint'} size={15} /></span>}
          {ROOM_DECOR[id] && <span className="room-decor" aria-hidden="true">{ROOM_DECOR[id]}</span>}
          {showMe && <span className="token me" title={playerNames[viewer]}>{(playerNames[viewer] || 'V')[0].toUpperCase()}</span>}
          {showFoe && <span className="token foe" title={playerNames[viewer === 0 ? 1 : 0]}>{(playerNames[viewer === 0 ? 1 : 0] || 'A')[0].toUpperCase()}</span>}
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
