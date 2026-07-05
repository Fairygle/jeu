import { useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

export default function RulesScreen({ onBack }: Props) {
  const { t, lang } = useI18n();
  return (
    <div className="container">
      <div className="panel rules-content">
        <div className="row spread mb">
          <h2>{t('home.rules')}</h2>
          <button className="btn" onClick={onBack}>← {t('mp.back')}</button>
        </div>

        {lang === 'fr' ? (
          <>
            <h3>Objectif</h3>
            <p>
              Chaque joueur se cache dans une maison de <strong>8 pièces</strong> avec <strong>2 points de vie (PV)</strong>.
              Le premier à réduire son adversaire à 0 PV gagne.
            </p>

            <h3>Tour de jeu</h3>
            <ul>
              <li>À chaque tour, le joueur actif reçoit <strong>2 points d'action (PA)</strong> — ou <strong>3 PA</strong> s'il commence son tour dans la Cuisine.</li>
              <li>Le tour se termine volontairement en cliquant « Fin de tour ».</li>
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
              <li><strong>Foyer (gratuit)</strong> — Échos : si l'adversaire est à l'étage, sa position exacte est révélée ; sinon il doit indiquer une pièce adjacente.</li>
              <li><strong>Salle à manger</strong> — aucun effet.</li>
              <li><strong>Hall</strong> — aucun effet.</li>
              <li><strong>Cuisine (gratuit, à activer)</strong> — Ravitaillement : +1 PA si vous y commencez votre tour.</li>
              <li><strong>Bibliothèque (1 PA)</strong> — Trappe : un adversaire dans la Cuisine chute au Sous-sol. S'il est inondé : −1 PV et fuite forcée.</li>
              <li><strong>Chambre (1 PA)</strong> — Levier d'inondation : un adversaire au Sous-sol perd 1 PV et doit fuir. Le Sous-sol devient inaccessible jusqu'à votre prochain tour.</li>
              <li><strong>Balcon (gratuit)</strong> — Saut : vous atterrissez dans la Cuisine, révélé jusqu'à votre prochain déplacement.</li>
              <li><strong>Sous-sol (1 PA)</strong> — Dispositif retardé : posez un piège dans n'importe quelle pièce ; il se déclenche automatiquement au début de votre prochain tour.</li>
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
          </>
        ) : (
          <>
            <h3>Objective</h3>
            <p>
              Each player hides in an <strong>8-room</strong> house with <strong>2 hit points (HP)</strong>.
              The first to reduce their opponent to 0 HP wins.
            </p>

            <h3>Turn structure</h3>
            <ul>
              <li>Each turn, the active player gets <strong>2 action points (AP)</strong> — or <strong>3 AP</strong> if they start their turn in the Kitchen.</li>
              <li>The turn ends voluntarily by clicking "End turn".</li>
            </ul>

            <h3>Actions</h3>
            <ul>
              <li><strong>Move (1 AP)</strong> — to an adjacent room. Clears the "revealed" status. The Basement is off-limits while flooded.</li>
              <li><strong>Double move (2 AP)</strong> — up to 2 rooms at once. Not possible while a free fall-back is active.</li>
              <li><strong>Shoot (2 AP)</strong> — at your own room or a room in line of sight. On hit: −1 HP. The shooter is revealed until their next move and gains a <strong>free fall-back</strong> (one adjacent move at no AP cost).</li>
              <li><strong>Listen (1 AP)</strong> — the opponent must name a room adjacent to their actual position.</li>
              <li><strong>Set a trap (1 AP)</strong> — in your current room. Maximum 2 active traps, visible only to their owner.</li>
              <li><strong>Trigger a trap (1 AP)</strong> — sets off one of your traps: −1 HP if the opponent is there.</li>
              <li><strong>Room effect (variable cost)</strong> — reveals the player until their next move.</li>
              <li><strong>Resign</strong> — the opponent wins immediately.</li>
            </ul>

            <h3>Room effects</h3>
            <ul>
              <li><strong>Foyer (free)</strong> — Echoes: if the opponent is upstairs, their exact position is revealed; otherwise they must name an adjacent room.</li>
              <li><strong>Dining Room</strong> — no effect.</li>
              <li><strong>Landing</strong> — no effect.</li>
              <li><strong>Kitchen (free, must activate)</strong> — Resupply: +1 AP if you start your turn here.</li>
              <li><strong>Library (1 AP)</strong> — Hatch: an opponent in the Kitchen falls into the Basement. If flooded: −1 HP and forced escape.</li>
              <li><strong>Bedroom (1 AP)</strong> — Flood lever: an opponent in the Basement loses 1 HP and must flee. The Basement becomes inaccessible until your next turn.</li>
              <li><strong>Balcony (free)</strong> — Jump: you land in the Kitchen, revealed until your next move.</li>
              <li><strong>Basement (1 AP)</strong> — Delayed device: place a trap anywhere on the board; it triggers automatically at the start of your next turn.</li>
            </ul>

            <h3>Adjacency</h3>
            <ul>
              <li>Foyer ↔ Balcony, Dining Room, Kitchen, Basement</li>
              <li>Dining Room ↔ Foyer, Kitchen, Basement</li>
              <li>Landing ↔ Library, Bedroom, Balcony</li>
              <li>Kitchen ↔ Foyer, Dining Room, Bedroom</li>
              <li>Library ↔ Landing, Basement</li>
              <li>Bedroom ↔ Landing, Kitchen</li>
              <li>Balcony ↔ Foyer, Landing</li>
              <li>Basement ↔ Foyer, Dining Room, Library</li>
            </ul>

            <h3>Lines of sight</h3>
            <ul>
              <li>Foyer → Dining Room, Kitchen</li>
              <li>Dining Room → Foyer, Kitchen</li>
              <li>Landing → Library, Bedroom, Balcony</li>
              <li>Kitchen → Foyer, Dining Room</li>
              <li>Library → Landing, Balcony</li>
              <li>Bedroom → Landing, Balcony</li>
              <li>Balcony → Foyer, Dining Room, Kitchen, Landing</li>
              <li>Basement → Foyer, Dining Room</li>
            </ul>
            <p className="small muted mt">Shooting your own room is always possible.</p>
          </>
        )}
      </div>
    </div>
  );
}
