import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { UiIcon } from './icons';
import { AvatarIcon } from './avatars';

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
  myAvatar?: string | null;
  opponentAvatar?: string | null;
}

export default function ChatBox({ messages, myId, onSend, opponentName, opponentOnline, myAvatar, opponentAvatar }: Props) {
  const { t } = useI18n();
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
        {opponentAvatar && <AvatarIcon avatar={opponentAvatar} size={15} />}
        <span className="chat-bar-name">{opponentName}</span>
        <span className="chat-bar-state">{opponentOnline ? t('mp.online') : t('mp.offline')}</span>
      </div>
      <div className="chat-bar-messages" ref={scrollRef}>
        {recent.length === 0 && <div className="chat-empty">{t('chat.empty')}</div>}
        {recent.map((m, i) => {
          const mine = m.from === myId;
          const av = mine ? myAvatar : opponentAvatar;
          return (
            <div key={i} className={`chat-line ${mine ? 'mine' : 'theirs'}`}>
              {av && <span className="chat-line-avatar"><AvatarIcon avatar={av} size={14} /></span>}
              <span className="chat-line-name">{mine ? 'Vous' : m.name}</span>
              <span className="chat-line-text">{m.text}</span>
            </div>
          );
        })}
      </div>
      <div className="chat-bar-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)}
          placeholder={t('chat.message')}
          maxLength={300}
        />
        <button className="chat-send" onClick={submit} disabled={!text.trim()} aria-label="Envoyer"><UiIcon k="send" size={18} /></button>
      </div>
    </div>
  );
}
