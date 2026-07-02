interface Props {
  onBack: () => void;
}

export default function RulesScreen({ onBack }: Props) {
  return (
    <div className="container">
      <div className="panel rules-content">
        <div className="row spread mb">
          <h2>Règles du jeu</h2>
          <button className="btn" onClick={onBack}>← Retour</button>
        </div>

        <h3>Objectif</h3>
        <p>
          Chaque joueur se cache dans une maison de <strong>8 pièces</strong> avec <strong>2 points de vie (PV)</strong>.
          Le premier à réduire son adversaire à 0 PV gagne.
        </p>

        <h3>Tour de jeu</h3>
        <ul>
          <li>À chaque tour, le joueur actif reçoit <strong>2 points d'action (PA)</strong> — ou <strong>3 PA</strong> s'il commence son tour dans la Cuisine.</li>
          <li>Le tour se termine volontairement, ou automatiquement quand plus aucune action n'est possible.</li>
        </ul>

        <h3>Actions</h3>
        <ul>
          <li><strong>Se déplacer (1 PA)</strong> — vers une pièce adjacente. Fait disparaître le statut « révélé ». Sous-sol interdit s'il est inondé.</li>
          <li><strong>Double déplacement (2 PA)</strong> — jusqu'à 2 pièces d'un coup. Impossible avec un repli gratuit actif.</li>
          <li><strong>Tirer (2 PA)</strong> — sur sa propre pièce ou une pièce en ligne de vue. Touche : −1 PV. Le tireur est révélé jusqu'à son prochain déplacement et gagne un <strong>repli gratuit</strong> (un déplacement adjacent sans PA).</li>
          <li><strong>Écouter (1 PA)</strong> — l'adversaire doit désigner une pièce adjacente à sa position réelle.</li>
          <li><strong>Poser un piège (1 PA)</strong> — dans sa pièce. Maximum 2 pièges actifs, visibles seulement par leur propriétaire.</li>
          <li><strong>Activer un piège (1 PA)</strong> — déclenche un de ses pièges : −1 PV si l'adversaire s'y trouve.</li>
          <li><strong>Effet de pièce (coût variable)</strong> — révèle le joueur jusqu'à son prochain déplacement.</li>
          <li><strong>Abandon</strong> — l'adversaire gagne immédiatement.</li>
        </ul>

        <h3>Effets des pièces</h3>
        <ul>
          <li><strong>Foyer (N1, gratuit)</strong> — Échos : si l'adversaire est à l'étage, sa position exacte est révélée ; sinon il doit indiquer une pièce adjacente.</li>
          <li><strong>Salle à manger (N2)</strong> — aucun effet.</li>
          <li><strong>Hall (N3)</strong> — aucun effet.</li>
          <li><strong>Cuisine (N4, passif)</strong> — Ravitaillement : 3 PA si vous y commencez votre tour.</li>
          <li><strong>Bibliothèque (N5, 1 PA)</strong> — Trappe : un adversaire dans la Cuisine chute au Sous-sol. S'il est inondé : −1 PV et fuite forcée.</li>
          <li><strong>Chambre (N6, 1 PA)</strong> — Levier d'inondation : un adversaire au Sous-sol perd 1 PV et doit fuir. Le Sous-sol devient inaccessible jusqu'à votre prochain tour.</li>
          <li><strong>Balcon (N7, gratuit)</strong> — Saut : vous atterrissez dans la Cuisine, révélé jusqu'à votre prochain déplacement.</li>
          <li><strong>Sous-sol (N8, 1 PA)</strong> — Dispositif retardé : posez un piège dans n'importe quelle pièce ; il se déclenche automatiquement au début de votre prochain tour.</li>
        </ul>

        <h3>Adjacences</h3>
        <ul>
          <li>Foyer ↔ Balcon, Salle à manger, Cuisine, Sous-sol</li>
          <li>Salle à manger ↔ Foyer, Cuisine, Sous-sol</li>
          <li>Hall ↔ Bibliothèque, Chambre, Balcon</li>
          <li>Cuisine ↔ Foyer, Salle à manger, Chambre</li>
          <li>Bibliothèque ↔ Hall, Sous-sol</li>
          <li>Chambre ↔ Hall, Cuisine</li>
          <li>Balcon ↔ Foyer, Hall</li>
          <li>Sous-sol ↔ Foyer, Salle à manger, Bibliothèque</li>
        </ul>

        <h3>Lignes de tir</h3>
        <ul>
          <li>Foyer → Salle à manger, Cuisine</li>
          <li>Salle à manger → Foyer, Cuisine</li>
          <li>Hall → Bibliothèque, Chambre, Balcon</li>
          <li>Cuisine → Foyer, Salle à manger</li>
          <li>Bibliothèque → Hall, Balcon</li>
          <li>Chambre → Hall, Balcon</li>
          <li>Balcon → Foyer, Salle à manger, Cuisine, Hall</li>
          <li>Sous-sol → Foyer, Salle à manger</li>
        </ul>
        <p className="small muted mt">Un tir sur sa propre pièce est toujours possible.</p>
      </div>
    </div>
  );
}
