import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { UiIcon } from './icons';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n';

interface Props {
  userId: string;
}

interface Profile {
  id: string;
  pseudo: string;
  last_seen: string;
}

interface FriendRel {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
}

const ONLINE_MS = 70_000;

export default function FriendsSidebar({ userId }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rels, setRels] = useState<FriendRel[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [ready, setReady] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: r, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (error) {
      // Table absente : les migrations SQL n'ont pas encore été passées
      setReady(false);
      return;
    }
    setReady(true);
    const relations = (r ?? []) as FriendRel[];
    setRels(relations);
    const ids = [...new Set(relations.map((x) => (x.user_id === userId ? x.friend_id : x.user_id)))];
    if (ids.length > 0) {
      const { data: p } = await supabase.from('profiles').select('*').in('id', ids);
      const map: Record<string, Profile> = {};
      (p ?? []).forEach((x: Profile) => (map[x.id] = x));
      setProfiles(map);
    } else {
      setProfiles({});
    }
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function addFriend() {
    if (!supabase) return;
    setInfo(null);
    const name = search.trim();
    if (!name) return;
    const { data: found } = await supabase
      .from('profiles')
      .select('*')
      .ilike('pseudo', name)
      .neq('id', userId)
      .limit(1)
      .maybeSingle();
    if (!found) {
      setInfo(t('friends.notFound'));
      return;
    }
    const { error } = await supabase.from('friends').insert({ user_id: userId, friend_id: found.id });
    if (error) {
      setInfo(error.code === '23505' ? t('friends.alreadySent') : 'Impossible d’envoyer la demande.');
      return;
    }
    setInfo(`${t('friends.sentTo')} ${found.pseudo}.`);
    setSearch('');
    load();
  }

  async function accept(rel: FriendRel) {
    if (!supabase) return;
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', rel.id);
    load();
  }

  async function remove(rel: FriendRel) {
    if (!supabase) return;
    await supabase.from('friends').delete().eq('id', rel.id);
    load();
  }

  const isOnline = (p?: Profile) => Boolean(p && Date.now() - new Date(p.last_seen).getTime() < ONLINE_MS);
  const nameOf = (rel: FriendRel) => profiles[rel.user_id === userId ? rel.friend_id : rel.user_id]?.pseudo ?? '…';
  const profOf = (rel: FriendRel) => profiles[rel.user_id === userId ? rel.friend_id : rel.user_id];

  const incoming = rels.filter((r) => r.status === 'pending' && r.friend_id === userId);
  const outgoing = rels.filter((r) => r.status === 'pending' && r.user_id === userId);
  const accepted = rels.filter((r) => r.status === 'accepted');
  const onlineCount = accepted.filter((r) => isOnline(profOf(r))).length;

  return (
    <>
      <button className="friends-fab" onClick={() => setOpen(true)} aria-label="Amis">
        <UiIcon k="friends" size={20} />{incoming.length > 0 && <span className="chat-badge">{incoming.length}</span>}
      </button>

      {open && createPortal(
        <div className="friends-overlay" onClick={() => setOpen(false)}>
          <aside className="friends-panel" onClick={(e) => e.stopPropagation()}>
            <div className="friends-header">
              <span>{t('friends.title')} {accepted.length > 0 && <span className="muted small">({onlineCount} {t('friends.online')})</span>}</span>
              <button className="wheel-close-inline" onClick={() => setOpen(false)}>✕</button>
            </div>

            {!ready ? (
              <div className="friends-empty">
                {t('friends.unavailable')}
              </div>
            ) : (
              <div className="friends-body">
                <div className="friends-add">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addFriend()}
                    placeholder={t('friends.add')}
                    maxLength={40}
                  />
                  <button className="chat-send" onClick={addFriend} disabled={!search.trim()}>+</button>
                </div>
                {info && <div className="friends-info">{info}</div>}

                {incoming.length > 0 && (
                  <>
                    <div className="friends-section">{t('friends.requests')}</div>
                    {incoming.map((r) => (
                      <div key={r.id} className="friend-row">
                        <span className="friend-name">{nameOf(r)}</span>
                        <button className="mini-btn ok" onClick={() => accept(r)}>✓</button>
                        <button className="mini-btn no" onClick={() => remove(r)}>✕</button>
                      </div>
                    ))}
                  </>
                )}

                <div className="friends-section">{t('friends.mine')}</div>
                {accepted.length === 0 && <div className="friends-empty">{t('friends.none')}</div>}
                {accepted
                  .sort((a, b) => Number(isOnline(profOf(b))) - Number(isOnline(profOf(a))))
                  .map((r) => (
                    <div key={r.id} className="friend-row">
                      <span className={`presence-dot ${isOnline(profOf(r)) ? 'on' : 'off'}`} />
                      <span className="friend-name">{nameOf(r)}</span>
                      <span className="muted small" style={{ marginLeft: 'auto' }}>
                        {isOnline(profOf(r)) ? t('friends.online') : t('friends.offline')}
                      </span>
                      <button className="mini-btn no" title="Retirer" onClick={() => remove(r)}>✕</button>
                    </div>
                  ))}

                {outgoing.length > 0 && (
                  <>
                    <div className="friends-section">{t('friends.sent')}</div>
                    {outgoing.map((r) => (
                      <div key={r.id} className="friend-row">
                        <span className="friend-name muted">{nameOf(r)}</span>
                        <span className="muted small" style={{ marginLeft: 'auto' }}>{t('friends.pending')}</span>
                        <button className="mini-btn no" onClick={() => remove(r)}>✕</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
