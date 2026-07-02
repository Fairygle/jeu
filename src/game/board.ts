// Plateau — pièces, adjacences et lignes de vue (cf. cahier des charges §3)

export type RoomId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const ROOMS: Record<RoomId, { name: string; short: string }> = {
  1: { name: 'Foyer', short: 'N1' },
  2: { name: 'Salle à manger', short: 'N2' },
  3: { name: 'Hall', short: 'N3' },
  4: { name: 'Cuisine', short: 'N4' },
  5: { name: 'Bibliothèque', short: 'N5' },
  6: { name: 'Chambre', short: 'N6' },
  7: { name: 'Balcon', short: 'N7' },
  8: { name: 'Sous-sol', short: 'N8' },
};

export const ALL_ROOMS: RoomId[] = [1, 2, 3, 4, 5, 6, 7, 8];

// §3.2 — Adjacences
export const ADJACENCY: Record<RoomId, RoomId[]> = {
  1: [7, 2, 4, 8],
  2: [1, 4, 8],
  3: [5, 6, 7],
  4: [1, 2, 6],
  5: [3, 8],
  6: [3, 4],
  7: [1, 3],
  8: [1, 2, 5],
};

// §3.3 — Ligne de vue (le tir sur sa propre pièce est toujours permis)
export const LINE_OF_SIGHT: Record<RoomId, RoomId[]> = {
  1: [2, 4],
  2: [1, 4],
  3: [5, 6, 7],
  4: [1, 2],
  5: [3, 7],
  6: [3, 7],
  7: [1, 2, 4, 3],
  8: [1, 2],
};

// §5.5 — Deuxième étage pour l'effet "échos" du Foyer
export const UPPER_FLOOR: RoomId[] = [3, 5, 6, 7];

export const BASEMENT: RoomId = 8;
export const KITCHEN: RoomId = 4;

/** Pièces atteignables en au plus `depth` déplacements adjacents.
 *  Exclut le Sous-sol (destination et étape intermédiaire) si inondé. */
export function reachable(from: RoomId, depth: number, basementFlooded: boolean): RoomId[] {
  const seen = new Set<RoomId>([from]);
  let frontier: RoomId[] = [from];
  for (let d = 0; d < depth; d++) {
    const next: RoomId[] = [];
    for (const r of frontier) {
      for (const n of ADJACENCY[r]) {
        if (basementFlooded && n === BASEMENT) continue;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

export function shootTargets(from: RoomId): RoomId[] {
  return [from, ...LINE_OF_SIGHT[from]];
}

/** Pièces d'évasion forcée depuis le Sous-sol (adjacentes, hors Sous-sol). */
export function basementEscapeRooms(): RoomId[] {
  return ADJACENCY[BASEMENT].filter((r) => r !== BASEMENT);
}
