import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import GameView from '../components/GameView';
import { GameAction, GameState, PlayerIndex, applyAction, newGame } from '../game/engine';
import { makeGameCode, supabase } from '../lib/supabase';

interface Props {
  userId: string;
  pseudo: string;
  onBack: () => void;
}

interface GameRow {
  id: string;
  code: string;
  host_id: string;
  host_pseudo: string;
  guest_id: string | null;
  guest_pseudo: string | null;
  state: GameState;
  status: 'waiting' | 'playing' | 'finished';
}

export default function OnlineGame({ userId, pseudo, onBack }: Props) {
  const [row, setRow] = useState<GameRow | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Abonnement temps réel à la partie en cours
  useEffect(() => {
    if (!row || !supabase) return;
    const sb = supabase;
    const channel = sb
      .channel(`game-${row.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${row.id}` },
        (payload) => setRow(payload.new as GameRow),
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  async function createGame() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const code = makeGameCode();
      const { data, error } = await supabase
        .from('games')
        .insert({
          code,
          host_id: userId,
          host_pseudo: pseudo,
          state: newGame(),
          status: 'waiting',
        })
        .select()
        .single();
      if (error) throw error;
      setRow(data as GameRow);
    } catch (e: any) {
      setError(e.message ?? 'Impossible de créer la partie.');
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const { data, error } = await supabase.from('games').select('*').eq('code', code).eq('status', 'waiting').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Aucune partie en attente avec ce code.');
      if (data.host_id === userId) throw new Error('Vous êtes l’hôte de cette partie.');
      const { data: updated, error: e2 } = await supabase
        .from('games')
        .update({ guest_id: userId, guest_pseudo: pseudo, status: 'playing' })
        .eq('id', data.id)
        .select()
        .single();
      if (e2) throw e2;
      setRow(updated as GameRow);
    } catch (e: any) {
      setError(e.message ?? 'Impossible de rejoindre la partie.');
    } finally {
      setBusy(false);
    }
  }

  async function act(action: GameAction) {
    if (!row || !supabase) return;
    setError(null);
    const me: PlayerIndex = row.host_id === userId ? 0 : 1;
    try {
      const next = applyAction(row.state, me, action);
      const status = next.phase === 'finished' ? 'finished' : 'playing';
      // Optimiste : on met à jour localement puis on pousse
      setRow({ ...row, state: next, status });
      const { error } = await supabase.from('games').update({ state: next, status }).eq('id', row.id);
      if (error) throw error;
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ------- Lobby -------
  if (!row) {
    return (
      <div className="center-page">
        <div className="panel auth-card">
          <div className="row spread mb">
            <h2 style={{ fontSize: 20 }}>Multijoueur</h2>
            <button className="btn" onClick={onBack}>← Retour</button>
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-gold btn-block btn-lg" onClick={createGame} disabled={busy}>
            Créer une partie
          </button>
          <div className="muted small" style={{ textAlign: 'center', margin: '14px 0' }}>— ou —</div>
          <div className="field">
            <label>Code de partie</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '0.3em', textAlign: 'center' }}
            />
          </div>
          <button className="btn btn-block" onClick={joinGame} disabled={busy || joinCode.length !== 6}>
            Rejoindre la partie
          </button>
        </div>
      </div>
    );
  }

  // ------- Salle d'attente -------
  if (row.status === 'waiting') {
    return (
      <div className="center-page">
        <div className="panel auth-card" style={{ textAlign: 'center' }}>
          <h2 className="mb">Partie créée</h2>
          <p className="muted mb">Partagez ce code avec votre adversaire :</p>
          <div className="code-badge mb">{row.code}</div>
          <p className="muted small">En attente d'un adversaire…</p>
          <button className="btn btn-block mt" onClick={async () => {
            if (supabase) await supabase.from('games').delete().eq('id', row.id);
            setRow(null);
          }}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // ------- Partie -------
  const me: PlayerIndex = row.host_id === userId ? 0 : 1;
  const names: [string, string] = [row.host_pseudo || 'Joueur 1', row.guest_pseudo || 'Joueur 2'];
  const s = row.state;
  const myTurnToAct =
    s.phase === 'setup' ? s.setupTurn === me : s.pending ? s.pending.responder === me : s.active === me;

  return (
    <div className="container">
      <div className="row spread mb">
        <h2 style={{ fontSize: 18 }}>Partie {row.code}</h2>
        <button className="btn" onClick={onBack}>← Quitter</button>
      </div>

      <GameView
        state={s}
        viewer={me}
        canAct={myTurnToAct && s.phase !== 'finished'}
        onAction={act}
        playerNames={names}
        error={error}
      />

      {s.phase === 'finished' && (
        <div className="game-over">
          <h2>{s.winner === me ? 'Victoire !' : s.winner !== null ? 'Défaite…' : 'Partie terminée'}</h2>
          <p className="muted">
            {s.winner !== null ? `${names[s.winner]} l'emporte.` : ''}
          </p>
          <button className="btn btn-gold btn-lg" onClick={onBack}>Retour à l'accueil</button>
        </div>
      )}
    </div>
  );
}
