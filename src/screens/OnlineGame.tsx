import { useCallback, useEffect, useRef, useState } from 'react';
import GameView from '../components/GameView';
import ChatBox, { ChatMessage } from '../components/ChatBox';
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
  messages: ChatMessage[] | null;
}

export default function OnlineGame({ userId, pseudo, onBack }: Props) {
  const [row, setRow] = useState<GameRow | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const rowRef = useRef<GameRow | null>(null);
  rowRef.current = row;

  const gameId = row?.id ?? null;

  const refresh = useCallback(async () => {
    if (!supabase || !rowRef.current) return;
    const { data } = await supabase.from('games').select('*').eq('id', rowRef.current.id).maybeSingle();
    if (data) setRow(data as GameRow);
    else {
      // La partie a été supprimée (adversaire a quitté depuis le lobby)
      setOpponentLeft(true);
    }
  }, []);

  // Realtime : changements de la partie + présence des joueurs
  useEffect(() => {
    if (!gameId || !supabase) return;
    const sb = supabase;

    const channel = sb.channel(`game-${gameId}`, { config: { presence: { key: userId } } });

    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => setRow(payload.new as GameRow),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => setOpponentLeft(true),
      )
      .on('presence', { event: 'sync' }, () => {
        const others = Object.keys(channel.presenceState()).filter((k) => k !== userId);
        setOpponentOnline(others.length > 0);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, at: Date.now() });
        }
      });

    const poll = setInterval(refresh, 2500);
    return () => {
      channel.untrack();
      sb.removeChannel(channel);
      clearInterval(poll);
    };
  }, [gameId, refresh, userId]);

  async function createGame() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const code = makeGameCode();
      const { data, error } = await supabase
        .from('games')
        .insert({ code, host_id: userId, host_pseudo: pseudo, state: newGame(), status: 'waiting', messages: [] })
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
        .eq('status', 'waiting')
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
      setRow({ ...row, state: next, status });
      const { error } = await supabase.from('games').update({ state: next, status }).eq('id', row.id);
      if (error) throw error;
    } catch (e: any) {
      setError(e.message);
      refresh();
    }
  }

  async function sendMessage(text: string) {
    if (!row || !supabase) return;
    const msg: ChatMessage = { from: userId, name: pseudo, text, at: Date.now() };
    const messages = [...(row.messages ?? []), msg].slice(-100);
    setRow({ ...row, messages });
    await supabase.from('games').update({ messages }).eq('id', row.id);
  }

  async function quitGame() {
    if (supabase && rowRef.current) {
      const r = rowRef.current;
      // Si la partie n'a pas encore commencé pour de bon, on la supprime ; sinon on la marque terminée.
      if (r.status === 'waiting') {
        await supabase.from('games').delete().eq('id', r.id);
      } else if (r.state.phase !== 'finished') {
        const me: PlayerIndex = r.host_id === userId ? 0 : 1;
        const abandoned = { ...r.state, phase: 'finished' as const, winner: (me === 0 ? 1 : 0) as PlayerIndex };
        await supabase.from('games').update({ state: abandoned, status: 'finished' }).eq('id', r.id);
      }
    }
    onBack();
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
          <p className="muted small">En attente d'un adversaire<span className="dots" /></p>
          <button className="btn btn-block mt" onClick={quitGame}>Annuler</button>
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
  const opponentName = names[me === 0 ? 1 : 0];

  return (
    <div className="container game-page">
      <div className="game-header">
        <button className="btn btn-icon" onClick={quitGame} aria-label="Quitter">←</button>
        <span className="game-header-title">Partie {row.code}</span>
      </div>

      <GameView
        state={s}
        viewer={me}
        canAct={myTurnToAct && s.phase !== 'finished'}
        onAction={act}
        playerNames={names}
        error={error}
      />

      <ChatBox
        messages={row.messages ?? []}
        myId={userId}
        onSend={sendMessage}
        opponentName={opponentName}
        opponentOnline={opponentOnline}
      />

      {/* Adversaire déconnecté pendant la partie */}
      {opponentLeft && s.phase !== 'finished' && (
        <div className="game-over">
          <h2>Adversaire déconnecté</h2>
          <p className="muted">{opponentName} a quitté la partie.</p>
          <button className="btn btn-gold btn-lg" onClick={onBack}>Retour à l'accueil</button>
        </div>
      )}

      {s.phase === 'finished' && (
        <div className="game-over">
          <h2>{s.winner === me ? 'Victoire !' : s.winner !== null ? 'Défaite…' : 'Partie terminée'}</h2>
          <p className="muted">{s.winner !== null ? `${names[s.winner]} l'emporte.` : ''}</p>
          <button className="btn btn-gold btn-lg" onClick={onBack}>Retour à l'accueil</button>
        </div>
      )}
    </div>
  );
}
