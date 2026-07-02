import { useMemo, useState } from 'react';
import { ADJACENCY, ALL_ROOMS, LINE_OF_SIGHT, ROOMS, RoomId, reachable } from '../game/board';
import { GameAction, GameState, PlayerIndex, roomEffectCost } from '../game/engine';

interface Props {
  state: GameState;
  viewer: PlayerIndex;
  canAct: boolean;
  onAction: (action: GameAction) => void;
  playerNames: [string, string];
  error?: string | null;
}

interface WheelOption {
  icon: string;
  label: string;
  cost: string;
  action: GameAction;
}

const EFFECT_INFO: Partial<Record<RoomId, { icon: string; label: string }>> = {
  1: { icon: '🔔', label: 'Échos' },
  5: { icon: '🕳️', label: 'Trappe' },
  6: { icon: '🌊', label: 'Inonder' },
  7: { icon: '🪂', label: 'Sauter' },
};

export default function GameView({ state, viewer, canAct, onAction, playerNames, error }: Props) {
  const [wheelRoom, setWheelRoom] = useState<RoomId | null>(null);

  const me = state.players[viewer];
  const foe = state.players[viewer === 0 ? 1 : 0];
  const foeIndex: PlayerIndex = viewer === 0 ? 1 : 0;
  const isSetup = state.phase === 'setup';
  const pendingForMe = Boolean(state.pending && state.pending.responder === viewer);
  const myTurn = state.phase === 'playing' && state.active === viewer && !state.pending && canAct;

  // Pièces directement cliquables (setup / réponse à une écoute / fuite)
  const directTargets: RoomId[] = useMemo(() => {
    if (isSetup) return canAct ? [...ALL_ROOMS] : [];
    if (pendingForMe && state.pending) {
      if (state.pending.kind === 'listen') return me.room ? ADJACENCY[me.room] : [];
      return state.pending.options;
    }
    return [];
  }, [state, canAct, isSetup, pendingForMe, me.room]);

  /** Actions possibles sur une pièce donnée — c'est le contenu de la roue. */
  function optionsFor(room: RoomId): WheelOption[] {
    if (!myTurn || me.room === null) return [];
    const opts: WheelOption[] = [];
    const flooded = state.basementFlood.active;
    const dist1 = ADJACENCY[me.room].includes(room) && !(flooded && room === 8);
    const dist2 = reachable(me.room, 2, flooded).includes(room);

    // Déplacement simple / repli gratuit
    if (dist1 && (me.freeMoveAvailable || me.ap >= 1)) {
      opts.push(
        me.freeMoveAvailable
          ? { icon: '🪶', label: 'Repli', cost: 'gratuit', action: { type: 'move', room } }
          : { icon: '👣', label: 'Aller', cost: '1 PA', action: { type: 'move', room } },
      );
    }
    // Double déplacement (utile seulement à distance 2)
    if (!dist1 && room !== me.room && dist2 && !me.freeMoveAvailable && me.ap >= 2) {
      opts.push({ icon: '🏃', label: 'Sprint', cost: '2 PA', action: { type: 'double_move', room } });
    }
    // Tir (même pièce ou ligne de vue)
    if ((room === me.room || LINE_OF_SIGHT[me.room].includes(room)) && me.ap >= 2) {
      opts.push({ icon: '🔫', label: 'Tirer', cost: '2 PA', action: { type: 'shoot', room } });
    }
    // Déclencher un de mes pièges
    if (me.traps.includes(room) && me.ap >= 1) {
      opts.push({ icon: '💥', label: 'Déclencher', cost: '1 PA', action: { type: 'activate_trap', room } });
    }
    // Dispositif retardé (depuis le Sous-sol, vers n'importe quelle pièce)
    if (
      me.room === 8 &&
      me.ap >= 1 &&
      me.traps.length + me.delayedTraps.length < 2 &&
      !me.traps.includes(room) &&
      !me.delayedTraps.includes(room)
    ) {
      opts.push({ icon: '⏳', label: 'Retardé', cost: '1 PA', action: { type: 'activate_room', room } });
    }
    // Actions liées à MA pièce
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

  function pick(opt: WheelOption) {
    setWheelRoom(null);
    onAction(opt.action);
  }

  const visibleLog = state.log.filter((e) => e.visibility === 'both' || e.visibility === viewer);
  const wheelOptions = wheelRoom !== null ? optionsFor(wheelRoom) : [];

  return (
    <div className="game-with-bar">
      {/* HUD */}
      <div className="hud">
        {[viewer, foeIndex].map((idx) => {
          const p = state.players[idx];
          const mine = idx === viewer;
          return (
            <div key={idx} className={`hud-player ${state.active === idx && state.phase === 'playing' ? 'active-turn' : ''}`}>
              <div className="name">
                {playerNames[idx]} {mine ? '(vous)' : ''}
              </div>
              <div className="stats">
                <span className="hp-heart">{'♥'.repeat(Math.max(0, p.hp))}{'♡'.repeat(Math.max(0, 2 - p.hp))}</span>
                <span className="ap-pip">{p.ap} PA</span>
                {p.revealedUntilMove && <span className="status revealed">révélé</span>}
                {mine && p.freeMoveAvailable && <span className="status" style={{ color: 'var(--gold)' }}>repli gratuit</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invites */}
      {isSetup && canAct && <div className="prompt">Touchez une pièce pour vous y cacher, en secret.</div>}
      {isSetup && !canAct && <div className="prompt">L'adversaire choisit sa position…</div>}
      {pendingForMe && state.pending?.kind === 'listen' && (
        <div className="prompt">
          {state.pending.source === 'echo' ? 'Les échos résonnent' : "L'adversaire écoute"} : touchez une pièce{' '}
          <strong>adjacente à votre position réelle</strong>.
        </div>
      )}
      {pendingForMe && state.pending?.kind === 'escape' && (
        <div className="prompt">Vous devez fuir le Sous-sol ! Touchez une pièce de refuge.</div>
      )}
      {state.pending && !pendingForMe && <div className="prompt">En attente de la réponse de l'adversaire…</div>}
      {myTurn && !isSetup && (
        <div className="prompt hint">Touchez une pièce pour voir vos actions possibles.</div>
      )}
      {error && <div className="error-box">{error}</div>}

      {/* Plateau */}
      <div className="panel">
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

      {/* Journal */}
      <div className="panel mt">
        <div className="panel-title">Journal</div>
        <div className="log">
          {[...visibleLog].reverse().map((e, i) => (
            <div key={i} className={`log-entry ${e.kind ?? ''}`}>{e.text}</div>
          ))}
        </div>
      </div>

      {/* Barre d'action fixe */}
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <span className="bar-stats">
            <span className="hp-heart">{'♥'.repeat(Math.max(0, me.hp))}</span>{' '}
            <span className="ap-pip">{me.ap} PA</span>
          </span>
          <button className="btn" disabled={!myTurn} onClick={() => onAction({ type: 'end_turn' })}>
            ⏭ Fin de tour
          </button>
          <button
            className="btn btn-danger"
            disabled={state.phase !== 'playing' || !canAct}
            onClick={() => confirm('Abandonner la partie ?') && onAction({ type: 'resign' })}
          >
            🏳
          </button>
        </div>
      </div>

      {/* Roue d'actions */}
      {wheelRoom !== null && wheelOptions.length > 0 && (
        <div className="wheel-overlay" onClick={() => setWheelRoom(null)}>
          <div className="wheel" onClick={(e) => e.stopPropagation()}>
            <div className="wheel-center">
              <span className="wheel-room-id">{ROOMS[wheelRoom].short}</span>
              <span className="wheel-room-name">{ROOMS[wheelRoom].name}</span>
            </div>
            {wheelOptions.map((opt, i) => {
              const angle = (i / wheelOptions.length) * 2 * Math.PI - Math.PI / 2;
              const r = 118;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
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
            <button className="wheel-close" onClick={() => setWheelRoom(null)}>✕</button>
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
    return (
      <button
        key={id}
        className={`room ${id === 8 ? 'basement' : ''} ${flooded ? 'flooded' : ''} ${clickable ? 'targetable' : 'not-targetable'}`}
        style={{ gridArea: area }}
        onClick={() => clickRoom(id)}
        aria-label={ROOMS[id].name}
      >
        <span className="room-id">{ROOMS[id].short}</span>
        <span className="room-name">{ROOMS[id].name}</span>
        <span className="room-tags">
          {showMe && <span className="tag me">VOUS</span>}
          {showFoe && <span className="tag foe">ADVERSAIRE</span>}
          {me.traps.includes(id) && <span className="tag trap">piège</span>}
          {me.delayedTraps.includes(id) && <span className="tag delayed">retardé</span>}
          {flooded && <span className="tag flood">inondé</span>}
        </span>
      </button>
    );
  }
}
