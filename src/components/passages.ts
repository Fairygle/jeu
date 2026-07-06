import { RoomId } from '../game/board';

/**
 * Règles de trajet explicites entre pièces adjacentes.
 * Plutôt que de deviner la géométrie (fragile), on décrit chaque passage :
 *  - via  : 'stairL' | 'stairM' | 'stairR' pour passer par un escalier,
 *           ou 'door' pour une porte sur cloison directe.
 *  - axis : ordre du trajet en L. 'h' = horizontal d'abord puis vertical,
 *           'v' = vertical d'abord puis horizontal.
 * Le point exact est le centre de l'escalier (si via stair) ou le milieu de
 * la cloison mitoyenne (si door), calculé à l'exécution depuis les rectangles.
 */
export type Via = 'stairL' | 'stairM' | 'stairR' | 'door';
export type Axis = 'h' | 'v';

export interface Passage {
  via: Via;
  axis: Axis;
}

function key(a: RoomId, b: RoomId): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Disposition :
//   Étage :  Chambre(6)  Hall(3)  Bibliothèque(5)   |  Balcon(7) en bandeau
//   RDC   :  Cuisine(4)  Salle-à-manger(2)  Foyer(1)
//   Sous-sol(8) en bandeau tout en bas
const TABLE: Record<string, Passage> = {
  // Escaliers
  [key(4, 6)]: { via: 'stairL', axis: 'v' }, // Cuisine ↔ Chambre (escalier gauche)
  [key(1, 7)]: { via: 'stairM', axis: 'v' }, // Foyer ↔ Balcon (escalier milieu)
  [key(5, 8)]: { via: 'stairR', axis: 'v' }, // Bibliothèque ↔ Sous-sol (escalier droit)

  // Portes — même étage (RDC), passages horizontaux
  [key(1, 2)]: { via: 'door', axis: 'h' }, // Foyer ↔ Salle à manger
  [key(1, 4)]: { via: 'door', axis: 'h' }, // Foyer ↔ Cuisine
  [key(2, 4)]: { via: 'door', axis: 'h' }, // Salle à manger ↔ Cuisine

  // Portes — étage (Hall central), passages horizontaux
  [key(3, 5)]: { via: 'door', axis: 'h' }, // Hall ↔ Bibliothèque
  [key(3, 6)]: { via: 'door', axis: 'h' }, // Hall ↔ Chambre

  // Portes — verticales (bandeaux Balcon / Sous-sol vers pièces au-dessus/dessous)
  [key(3, 7)]: { via: 'door', axis: 'v' }, // Hall ↔ Balcon
  [key(1, 8)]: { via: 'door', axis: 'v' }, // Foyer ↔ Sous-sol
  [key(2, 8)]: { via: 'door', axis: 'v' }, // Salle à manger ↔ Sous-sol
};

export function passageBetween(a: RoomId, b: RoomId): Passage | null {
  return TABLE[key(a, b)] ?? null;
}

// Pour dessiner les petites portes : liste des passages de type 'door'.
export const DOOR_PAIRS: [RoomId, RoomId, Axis][] = [
  [1, 2, 'h'],
  [1, 4, 'h'],
  [2, 4, 'h'],
  [3, 5, 'h'],
  [3, 6, 'h'],
  [3, 7, 'v'],
  [1, 8, 'v'],
  [2, 8, 'v'],
];

export const STAIR_OF: Record<string, 'stairL' | 'stairM' | 'stairR'> = {
  [key(4, 6)]: 'stairL',
  [key(1, 7)]: 'stairM',
  [key(5, 8)]: 'stairR',
};
