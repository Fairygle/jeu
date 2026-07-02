import { useState } from 'react';
import LobbyChat from '../components/LobbyChat';

interface Props {
  pseudo: string | null;
  userId: string | null;
  onLocal: () => void;
  onQuickMatch: () => void;
  onCreateCode: () => void;
  onRules: () => void;
  onLogout: () => void;
  onlineEnabled: boolean;
}

export default function HomeScreen({
  pseudo,
  userId,
  onLocal,
  onQuickMatch,
  onCreateCode,
  onRules,
  onLogout,
  onlineEnabled,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="container home-page">
      <div className="brand-row">
        <img src={import.meta.env.BASE_URL + 'map.jpg'} alt="" className="brand-thumb" />
        <div>
          <h1 className="brand-title">Revolver Noir</h1>
          <p className="brand-sub">2 joueurs · 8 pièces · 1 survivant</p>
        </div>
      </div>

      <div className="mode-row">
        <button className="mode-btn primary" onClick={onQuickMatch} disabled={!onlineEnabled}>
          <span className="mode-btn-icon">⚡</span>
          <span>Partie rapide</span>
        </button>
        <button className="mode-btn" onClick={() => setCreateOpen((v) => !v)}>
          <span className="mode-btn-icon">➕</span>
          <span>Créer</span>
        </button>
      </div>

      {createOpen && (
        <div className="create-choice">
          <button className="create-opt" onClick={onLocal}>
            🏠 Local <span className="muted small">— même appareil</span>
          </button>
          <button className="create-opt" onClick={onCreateCode} disabled={!onlineEnabled}>
            🔑 Code multijoueur {!onlineEnabled && <span className="muted small">— connexion requise</span>}
          </button>
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
        <button className="btn btn-sm" onClick={onRules}>📜 Règles</button>
        <button className="btn btn-sm" onClick={onLogout}>Déconnexion</button>
      </div>
    </div>
  );
}
