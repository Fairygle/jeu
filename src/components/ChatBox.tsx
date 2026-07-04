import { useEffect, useRef, useState } from 'react';
import { UiIcon } from './icons';

export interface ChatMessage {
  from: string; // userId
  name: string;
  text: string;
  at: number;
}

interface Props {
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
  opponentName: string;
  opponentOnline: boolean;
}

export default function ChatBox({ messages, myId, onSend, opponentName, opponentOnline }: Props) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // N'affiche que les derniers messages dans la barre compacte
  const recent = messages.slice(-4);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 300));
    setText('');
  }

  return (
    <div className="chat-bar">
      <div className="chat-bar-status">
        <span className={`presence-dot ${opponentOnline ? 'on' : 'off'}`} />
        <span className="chat-bar-name">{opponentName}</span>
        <span className="chat-bar-state">{opponentOnline ? 'en ligne' : 'hors ligne'}</span>
      </div>
      <div className="chat-bar-messages" ref={scrollRef}>
        {recent.length === 0 && <div className="chat-empty">Écrivez un message à votre adversaire…</div>}
        {recent.map((m, i) => (
          <div key={i} className={`chat-line ${m.from === myId ? 'mine' : 'theirs'}`}>
            <span className="chat-line-name">{m.from === myId ? 'Vous' : m.name}</span>
            <span className="chat-line-text">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="chat-bar-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)}
          placeholder="Message…"
          maxLength={300}
        />
        <button className="chat-send" onClick={submit} disabled={!text.trim()} aria-label="Envoyer"><UiIcon k="send" size={18} /></button>
      </div>
    </div>
  );
}
