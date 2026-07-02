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
        <img src="/map.jpg" alt="Plan de la maison" className="hero-map" />
        <h1>Revolver Noir</h1>
        <p className="tagline">
          {pseudo ? `Bienvenue, ${pseudo}.` : 'Bienvenue, chasseur.'} Traquez votre adversaire dans la maison — ou
          devenez sa proie.
        </p>
        <div className="rule" />
      </div>

      <div className="mode-grid">
        <button className="mode-card" onClick={onLocal}>
          <span className="icon">⚔</span>
          <h3>Partie locale</h3>
          <p>Deux joueurs sur le même appareil. L'écran se voile entre chaque tour pour garder vos secrets.</p>
        </button>
        <button className="mode-card" onClick={onOnline} disabled={!onlineEnabled} style={!onlineEnabled ? { opacity: 0.5 } : undefined}>
          <span className="icon">🌐</span>
          <h3>Multijoueur en ligne</h3>
          <p>
            {onlineEnabled
              ? 'Créez une partie et partagez son code, ou rejoignez un adversaire. Temps réel via Supabase.'
              : 'Connectez-vous avec un compte (et configurez Supabase) pour jouer en ligne.'}
          </p>
        </button>
        <button className="mode-card" onClick={onRules}>
          <span className="icon">📜</span>
          <h3>Règles du jeu</h3>
          <p>Le plateau, les huit pièces, les actions, les effets spéciaux et les conditions de victoire.</p>
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 26 }}>
        <button className="btn" onClick={onLogout}>Se déconnecter</button>
      </div>
    </div>
  );
}
