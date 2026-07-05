import { RoomId } from '../game/board';

export type PassageKind = 'door' | 'stair';

/**
 * Passages entre pièces adjacentes. Chaque passage relie deux pièces et se
 * matérialise soit par une porte (cloison directe), soit par un escalier
 * (changement d'étage déjà matérialisé sur le plateau).
 * Le point exact est calculé à l'exécution à partir des rectangles mesurés
 * (voir useTokenAnim), cette table ne fournit que le TYPE et le côté.
 */
export interface Passage {
  a: RoomId;
  b: RoomId;
  kind: PassageKind;
}

// key normalisée "min-max"
function key(a: RoomId, b: RoomId): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

const RAW: Passage[] = [
  // Escaliers déjà dessinés sur le plateau
  { a: 4, b: 6, kind: 'stair' }, // Cuisine ↔ Chambre (escalier gauche)
  { a: 1, b: 7, kind: 'stair' }, // Foyer ↔ Balcon (escalier milieu)
  { a: 5, b: 8, kind: 'stair' }, // Bibliothèque ↔ Sous-sol (escalier droit)

  // Portes (cloisons directes entre pièces voisines)
  { a: 1, b: 2, kind: 'door' }, // Foyer ↔ Salle à manger
  { a: 1, b: 4, kind: 'door' }, // Foyer ↔ Cuisine
  { a: 1, b: 8, kind: 'door' }, // Foyer ↔ Sous-sol
  { a: 2, b: 4, kind: 'door' }, // Salle à manger ↔ Cuisine
  { a: 2, b: 8, kind: 'door' }, // Salle à manger ↔ Sous-sol
  { a: 3, b: 5, kind: 'door' }, // Hall ↔ Bibliothèque
  { a: 3, b: 6, kind: 'door' }, // Hall ↔ Chambre
  { a: 3, b: 7, kind: 'door' }, // Hall ↔ Balcon
];

const MAP = new Map<string, Passage>();
for (const p of RAW) MAP.set(key(p.a, p.b), p);

export function passageBetween(a: RoomId, b: RoomId): Passage | null {
  return MAP.get(key(a, b)) ?? null;
}

export const ALL_PASSAGES = RAW;
