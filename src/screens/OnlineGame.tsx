import { useCallback, useEffect, useRef, useState } from 'react';
import GameView from '../components/GameView';
import ChatBox, { ChatMessage } from '../components/ChatBox';
import { ADJACENCY, ALL_ROOMS, RoomId } from '../game/board';
import { GameAction, GameState, PlayerIndex, applyAction, newGame } from '../game/engine';
import { makeGameCode, supabase } from '../lib/supabase';
import { useI18n } from '../i18n';

interface Props {
  userId: string;
  pseudo: string;
  onBack: () => void;
  initialMode?: 'code' | 'join';
  initialRow?: GameRow | null;
}

interface Meta {
  deadline?: number;
  timeouts?: [number, number];
  matchmaking?: boolean;
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
  meta: Meta | null;
}

const TURN_MS = 60_000; // 60 secondes par tour
const MAX_TIMEOUTS = 2; // 2 tours inactifs d'affilée = forfait

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Qui doit agir dans cet état ? */
function responsiblePlayer(s: GameState): PlayerIndex {
  if (s.phase === 'setup') return s.setupTurn;
  if (s.pending) return s.pending.responder;
  return s.active;
}

/** Action jouée automatiquement pour un joueur inactif. */
function autoAction(s: GameState, who: PlayerIndex): GameAction {
  if (s.phase === 'setup') return { type: 'setup', room: pickRandom([...ALL_ROOMS]) };
  if (s.pending?.kind === 'listen') {
    const room = s.players[who].room as RoomId;
    return { type: 'listen_answer', room: pickRandom(ADJACENCY[room]) };
  }
  if (s.pending?.kind === 'escape') {
    return { type: 'escape', room: pickRandom(s.pending.options) };
  }
  return { type: 'end_turn' };
}

export default function OnlineGame({ userId, pseudo, onBack, initialMode = 'code', initialRow = null }: Props) {
  const [row, setRow] = useState<GameRow | null>(initialRow);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [foundGame, setFoundGame] = useState<GameRow | null>(null); // proposition de match
  const [searching, setSearching] = useState(false);
  const { t } = useI18n();
  const rowRef = useRef<GameRow | null>(null);
  rowRef.current = row;
  const autoQuickTried = useRef(false);

  const gameId = row?.id ?? null;
  const me: PlayerIndex = row ? (row.host_id === userId ? 0 : 1) : 0;

  const refresh = useCallback(async () => {
    if (!supabase || !rowRef.current) return;
    const { data } = await supabase.from('games').select('*').eq('id', rowRef.current.id).maybeSingle();
    if (data) setRow(data as GameRow);
    else setOpponentLeft(true);
  }, []);

  // Realtime + présence + polling de secours
  useEffect(() => {
    if (!gameId || !supabase) return;
    const sb = supabase;
    const channel = sb.channel(`game-${gameId}`, { config: { presence: { key: userId } } });
    channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => setRow(payload.new as GameRow))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => setOpponentLeft(true))
      .on('presence', { event: 'sync' }, () => {
        const others = Object.keys(channel.presenceState()).filter((k) => k !== userId);
        setOpponentOnline(others.length > 0);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ userId, at: Date.now() });
      });
    const poll = setInterval(refresh, 2500);
    return () => {
      channel.untrack();
      sb.removeChannel(channel);
      clearInterval(poll);
    };
  }, [gameId, refresh, userId]);

  // --- Chrono : passage automatique du tour + forfait d'inactivité ---
  useEffect(() => {
    if (!row || row.status !== 'playing' || row.state.phase === 'finished' || !supabase) return;
    const deadline = row.meta?.deadline;
    if (!deadline) return;

    const check = async () => {
      const r = rowRef.current;
      if (!r || r.status !== 'playing' || r.state.phase === 'finished') return;
      const dl = r.meta?.deadline;
      if (!dl) return;
      const who = responsiblePlayer(r.state);
      // Mon propre client agit vite (0,5 s de grâce) ; celui de l'adversaire
      // sert de filet de sécurité si je suis hors ligne (4 s de grâce).
      const grace = who === me ? 500 : 4000;
      if (Date.now() < dl + grace) return;

      const timeouts: [number, number] = [...(r.meta?.timeouts ?? [0, 0])] as [number, number];
      timeouts[who] += 1;
      try {
        const action: GameAction = timeouts[who] >= MAX_TIMEOUTS ? { type: 'resign' } : autoAction(r.state, who);
        const next = applyAction(r.state, who, action);
        const status = next.phase === 'finished' ? 'finished' : 'playing';
        const meta: Meta = { ...r.meta, deadline: Date.now() + TURN_MS, timeouts };
        setRow({ ...r, state: next, status, meta });
        await supabase!.from('games').update({ state: next, status, meta }).eq('id', r.id);
      } catch {
        /* état déjà modifié par l'autre client : le refresh remettra tout d'aplomb */
        refresh();
      }
    };

    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, [row?.id, row?.status, row?.meta?.deadline, me, refresh]);

  async function createGame(matchmaking: boolean) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const code = makeGameCode();
      const meta: Meta = matchmaking ? { matchmaking: true } : {};
      const { data, error } = await supabase
        .from('games')
        .insert({ code, host_id: userId, host_pseudo: pseudo, state: newGame(), status: 'waiting', messages: [], meta })
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

  // Recherche automatique : trouve une partie en attente, sinon en crée une
  async function searchGame() {
    if (!supabase) return;
    setBusy(true);
    setSearching(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'waiting')
        .filter('meta->>matchmaking', 'eq', 'true')
        .neq('host_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setFoundGame(data as GameRow); // → confirmation avant de rejoindre
      } else {
        await createGame(true); // personne : on se met en file d'attente
      }
    } catch (e: any) {
      setError(e.message ?? 'Recherche impossible.');
      setSearching(false);
    } finally {
      setBusy(false);
    }
  }

  // Depuis l'accueil : "Créer → code multi" crée le salon immédiatement
  useEffect(() => {
    if (initialMode === 'code' && !initialRow && !autoQuickTried.current && !row) {
      autoQuickTried.current = true;
      createGame(false);
    }
  }, [initialMode, row]);

  // Avatars des deux joueurs (pour le chat)
  useEffect(() => {
    if (!supabase || !row?.host_id) return;
    const ids = [row.host_id, row.guest_id].filter(Boolean) as string[];
    if (ids.length === 0) return;
    supabase
      .from('profiles')
      .select('id, avatar')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const p of data) if (p.avatar) map[p.id] = p.avatar;
        setAvatars(map);
      });
  }, [row?.host_id, row?.guest_id]);

  // Enregistre les stats (parties jouées/gagnées/tours) une seule fois par partie terminée
  const statsRecorded = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase || !row || row.state.phase !== 'finished') return;
    if (statsRecorded.current === row.id) return;
    statsRecorded.current = row.id;
    const meIdx: PlayerIndex = row.host_id === userId ? 0 : 1;
    const won = row.state.winner === meIdx;
    const turns = row.state.turnNumber;
    (async () => {
      const { data } = await supabase!.from('profiles').select('games_played, games_won, turns_sum').eq('id', userId).maybeSingle();
      await supabase!.from('profiles').upsert({
        id: userId,
        pseudo,
        games_played: (data?.games_played ?? 0) + 1,
        games_won: (data?.games_won ?? 0) + (won ? 1 : 0),
        turns_sum: (data?.turns_sum ?? 0) + turns,
      });
    })();
  }, [row?.id, row?.state.phase, userId, pseudo]);

  async function confirmJoin(target: GameRow) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const meta: Meta = { deadline: Date.now() + TURN_MS, timeouts: [0, 0] };
      const { data: updated, error } = await supabase
        .from('games')
        .update({ guest_id: userId, guest_pseudo: pseudo, status: 'playing', meta })
        .eq('id', target.id)
        .eq('status', 'waiting')
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        // Quelqu'un a été plus rapide : on relance la recherche
        setFoundGame(null);
        await searchGame();
        return;
      }
      setFoundGame(null);
      setSearching(false);
      setRow(updated as GameRow);
    } catch (e: any) {
      setError(e.message ?? 'Impossible de rejoindre la partie.');
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const { data, error } = await supabase.from('games').select('*').eq('code', code).eq('status', 'waiting').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Aucune partie en attente avec ce code.');
      if (data.host_id === userId) throw new Error('Vous êtes l’hôte de cette partie.');
      setFoundGame(data as GameRow); // même confirmation que la recherche auto
    } catch (e: any) {
      setError(e.message ?? 'Impossible de trouver la partie.');
    } finally {
      setBusy(false);
    }
  }

  async function act(action: GameAction) {
    if (!row || !supabase) return;
    setError(null);
    try {
      const next = applyAction(row.state, me, action);
      const status = next.phase === 'finished' ? 'finished' : 'playing';
      const timeouts: [number, number] = [...(row.meta?.timeouts ?? [0, 0])] as [number, number];
      timeouts[me] = 0; // agir remet mon compteur d'inactivité à zéro
      const meta: Meta = { ...row.meta, deadline: Date.now() + TURN_MS, timeouts };
      setRow({ ...row, state: next, status, meta });
      const { error } = await supabase.from('games').update({ state: next, status, meta }).eq('id', row.id);
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
      if (r.status === 'waiting') {
        await supabase.from('games').delete().eq('id', r.id);
      } else if (r.state.phase !== 'finished') {
        const quitter: PlayerIndex = r.host_id === userId ? 0 : 1;
        const abandoned = { ...r.state, phase: 'finished' as const, winner: (quitter === 0 ? 1 : 0) as PlayerIndex };
        await supabase.from('games').update({ state: abandoned, status: 'finished' }).eq('id', r.id);
      }
    }
    onBack();
  }

  // ------- Confirmation de partie trouvée -------
  if (foundGame && !row) {
    return (
      <div className="center-page">
        <div className="panel auth-card lobby-card" style={{ textAlign: 'center' }}>
          <h2>{t('home.found')}</h2>
          <p className="found-name">{foundGame.host_pseudo}</p>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-gold btn-block btn-lg" onClick={() => confirmJoin(foundGame)} disabled={busy}>
            {t('mp.join')}
          </button>
          <button
            className="btn btn-block mt"
            onClick={() => {
              setFoundGame(null);
              setSearching(false);
            }}
            disabled={busy}
          >
            {t('home.refuse')}
          </button>
        </div>
      </div>
    );
  }

  // ------- Lobby -------
  if (!row) {
    return (
      <div className="center-page">
        <div className="panel auth-card lobby-card">
          <div className="row spread mb">
            <h2>{t('mp.title')}</h2>
            <button className="btn btn-icon" onClick={onBack} aria-label="Retour">←</button>
          </div>
          {error && <div className="error-box">{error}</div>}
          <div className="row" style={{ gap: 8 }}>
            <input
              className="lobby-code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('mp.code')}
              maxLength={6}
            />
            <button className="btn" onClick={joinByCode} disabled={busy || joinCode.length !== 6}>
              {t('mp.join')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------- Salle d'attente -------
  if (row.status === 'waiting') {
    const isSearch = row.meta?.matchmaking;
    return (
      <div className="center-page">
        <div className="panel auth-card lobby-card" style={{ textAlign: 'center' }}>
          <h2>{isSearch ? t('mp.searchingTitle') : t('mp.created')}</h2>
          {!isSearch && <div className="code-badge mt">{row.code}</div>}
          <p className="muted small mt">{t('mp.waiting')}<span className="dots" /></p>
          <button className="btn btn-block mt" onClick={quitGame}>{t('mp.cancel')}</button>
        </div>
      </div>
    );
  }

  // ------- Partie -------
  const names: [string, string] = [row.host_pseudo || t('game.player1'), row.guest_pseudo || t('game.player2')];
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
        deadline={row.meta?.deadline ?? null}
      />

      <ChatBox
        messages={row.messages ?? []}
        myId={userId}
        onSend={sendMessage}
        opponentName={opponentName}
        opponentOnline={opponentOnline}
        myAvatar={avatars[userId] ?? null}
        opponentAvatar={avatars[me === 0 ? row.guest_id ?? '' : row.host_id] ?? null}
      />

      {opponentLeft && s.phase !== 'finished' && (
        <div className="game-over">
          <h2>{t('mp.disconnected')}</h2>
          <p className="muted">{opponentName} {t('mp.leftGame')}</p>
          <button className="btn btn-gold btn-lg" onClick={onBack}>{t('mp.backHome')}</button>
        </div>
      )}

      {s.phase === 'finished' && (
        <div className="game-over">
          <h2>{s.winner === me ? t('mp.victory') : s.winner !== null ? t('mp.defeat') : t('mp.over')}</h2>
          <p className="muted">{s.winner !== null ? `${names[s.winner]} ${t('mp.wins')}` : ''}</p>
          <button className="btn btn-gold btn-lg" onClick={onBack}>{t('mp.backHome')}</button>
        </div>
      )}
    </div>
  );
}
