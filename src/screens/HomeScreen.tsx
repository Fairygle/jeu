interface Props {
  pseudo: string | null;
  onLocal: () => void;
  onOnline: () => void;
  onRules: () => void;
  onLogout: () => void;
  onlineEnabled: boolean;
}

export default function HomeScreen({ pseudo, onLocal, onOnline, onRules, onLogout, onlineEnabled }: Props) {
  return (
    <div className="container">
      <div className="hero">
        <img src={import.meta.env.BASE_URL + "map.jpg"} alt="Plan de la maison" className="hero-map" />
        <h1>Revolver Noir</h1>
        <p className="tagline">2 joueurs · 8 pièces · 1 survivant</p>
        <div className="rule" />
      </div>

      <div className="mode-grid">
        <button className="mode-card" onClick={onLocal}>
          <span className="icon">⚔</span>
          <h3>Local</h3>
          <p>2 joueurs, même appareil.</p>
        </button>
        <button className="mode-card" onClick={onOnline} disabled={!onlineEnabled} style={!onlineEnabled ? { opacity: 0.5 } : undefined}>
          <span className="icon">🌐</span>
          <h3>En ligne</h3>
          <p>{onlineEnabled ? 'Code ou recherche rapide.' : 'Connexion requise.'}</p>
        </button>
        <button className="mode-card" onClick={onRules}>
          <span className="icon">📜</span>
          <h3>Règles</h3>
          <p>Comment jouer.</p>
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 22 }}>
        <button className="btn" onClick={onLogout}>Déconnexion</button>
      </div>
    </div>
  );
}
