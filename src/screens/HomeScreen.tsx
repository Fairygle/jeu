import { useCallback, useEffect, useRef, useState } from 'react';
import LobbyChat from '../components/LobbyChat';
import { UiIcon } from '../components/icons';
import BrandLogo from '../components/logo';
import { AvatarIcon } from '../components/avatars';
import { useI18n } from '../i18n';
import FriendsSidebar from '../components/FriendsSidebar';
import { newGame } from '../game/engine';
import { makeGameCode, supabase } from '../lib/supabase';

interface Props {
  pseudo: string | null;
  userId: string | null;
  onLocal: () => void;
  onCreateCode: () => void;
  onJoinCode: () => void;
  onEnterGame: (row: any) => void;
  onRules: () => void;
  onLogout: () => void;
  onlineEnabled: boolean;
}

type QuickPhase =
  | { k: 'idle' }
  | { k: 'searching'; rowId: string; since: number }
  | { k: 'found'; game: any } // je suis le chercheur, à moi de confirmer
  | { k: 'awaiting'; game: any; since: number } // j'ai confirmé, l'hôte doit confirmer
  | { k: 'proposed'; proposal: { id: string; pseudo: string }; rowId: string }; // on me propose un adversaire

const TURN_MS = 60_000;

export default function HomeScreen({
  pseudo,
  userId,
  onLocal,
  onCreateCode,
  onJoinCode,
  onEnterGame,
  onRules,
  onLogout,
  onlineEnabled,
}: Props) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [quick, setQuick] = useState<QuickPhase>({ k: 'idle' });
  const [tick, setTick] = useState(0); // pour les compteurs de secondes
  const [confirmDeadline, setConfirmDeadline] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const quickRef = useRef(quick);
  quickRef.current = quick;

  // Compteur de secondes pendant les attentes et les confirmations
  useEffect(() => {
    if (!['searching', 'awaiting', 'found', 'proposed'].includes(quick.k)) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [quick.k]);

  // Fenêtre de confirmation : 15 s, sinon refus automatique
  const CONFIRM_MS = 15_000;
  useEffect(() => {
    if (quick.k === 'found' || quick.k === 'proposed') {
      setConfirmDeadline(Date.now() + CONFIRM_MS);
    } else {
      setConfirmDeadline(null);
    }
  }, [quick.k]);

  useEffect(() => {
    if (!confirmDeadline) return;
    if (Date.now() >= confirmDeadline) {
      const q = quickRef.current;
      if (q.k === 'found') setQuick({ k: 'idle' });
      if (q.k === 'proposed') refuseAsHost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, confirmDeadline]);

  // Avatar choisi (pour l'affichage à côté du pseudo)
  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from('profiles').select('avatar').eq('id', userId).maybeSingle().then(({ data }) => {
      if (data?.avatar) setMyAvatar(data.avatar);
    });
  }, [userId]);

  // Joueurs en ligne (profils vus il y a moins de 70 s)
  useEffect(() => {
    if (!supabase || !userId) return;
    const sb = supabase;
    const count = async () => {
      const { count: c } = await sb
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('last_seen', new Date(Date.now() - 70_000).toISOString());
      if (c !== null) setOnlineCount(c);
    };
    count();
    const t = setInterval(count, 20_000);
    return () => clearInterval(t);
  }, [userId]);

  // Surveillance de ma partie en file d'attente (proposition / démarrage)
  useEffect(() => {
    if (quick.k !== 'searching' && quick.k !== 'proposed') return;
    if (!supabase) return;
    const sb = supabase;
    const rowId = quick.k === 'searching' ? quick.rowId : quick.rowId;
    const check = async () => {
      const { data } = await sb.from('games').select('*').eq('id', rowId).maybeSingle();
      const q = quickRef.current;
      if (!data) {
        setQuick({ k: 'idle' });
        return;
      }
      if (data.status === 'playing') {
        onEnterGame(data);
        return;
      }
      const prop = data.meta?.proposal;
      if (prop && q.k === 'searching') setQuick({ k: 'proposed', proposal: prop, rowId });
      if (!prop && q.k === 'proposed') setQuick({ k: 'searching', rowId, since: Date.now() });
    };
    const t = setInterval(check, 2000);
    return () => clearInterval(t);
  }, [quick.k, quick.k === 'searching' || quick.k === 'proposed' ? (quick as any).rowId : null]);

  // Surveillance quand j'attends la confirmation de l'hôte
  useEffect(() => {
    if (quick.k !== 'awaiting' || !supabase) return;
    const sb = supabase;
    const check = async () => {
      const q = quickRef.current;
      if (q.k !== 'awaiting') return;
      const { data } = await sb.from('games').select('*').eq('id', q.game.id).maybeSingle();
      if (!data) {
        setQuick({ k: 'idle' });
        return;
      }
      if (data.status === 'playing' && data.guest_id === userId) {
        onEnterGame(data);
        return;
      }
      if (!data.meta?.proposal) setQuick({ k: 'idle' }); // l'hôte a refusé
    };
    const t = setInterval(check, 2000);
    return () => clearInterval(t);
  }, [quick.k, userId]);

  const startQuick = useCallback(async () => {
    if (!supabase || !userId || !pseudo) return;
    // 1) Une partie en attente existe ?
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .filter('meta->>matchmaking', 'eq', 'true')
      .is('meta->proposal', null)
      .neq('host_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      setQuick({ k: 'found', game: data });
      return;
    }
    // 2) Personne : je me mets en file
    const { data: created } = await supabase
      .from('games')
      .insert({
        code: makeGameCode(),
        host_id: userId,
        host_pseudo: pseudo,
        state: newGame(),
        status: 'waiting',
        messages: [],
        meta: { matchmaking: true },
      })
      .select()
      .single();
    if (created) setQuick({ k: 'searching', rowId: created.id, since: Date.now() });
  }, [userId, pseudo]);

  async function cancelQuick() {
    if (!supabase) return;
    const q = quickRef.current;
    if (q.k === 'searching' || q.k === 'proposed') {
      await supabase.from('games').delete().eq('id', q.k === 'searching' ? q.rowId : q.rowId);
    }
    if (q.k === 'awaiting') {
      await supabase.from('games').update({ meta: { ...q.game.meta, proposal: null } }).eq('id', q.game.id);
    }
    setQuick({ k: 'idle' });
  }

  // Le chercheur confirme → il propose le match à l'hôte
  async function confirmAsSeeker() {
    if (!supabase || quick.k !== 'found' || !userId || !pseudo) return;
    const g = quick.game;
    const { data } = await supabase
      .from('games')
      .update({ meta: { ...g.meta, proposal: { id: userId, pseudo } } })
      .eq('id', g.id)
      .eq('status', 'waiting')
      .select()
      .maybeSingle();
    if (!data) {
      setQuick({ k: 'idle' });
      return;
    }
    setQuick({ k: 'awaiting', game: data, since: Date.now() });
  }

  // L'hôte accepte la proposition → la partie démarre
  async function acceptAsHost() {
    if (!supabase || quick.k !== 'proposed') return;
    const { proposal, rowId } = quick;
    const { data } = await supabase
      .from('games')
      .update({
        guest_id: proposal.id,
        guest_pseudo: proposal.pseudo,
        status: 'playing',
        meta: { deadline: Date.now() + TURN_MS, timeouts: [0, 0] },
      })
      .eq('id', rowId)
      .select()
      .maybeSingle();
    if (data) onEnterGame(data);
    else setQuick({ k: 'idle' });
  }

  async function refuseAsHost() {
    if (!supabase || quick.k !== 'proposed') return;
    const { rowId } = quick;
    const { data } = await supabase.from('games').select('meta').eq('id', rowId).maybeSingle();
    await supabase.from('games').update({ meta: { ...(data?.meta ?? {}), proposal: null } }).eq('id', rowId);
    setQuick({ k: 'searching', rowId, since: Date.now() });
  }

  const searchSeconds =
    quick.k === 'searching' || quick.k === 'awaiting'
      ? Math.floor((Date.now() - (quick as any).since) / 1000)
      : 0;

  return (
    <div className="container home-page">
      <div className="brand-row">
        <BrandLogo className="brand-thumb" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="brand-title">Revolver Noir</h1>
          <p className="brand-sub">
            {myAvatar && <span className="brand-sub-avatar"><AvatarIcon avatar={myAvatar} size={16} /></span>}
            {pseudo ?? ''}
            {onlineCount !== null && <span className="online-count"> · 🟢 {onlineCount} {t('home.online')}</span>}
          </p>
        </div>
        {userId && <FriendsSidebar userId={userId} />}
      </div>


      <div className="mode-row three">
        <button
          className={`mode-btn primary ${quick.k !== 'idle' ? 'busy' : ''}`}
          onClick={() => (quick.k === 'idle' ? startQuick() : cancelQuick())}
          disabled={!onlineEnabled}
        >
          <span className="mode-btn-icon"><UiIcon k="bolt" size={22} /></span>
          <span>
            {quick.k === 'idle' && t('home.quick')}
            {quick.k === 'searching' && `${t('home.searching')} ${String(searchSeconds).padStart(2, '0')}s ✕`}
            {quick.k === 'awaiting' && `${t('home.confirming')} ${String(searchSeconds).padStart(2, '0')}s ✕`}
            {(quick.k === 'found' || quick.k === 'proposed') && t('home.found')}
          </span>
        </button>
        <button className="mode-btn" onClick={() => setCreateOpen((v) => !v)}>
          <span className="mode-btn-icon"><UiIcon k="plus" size={22} /></span>
          <span>{t('home.create')}</span>
        </button>
        <button className="mode-btn" onClick={onJoinCode} disabled={!onlineEnabled}>
          <span className="mode-btn-icon"><UiIcon k="key" size={22} /></span>
          <span>{t('home.join')}</span>
        </button>
      </div>

      {createOpen && (
        <div className="create-choice">
          <button className="create-opt" onClick={onLocal}>
            <UiIcon k="house" size={16} /> {t('home.local')} <span className="muted small">{t('home.local.hint')}</span>
          </button>
          <button className="create-opt" onClick={onCreateCode} disabled={!onlineEnabled}>
            <UiIcon k="key" size={16} /> {t('home.codeMulti')}
          </button>
        </div>
      )}

      {/* Confirmation : je suis le chercheur */}
      {quick.k === 'found' && (
        <div className="match-confirm">
          <p>
            {t('home.opponent')} : <strong>{quick.game.host_pseudo}</strong>
            {confirmDeadline && (
              <span className="confirm-timer"> · {Math.max(0, Math.ceil((confirmDeadline - Date.now()) / 1000))}s</span>
            )}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-gold" style={{ flex: 1 }} onClick={confirmAsSeeker}>{t('home.accept')}</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => setQuick({ k: 'idle' })}>{t('home.refuse')}</button>
          </div>
        </div>
      )}

      {/* Confirmation : je suis l'hôte, on me propose un adversaire */}
      {quick.k === 'proposed' && (
        <div className="match-confirm">
          <p>
            {t('home.opponent')} : <strong>{quick.proposal.pseudo}</strong>
            {confirmDeadline && (
              <span className="confirm-timer"> · {Math.max(0, Math.ceil((confirmDeadline - Date.now()) / 1000))}s</span>
            )}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-gold" style={{ flex: 1 }} onClick={acceptAsHost}>{t('home.accept')}</button>
            <button className="btn" style={{ flex: 1 }} onClick={refuseAsHost}>{t('home.refuse')}</button>
          </div>
        </div>
      )}

      {userId && pseudo ? (
        <LobbyChat userId={userId} pseudo={pseudo} />
      ) : (
        <div className="lobby-chat lobby-chat-locked">
          <p className="muted small">Connectez-vous pour accéder au salon.</p>
        </div>
      )}

      <div className="row home-footer">
        <button className="btn btn-sm" onClick={onRules}><UiIcon k="scroll" size={15} />&nbsp;{t('home.rules')}</button>
        <button className="btn btn-sm" onClick={onLogout}><UiIcon k="exit" size={15} /> {t('home.logout')}</button>
      </div>
    </div>
  );
}
