import { useEffect, useRef, useState } from 'react';

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
}

export default function ChatBox({ messages, myId, onSend, opponentName }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const unread = open ? 0 : Math.max(0, messages.length - seen);

  useEffect(() => {
    if (open) {
      setSeen(messages.length);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 300));
    setText('');
  }

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Ouvrir le chat">
        💬{unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>

      {open && (
        <div className="chat-overlay" onClick={() => setOpen(false)}>
          <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              <span>Discussion — {opponentName}</span>
              <button className="wheel-close-inline" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && <div className="chat-empty">Aucun message. Dites bonjour !</div>}
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.from === myId ? 'mine' : 'theirs'}`}>
                  {m.from !== myId && <span className="chat-msg-name">{m.name}</span>}
                  <span className="chat-bubble">{m.text}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="chat-input-row">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Votre message…"
                maxLength={300}
              />
              <button className="btn btn-gold" onClick={submit} disabled={!text.trim()}>
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
