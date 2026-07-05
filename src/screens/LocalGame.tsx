import { useState } from 'react';
import GameView from '../components/GameView';
import { GameAction, GameState, PlayerIndex, applyAction, newGame } from '../game/engine';
import { useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

/** Qui doit avoir l'appareil en main ? */
function whoseDevice(s: GameState): PlayerIndex {
  if (s.phase === 'setup') return s.setupTurn;
  if (s.pending) return s.pending.responder;
  return s.active;
}

export default function LocalGame({ onBack }: Props) {
  const [state, setState] = useState<GameState>(() => newGame());
  const [holder, setHolder] = useState<PlayerIndex>(0); // qui regarde l'écran
  const [handoff, setHandoff] = useState<PlayerIndex | null>(0); // écran de passage
  const [error, setError] = useState<string | null>(null);

  const { t } = useI18n();
  const names: [string, string] = [t('game.player1'), t('game.player2')];

  function act(action: GameAction) {
    setError(null);
    try {
      const next = applyAction(state, holder, action);
      setState(next);
      const nextHolder = whoseDevice(next);
      if (next.phase !== 'finished' && nextHolder !== holder) {
        setHandoff(nextHolder);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (handoff !== null) {
    return (
      <div className="handoff">
        <h2>{t('local.passDevice')}</h2>
        <p>
          {t('local.handoff')} <strong>{names[handoff]}</strong>. {t('local.handoffHint')}
        </p>
        <button
          className="btn btn-gold btn-lg"
          onClick={() => {
            setHolder(handoff);
            setHandoff(null);
          }}
        >
          {t('local.ready')} {names[handoff]} — {t('local.readyShow')}
        </button>
      </div>
    );
  }

  return (
    <div className="container game-page">
      <div className="game-header">
        <button
          className="btn btn-icon"
          onClick={() => {
            if (state.phase === 'finished' || confirm('Quitter la partie en cours ?')) onBack();
          }}
          aria-label="Quitter"
        >
          ←
        </button>
        <span className="game-header-title">{names[holder]}</span>
      </div>

      <GameView
        state={state}
        viewer={holder}
        canAct={whoseDevice(state) === holder && state.phase !== 'finished'}
        onAction={act}
        playerNames={names}
        error={error}
      />

      {state.phase === 'finished' && (
        <div className="game-over">
          <h2>{state.winner !== null ? `${names[state.winner]} ${t('local.wins')}` : t('mp.over')}</h2>
          <p className="muted">{t('local.silence')}</p>
          <div className="row">
            <button className="btn btn-gold btn-lg" onClick={() => { setState(newGame()); setHolder(0); setHandoff(0); }}>
              {t('local.replay')}
            </button>
            <button className="btn btn-lg" onClick={onBack}>{t('local.home')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
