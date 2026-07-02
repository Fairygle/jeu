import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  pseudo: string;
  last_seen: string;
}

interface FriendRow {
  id: string;
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
}

interface Props {
  userId: string;
  open: boolean;
  onClose: () => void;
}

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 90_000;
}

export default function FriendsPanel({ userId, open, onClose }: Props) {
  const [friends, setFriends] = useState<{ profile: Profile; row: FriendRow }[]>([]);
  const [incoming, setIncoming] = useState<{ profile: Profile; row: FriendRow }[]>([]);
  const [outgoing, setOutgoing] = useState<{ profile: Profile; row: FriendRow }[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: rows } = await supabase
      .from('friends')
      .select('*')
      .or(`requester.eq.${userId},addressee.eq.${userId}`);
    if (!rows) return;
    const otherIds = [...new Set(rows.map((r: FriendRow) => (r.requester === userId ? r.addressee : r.requester)))];
    let profiles: Profile[] = [];
    if (otherIds.length > 0) {
      const { data } = await supabase.from('profiles').select('*').in('id', otherIds);
      profiles = (data as Profile[]) ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const withProfile = (r: FriendRow) => {
      const otherId = r.requester === userId ? r.addressee : r.requester;
      const profile = byId.get(otherId);
      return profile ? { profile, row: r } : null;
    };
    const all = (rows as FriendRow[]).map(withProfile).filter(Boolean) as { profile: Profile; row: FriendRow }[];
    setFriends(all.filter((f) => f.row.status === 'accepted'));
    setIncoming(all.filter((f) => f.row.status === 'pending' && f.row.addressee === userId));
    setOutgoing(all.filter((f) => f.row.status === 'pending' && f.row.requester === userId));
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [open, load]);

  async function addFriend() {
    if (!supabase) return;
    const pseudo = search.trim();
    if (!pseudo) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: target } = await supabase.from('profiles').select('*').ilike('pseudo', pseudo).maybeSingle();
      if (!target) {
        setMsg(`Aucun joueur nommé « ${pseudo} ».`);
        return;
      }
      if (target.id === userId) {
        setMsg("C'est vous !");
        return;
      }
      const { error } = await supabase.from('friends').insert({ requester: userId, addressee: target.id, status: 'pending' });
      if (error) {
        setMsg(error.code === '23505' ? 'Demande déjà envoyée (ou déjà amis).' : error.message);
        return;
      }
      setMsg(`Demande envoyée à ${target.pseudo} !`);
      setSearch('');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function accept(row: FriendRow) {
    if (!supabase) return;
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', row.id);
    load();
  }

  async function remove(row: FriendRow) {
    if (!supabase) return;
    await supabase.from('friends').delete().eq('id', row.id);
    load();
  }

  if (!open) return null;

  return (
    <div className="friends-overlay" onClick={onClose}>
      <aside className="friends-panel" onClick={(e) => e.stopPropagation()}>
        <div className="friends-header">
          <span>Amis</span>
          <button className="wheel-close-inline" onClick={onClose}>✕</button>
        </div>

        <div className="friends-add">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFriend()}
            placeholder="Pseudo d'un joueur…"
            maxLength={40}
          />
          <button className="btn btn-gold" onClick={addFriend} disabled={busy || !search.trim()}>+</button>
        </div>
        {msg && <div className="friends-msg">{msg}</div>}

        <div className="friends-scroll">
          {incoming.length > 0 && (
            <>
              <div className="friends-section">Demandes reçues</div>
              {incoming.map(({ profile, row }) => (
                <div key={row.id} className="friend-item">
                  <span className="friend-name">{profile.pseudo}</span>
                  <span className="friend-actions">
                    <button className="btn friend-btn" onClick={() => accept(row)}>✓</button>
                    <button className="btn btn-danger friend-btn" onClick={() => remove(row)}>✕</button>
                  </span>
                </div>
              ))}
            </>
          )}

          <div className="friends-section">Mes amis ({friends.length})</div>
          {friends.length === 0 && <div className="friends-empty">Ajoutez des joueurs par leur pseudo.</div>}
          {friends
            .sort((a, b) => Number(isOnline(b.profile.last_seen)) - Number(isOnline(a.profile.last_seen)))
            .map(({ profile, row }) => (
              <div key={row.id} className="friend-item">
                <span className={`presence-dot ${isOnline(profile.last_seen) ? 'on' : 'off'}`} />
                <span className="friend-name">{profile.pseudo}</span>
                <span className="friend-state">{isOnline(profile.last_seen) ? 'en ligne' : 'hors ligne'}</span>
                <button className="btn btn-danger friend-btn" onClick={() => confirm(`Retirer ${profile.pseudo} ?`) && remove(row)}>✕</button>
              </div>
            ))}

          {outgoing.length > 0 && (
            <>
              <div className="friends-section">Demandes envoyées</div>
              {outgoing.map(({ profile, row }) => (
                <div key={row.id} className="friend-item">
                  <span className="friend-name muted">{profile.pseudo}</span>
                  <span className="friend-state">en attente…</span>
                  <button className="btn friend-btn" onClick={() => remove(row)}>✕</button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
