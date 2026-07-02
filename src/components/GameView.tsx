import { useMemo, useState } from 'react';
import { ALL_ROOMS, ROOMS, RoomId } from '../game/board';
import {
  GameAction,
  GameState,
  PlayerIndex,
  roomEffectCost,
  validTargets,
} from '../game/engine';

interface Props {
  state: GameState;
  /** Point de vue affiché (infos cachées filtrées pour ce joueur). */
  viewer: PlayerIndex;
  /** Le spectateur peut-il agir en ce moment ? */
  canAct: boolean;
  onAction: (action: GameAction) => void;
  playerNames: [string, string];
  error?: string | null;
}

type Targeting =
  | null
  | { action: 'move' | 'double_move' | 'shoot' | 'activate_trap' | 'activate_room' | 'listen_answer' | 'escape' };

export default function GameView({ state, viewer, canAct, onAction, playerNames, error }: Props) {
  const [targeting, setTargeting] = useState<Targeting>(null);

  const me = state.players[viewer];
  const foe = state.players[viewer === 0 ? 1 : 0];
  const foeIndex: PlayerIndex = viewer === 0 ? 1 : 0;
  const isSetup = state.phase === 'setup';
  const pendingForMe = state.pending && state.pending.responder === viewer;

  const targets: RoomId[] = useMemo(() => {
    if (isSetup) return canAct ? [...ALL_ROOMS] : [];
    if (pendingForMe && state.pending) {
      if (state.pending.kind === 'listen') return validTargets(state, viewer, 'listen_answer');
      return validTargets(state, viewer, 'escape');
    }
    if (!targeting || !canAct) return [];
    return validTargets(state, viewer, targeting.action);
  }, [state, viewer, targeting, canAct, isSetup, pendingForMe]);

  function clickRoom(room: RoomId) {
    if (!targets.includes(room)) return;
    if (isSetup) {
      onAction({ type: 'setup', room });
      return;
    }
    if (pendingForMe && state.pending) {
      onAction(state.pending.kind === 'listen' ? { type: 'listen_answer', room } : { type: 'escape', room });
      return;
    }
    if (!targeting) return;
    const a = targeting.action;
    setTargeting(null);
    if (a === 'activate_room') onAction({ type: 'activate_room', room });
    else if (a === 'move') onAction({ type: 'move', room });
    else if (a === 'double_move') onAction({ type: 'double_move', room });
    else if (a === 'shoot') onAction({ type: 'shoot', room });
    else if (a === 'activate_trap') onAction({ type: 'activate_trap', room });
  }

  function startAction(a: Exclude<Targeting, null>['action']) {
    setTargeting((t) => (t && t.action === a ? null : { action: a }));
  }

  function activateRoom() {
    // Le Sous-sol demande une cible ; les autres effets s'appliquent directement.
    if (me.room === 8) startAction('activate_room');
    else {
      setTargeting(null);
      onAction({ type: 'activate_room' });
    }
  }

  const effectCost = state.phase === 'playing' ? roomEffectCost(state, viewer) : null;
  const myTurn = state.phase === 'playing' && state.active === viewer && !state.pending;

  const visibleLog = state.log.filter((e) => e.visibility === 'both' || e.visibility === viewer);

  return (
    <div>
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
                {mine || state.phase === 'finished' ? (
                  <span className="ap-pip">{'◆'.repeat(p.ap)}{p.ap === 0 ? '·' : ''} {p.ap} PA</span>
                ) : (
                  <span className="ap-pip">{p.ap} PA</span>
                )}
                {p.revealedUntilMove && <span className="status revealed">révélé</span>}
                {mine && p.freeMoveAvailable && <span className="status" style={{ color: 'var(--gold)' }}>repli gratuit</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invites */}
      {isSetup && canAct && (
        <div className="prompt">Choisissez en secret votre pièce de départ en cliquant sur le plateau.</div>
      )}
      {isSetup && !canAct && <div className="prompt">L'adversaire choisit sa position…</div>}
      {pendingForMe && state.pending?.kind === 'listen' && (
        <div className="prompt">
          {state.pending.source === 'echo' ? 'Les échos résonnent' : "L'adversaire écoute"} : vous devez désigner une
          pièce <strong>adjacente à votre position réelle</strong>.
        </div>
      )}
      {pendingForMe && state.pending?.kind === 'escape' && (
        <div className="prompt">Vous devez fuir le Sous-sol ! Choisissez une pièce adjacente.</div>
      )}
      {state.pending && !pendingForMe && (
        <div className="prompt">En attente de la réponse de l'adversaire…</div>
      )}
      {targeting && (
        <div className="prompt">
          Choisissez une pièce cible ({actionLabel(targeting.action)}).{' '}
          <button className="btn" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setTargeting(null)}>
            Annuler
          </button>
        </div>
      )}
      {error && <div className="error-box">{error}</div>}

      <div className="game-layout">
        {/* Plateau */}
        <div className="panel">
          <div className="panel-title">La maison</div>
          <div className="board">
            <div className="floor-label first" style={{ gridArea: 'lbl2' }}>Étage</div>
            {renderRoom({ area: 'n6', id: 6 })}
            {renderRoom({ area: 'n3', id: 3 })}
            {renderRoom({ area: 'n5', id: 5 })}
            {renderRoom({ area: 'n7', id: 7 })}
            <div className="floor-label" style={{ gridArea: 'lbl1' }}>Rez-de-chaussée</div>
            {renderRoom({ area: 'n4', id: 4 })}
            {renderRoom({ area: 'n1', id: 1 })}
            {renderRoom({ area: 'n2', id: 2 })}
            <div className="floor-label" style={{ gridArea: 'lbl0' }}>Sous-sol</div>
            {renderRoom({ area: 'n8', id: 8 })}
          </div>
        </div>

        {/* Actions + journal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-title">Actions</div>
            <div className="actions-grid">
              <ActionBtn label="Se déplacer" cost={me.freeMoveAvailable ? 'gratuit' : '1 PA'} active={targeting?.action === 'move'}
                disabled={!myTurn || (!me.freeMoveAvailable && me.ap < 1)} onClick={() => startAction('move')} />
              <ActionBtn label="Double dépl." cost="2 PA" active={targeting?.action === 'double_move'}
                disabled={!myTurn || me.ap < 2 || me.freeMoveAvailable} onClick={() => startAction('double_move')} />
              <ActionBtn label="Tirer" cost="2 PA" active={targeting?.action === 'shoot'}
                disabled={!myTurn || me.ap < 2} onClick={() => startAction('shoot')} />
              <ActionBtn label="Écouter" cost="1 PA"
                disabled={!myTurn || me.ap < 1} onClick={() => { setTargeting(null); onAction({ type: 'listen' }); }} />
              <ActionBtn label="Poser un piège" cost="1 PA"
                disabled={!myTurn || me.ap < 1 || me.traps.length + me.delayedTraps.length >= 2 || (me.room !== null && me.traps.includes(me.room))}
                onClick={() => { setTargeting(null); onAction({ type: 'trap' }); }} />
              <ActionBtn label="Activer un piège" cost="1 PA" active={targeting?.action === 'activate_trap'}
                disabled={!myTurn || me.ap < 1 || me.traps.length === 0} onClick={() => startAction('activate_trap')} />
              <ActionBtn label="Effet de pièce" cost={effectCost === null ? '—' : effectCost === 0 ? 'gratuit' : `${effectCost} PA`}
                active={targeting?.action === 'activate_room'}
                disabled={!myTurn || effectCost === null || me.ap < (effectCost ?? 0)} onClick={activateRoom} />
              <ActionBtn label="Fin de tour" cost=""
                disabled={!myTurn} onClick={() => { setTargeting(null); onAction({ type: 'end_turn' }); }} />
            </div>
            <button
              className="btn btn-danger btn-block mt"
              disabled={state.phase !== 'playing'}
              onClick={() => {
                if (confirm('Abandonner la partie ?')) onAction({ type: 'resign' });
              }}
            >
              Abandonner
            </button>
          </div>

          <div className="panel">
            <div className="panel-title">Journal</div>
            <div className="log">
              {[...visibleLog].reverse().map((e, i) => (
                <div key={i} className={`log-entry ${e.kind ?? ''}`}>{e.text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function renderRoom({ area, id }: { area: string; id: RoomId }) {
    const targetable = targets.includes(id);
    const flooded = state.basementFlood.active && id === 8;
    const showMe = me.room === id && !isSetup;
    const showFoe = foe.room === id && (foe.revealedUntilMove || state.phase === 'finished');
    const myTrap = me.traps.includes(id);
    const myDelayed = me.delayedTraps.includes(id);
    return (
      <button
        key={id}
        className={`room ${id === 8 ? 'basement' : ''} ${flooded ? 'flooded' : ''} ${targetable ? 'targetable' : 'not-targetable'}`}
        style={{ gridArea: area }}
        onClick={() => clickRoom(id)}
        aria-label={ROOMS[id].name}
      >
        <span className="room-id">{ROOMS[id].short}</span>
        <span className="room-name">{ROOMS[id].name}</span>
        <span className="room-tags">
          {showMe && <span className="tag me">VOUS</span>}
          {showFoe && <span className="tag foe">ADVERSAIRE</span>}
          {myTrap && <span className="tag trap">piège</span>}
          {myDelayed && <span className="tag delayed">retardé</span>}
          {flooded && <span className="tag flood">inondé</span>}
        </span>
      </button>
    );
  }
}

function ActionBtn({ label, cost, disabled, onClick, active }: {
  label: string; cost: string; disabled?: boolean; onClick: () => void; active?: boolean;
}) {
  return (
    <button className={`btn ${active ? 'active' : ''}`} disabled={disabled} onClick={onClick}>
      <span>
        {label}
        {cost && <span className="action-cost"> · {cost}</span>}
      </span>
    </button>
  );
}

function actionLabel(a: string): string {
  switch (a) {
    case 'move': return 'déplacement';
    case 'double_move': return 'double déplacement';
    case 'shoot': return 'tir';
    case 'activate_trap': return 'activation de piège';
    case 'activate_room': return 'cible du dispositif retardé';
    default: return a;
  }
}
