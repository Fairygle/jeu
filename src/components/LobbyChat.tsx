import { useEffect, useRef, useState } from 'react';
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
  const [messages, setMessages] = useState<LobbyMsg[]>([]);
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

  async function submit() {
    const t = text.trim();
    if (!t || !supabase) return;
    setText('');
    await supabase.from('lobby_messages').insert({ user_id: userId, pseudo, text: t.slice(0, 300) });
  }

  return (
    <div className="lobby-chat">
      <div className="lobby-chat-header">Salon</div>
      <div className="lobby-chat-list" ref={listRef}>
        {!ready && (
          <div className="chat-empty">Salon indisponible pour l'instant (migration serveur à faire).</div>
        )}
        {ready && messages.length === 0 && <div className="chat-empty">Personne n'a encore parlé…</div>}
        {ready &&
          messages.map((m) => (
            <div key={m.id} className={`chat-line ${m.user_id === userId ? 'mine' : 'theirs'}`}>
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
            placeholder="Écrire au salon…"
            maxLength={300}
          />
          <button className="chat-send" onClick={submit} disabled={!text.trim()} aria-label="Envoyer">➤</button>
        </div>
      )}
    </div>
  );
}
