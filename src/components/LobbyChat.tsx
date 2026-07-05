import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { UiIcon } from './icons';
import { AvatarIcon } from './avatars';
import { supabase } from '../lib/supabase';

interface Props {
  userId: string;
  pseudo: string;
}

interface LobbyMsg {
  id: string;
  user_id: string;
  pseudo: string;
  text: string;
  created_at: string;
}

export default function LobbyChat({ userId, pseudo }: Props) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<LobbyMsg[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [ready, setReady] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;

    sb.from('lobby_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          setReady(false);
          return;
        }
        setMessages((data ?? []).slice().reverse());
      });

    const channel = sb
      .channel('lobby-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_messages' }, (payload) => {
        setMessages((prev) => [...prev.slice(-49), payload.new as LobbyMsg]);
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Récupère les avatars des auteurs des messages affichés (une seule fois par auteur)
  useEffect(() => {
    if (!supabase) return;
    const ids = Array.from(new Set(messages.map((m) => m.user_id))).filter((id) => !(id in avatars));
    if (ids.length === 0) return;
    supabase
      .from('profiles')
      .select('id, avatar')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return;
        setAvatars((prev) => {
          const next = { ...prev };
          for (const p of data) next[p.id] = p.avatar ?? '';
          return next;
        });
      });
  }, [messages, avatars]);

  async function submit() {
    const t = text.trim();
    if (!t || !supabase) return;
    setText('');
    await supabase.from('lobby_messages').insert({ user_id: userId, pseudo, text: t.slice(0, 300) });
  }

  return (
    <div className="lobby-chat">
      <div className="lobby-chat-header">{t('home.salon')}</div>
      <div className="lobby-chat-list" ref={listRef}>
        {!ready && (
          <div className="chat-empty">{t('home.salon.unavailable')}</div>
        )}
        {ready && messages.length === 0 && <div className="chat-empty">{t('home.salon.empty')}</div>}
        {ready &&
          messages.map((m) => (
            <div key={m.id} className={`chat-line ${m.user_id === userId ? 'mine' : 'theirs'}`}>
              {avatars[m.user_id] && <span className="chat-line-avatar"><AvatarIcon avatar={avatars[m.user_id]} size={14} /></span>}
              <span className="chat-line-name">{m.user_id === userId ? 'Vous' : m.pseudo}</span>
              <span className="chat-line-text">{m.text}</span>
            </div>
          ))}
      </div>
      {ready && (
        <div className="lobby-chat-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('home.salon.write')}
            maxLength={300}
          />
          <button className="chat-send" onClick={submit} disabled={!text.trim()} aria-label="Envoyer"><UiIcon k="send" size={18} /></button>
        </div>
      )}
    </div>
  );
}
