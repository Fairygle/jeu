// Moteur de jeu — implémentation stricte du cahier des charges.
// Utilisé à l'identique par le mode local et le mode en ligne.

import {
  ADJACENCY,
  BASEMENT,
  KITCHEN,
  LINE_OF_SIGHT,
  ROOMS,
  RoomId,
  UPPER_FLOOR,
  basementEscapeRooms,
  reachable,
} from './board';

export type PlayerIndex = 0 | 1;

export interface PlayerState {
  room: RoomId | null; // null pendant le setup
  hp: number;
  ap: number;
  freeMoveAvailable: boolean; // repli gratuit après un tir
  kitchenBonus?: boolean; // ravitaillement de la Cuisine disponible ce tour (à activer)
  revealedUntilMove: boolean;
  traps: RoomId[]; // pièges simples armés (visibles par le propriétaire)
  delayedTraps: RoomId[]; // pièges retardés (Sous-sol), déclenchés au début du prochain tour
}

export type Visibility = 'both' | 0 | 1;

export interface LogEntry {
  turn: number;
  actor: PlayerIndex | null;
  text: string;
  visibility: Visibility;
  kind?: 'info' | 'damage' | 'reveal' | 'system';
}

export type Pending =
  | { kind: 'listen'; responder: PlayerIndex; source: 'listen' | 'echo' }
  | { kind: 'escape'; responder: PlayerIndex; options: RoomId[] };

export interface GameState {
  phase: 'setup' | 'playing' | 'finished';
  players: [PlayerState, PlayerState];
  active: PlayerIndex;
  setupTurn: PlayerIndex; // qui choisit sa pièce de départ
  turnNumber: number;
  basementFlood: { active: boolean; owner: PlayerIndex | null };
  pending: Pending | null;
  winner: PlayerIndex | null;
  log: LogEntry[];
}

export type GameAction =
  | { type: 'setup'; room: RoomId }
  | { type: 'move'; room: RoomId }
  | { type: 'double_move'; room: RoomId }
  | { type: 'shoot'; room: RoomId }
  | { type: 'listen' }
  | { type: 'listen_answer'; room: RoomId }
  | { type: 'trap' }
  | { type: 'activate_trap'; room: RoomId }
  | { type: 'activate_room'; room?: RoomId } // room = cible du piège retardé (Sous-sol)
  | { type: 'escape'; room: RoomId }
  | { type: 'end_turn' }
  | { type: 'resign' };

const MAX_TRAPS = 2;

function newPlayer(): PlayerState {
  return {
    room: null,
    hp: 2,
    ap: 0,
    freeMoveAvailable: false,
    revealedUntilMove: false,
    traps: [],
    delayedTraps: [],
  };
}

export function newGame(): GameState {
  return {
    phase: 'setup',
    players: [newPlayer(), newPlayer()],
    active: 0,
    setupTurn: 0,
    turnNumber: 0,
    basementFlood: { active: false, owner: null },
    pending: null,
    winner: null,
    log: [
      {
        turn: 0,
        actor: null,
        text: 'La partie commence. Chaque joueur choisit sa pièce de départ en secret.',
        visibility: 'both',
        kind: 'system',
      },
    ],
  };
}

function clone(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s));
}

function roomName(r: RoomId): string {
  return ROOMS[r].name;
}

function other(i: PlayerIndex): PlayerIndex {
  return i === 0 ? 1 : 0;
}

function pushLog(s: GameState, entry: Omit<LogEntry, 'turn'>) {
  s.log.push({ turn: s.turnNumber, ...entry });
}

function checkWin(s: GameState) {
  for (const i of [0, 1] as PlayerIndex[]) {
    if (s.players[i].hp <= 0 && s.phase !== 'finished') {
      s.phase = 'finished';
      s.winner = other(i);
      pushLog(s, {
        actor: null,
        text: `Le joueur ${other(i) + 1} remporte la partie !`,
        visibility: 'both',
        kind: 'system',
      });
    }
  }
}

function damage(s: GameState, victim: PlayerIndex, amount: number, reason: string) {
  s.players[victim].hp -= amount;
  pushLog(s, {
    actor: null,
    text: `Le joueur ${victim + 1} perd ${amount} PV (${reason}). PV restants : ${Math.max(0, s.players[victim].hp)}.`,
    visibility: 'both',
    kind: 'damage',
  });
  checkWin(s);
}

/** Séquence de début de tour du joueur `s.active` (§2, §5.1, §5.2, §5.6). */
function startTurn(s: GameState) {
  const i = s.active;
  const p = s.players[i];
  s.turnNumber += 1;

  // Fin de l'inondation au tour de son activateur (§5.2)
  if (s.basementFlood.active && s.basementFlood.owner === i) {
    s.basementFlood = { active: false, owner: null };
    pushLog(s, {
      actor: null,
      text: 'Les eaux du Sous-sol se retirent.',
      visibility: 'both',
      kind: 'system',
    });
  }

  // Ravitaillement de la Cuisine : disponible, mais à activer par le joueur (§5.1)
  p.ap = 2;
  p.kitchenBonus = p.room === KITCHEN;
  pushLog(s, {
    actor: i,
    text: `Tour ${s.turnNumber} — Joueur ${i + 1} : 2 PA.`,
    visibility: 'both',
    kind: 'system',
  });
  if (p.kitchenBonus) {
    pushLog(s, {
      actor: i,
      text: 'Ravitaillement disponible en Cuisine (à activer, gratuit).',
      visibility: i,
      kind: 'info',
    });
  }

  // Déclenchement automatique des pièges retardés (§5.6, §6.2)
  if (p.delayedTraps.length > 0) {
    const opp = other(i);
    for (const room of p.delayedTraps) {
      pushLog(s, {
        actor: i,
        text: `Un dispositif retardé se déclenche : ${roomName(room)}.`,
        visibility: 'both',
        kind: 'info',
      });
      if (s.players[opp].room === room) {
        damage(s, opp, 1, `piège retardé en ${roomName(room)}`);
      }
    }
    p.delayedTraps = [];
  }

  maybeAutoEnd(s);
}

/** Le joueur actif a-t-il encore une action valide ? (§4.8) */
export function hasValidAction(s: GameState, i: PlayerIndex): boolean {
  const p = s.players[i];
  if (p.ap >= 1) return true;
  if (p.freeMoveAvailable) return true;
  // Effets de pièce gratuits : Foyer (§5.5) et Balcon (§5.4)
  if (p.room === 1 || p.room === 7) return true;
  return false;
}

function maybeAutoEnd(s: GameState) {
  // Fin de tour désormais TOUJOURS manuelle : passer automatiquement le tour
  // quand il ne reste plus d'action révélerait de l'information à l'adversaire
  // (il déduirait que le joueur est coincé). Le joueur clique « Fin de tour ».
  void s;
}

function endTurnInternal(s: GameState, auto: boolean) {
  const i = s.active;
  s.players[i].freeMoveAvailable = false; // le repli non utilisé expire
  pushLog(s, {
    actor: i,
    text: auto
      ? `Le joueur ${i + 1} n'a plus d'action valide : fin de tour.`
      : `Le joueur ${i + 1} termine son tour.`,
    visibility: 'both',
    kind: 'system',
  });
  s.active = other(i);
  startTurn(s);
}

// ---------------------------------------------------------------------------
// Cibles valides — utilisées par l'UI pour surligner les pièces
// ---------------------------------------------------------------------------

export function validTargets(s: GameState, i: PlayerIndex, action: GameAction['type']): RoomId[] {
  const p = s.players[i];
  if (p.room === null) return [];
  const flooded = s.basementFlood.active;

  switch (action) {
    case 'move': {
      if (!p.freeMoveAvailable && p.ap < 1) return [];
      return ADJACENCY[p.room].filter((r) => !(flooded && r === BASEMENT));
    }
    case 'double_move': {
      if (p.freeMoveAvailable || p.ap < 2) return [];
      return reachable(p.room, 2, flooded);
    }
    case 'shoot': {
      if (p.ap < 2) return [];
      return [p.room, ...LINE_OF_SIGHT[p.room]];
    }
    case 'activate_trap': {
      if (p.ap < 1) return [];
      return [...p.traps];
    }
    case 'activate_room': {
      // Cible uniquement pour l'effet du Sous-sol (piège retardé)
      if (p.room === BASEMENT && p.ap >= 1 && p.traps.length + p.delayedTraps.length < MAX_TRAPS) {
        return (Object.keys(ROOMS).map(Number) as RoomId[]).filter(
          (r) => !p.traps.includes(r) && !p.delayedTraps.includes(r),
        );
      }
      return [];
    }
    case 'listen_answer': {
      const opp = s.players[i];
      return opp.room ? ADJACENCY[opp.room] : [];
    }
    case 'escape': {
      return s.pending?.kind === 'escape' ? s.pending.options : [];
    }
    default:
      return [];
  }
}

/** L'effet de la pièce actuelle est-il activable ? Renvoie coût ou null. */
export function roomEffectCost(s: GameState, i: PlayerIndex): number | null {
  const p = s.players[i];
  switch (p.room) {
    case 1: // Foyer — échos
    case 7: // Balcon — saut
      return 0;
    case 5: // Bibliothèque — trappe
    case 6: // Chambre — inondation
      return 1;
    case 8: // Sous-sol — dispositif retardé
      return p.traps.length + p.delayedTraps.length < MAX_TRAPS ? 1 : null;
    case 4: // Cuisine — ravitaillement à activer (gratuit)
      return p.kitchenBonus ? 0 : null;
    default:
      return null; // Hall, Salle à manger
  }
}

// ---------------------------------------------------------------------------
// Réducteur principal
// ---------------------------------------------------------------------------

export function applyAction(prev: GameState, actor: PlayerIndex, action: GameAction): GameState {
  const s = clone(prev);
  if (s.phase === 'finished') throw new Error('La partie est terminée.');

  // Phase de mise en place
  if (s.phase === 'setup') {
    if (action.type !== 'setup') throw new Error('Choisissez votre pièce de départ.');
    if (actor !== s.setupTurn) throw new Error("Ce n'est pas à vous de choisir.");
    s.players[actor].room = action.room;
    pushLog(s, {
      actor,
      text: `Vous vous cachez : ${roomName(action.room)}.`,
      visibility: actor,
      kind: 'info',
    });
    pushLog(s, {
      actor,
      text: `Le joueur ${actor + 1} a pris position.`,
      visibility: other(actor) as Visibility,
      kind: 'info',
    });
    if (actor === 0) {
      s.setupTurn = 1;
    } else {
      s.phase = 'playing';
      s.active = 0;
      startTurn(s);
    }
    return s;
  }

  // Interruptions (écoute / évasion forcée) — c'est au répondant d'agir
  if (s.pending) {
    if (actor !== s.pending.responder) throw new Error("En attente de la réponse de l'adversaire.");
    if (s.pending.kind === 'listen') {
      if (action.type !== 'listen_answer') throw new Error('Vous devez indiquer une pièce adjacente.');
      const me = s.players[actor];
      if (!me.room || !ADJACENCY[me.room].includes(action.room))
        throw new Error('La pièce indiquée doit être adjacente à votre position réelle.');
      const label = s.pending.source === 'echo' ? 'Échos' : 'Écoute';
      pushLog(s, {
        actor,
        text: `${label} — le joueur ${actor + 1} révèle une pièce adjacente à sa position : ${roomName(action.room)}.`,
        visibility: 'both',
        kind: 'reveal',
      });
      s.pending = null;
      maybeAutoEnd(s);
      return s;
    }
    if (s.pending.kind === 'escape') {
      if (action.type !== 'escape') throw new Error('Vous devez fuir vers une pièce adjacente.');
      if (!s.pending.options.includes(action.room)) throw new Error('Fuite impossible vers cette pièce.');
      s.players[actor].room = action.room;
      pushLog(s, {
        actor,
        text: `Vous fuyez vers : ${roomName(action.room)}.`,
        visibility: actor,
        kind: 'info',
      });
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} s'échappe du Sous-sol.`,
        visibility: other(actor) as Visibility,
        kind: 'info',
      });
      s.pending = null;
      maybeAutoEnd(s);
      return s;
    }
  }

  if (actor !== s.active) throw new Error("Ce n'est pas votre tour.");
  const p = s.players[actor];
  const opp = s.players[other(actor)];
  if (p.room === null) throw new Error('État invalide.');

  switch (action.type) {
    // §4.1
    case 'move': {
      const free = p.freeMoveAvailable;
      if (!free && p.ap < 1) throw new Error('PA insuffisants.');
      if (!ADJACENCY[p.room].includes(action.room)) throw new Error('Pièce non adjacente.');
      if (s.basementFlood.active && action.room === BASEMENT) throw new Error('Le Sous-sol est inondé.');
      if (free) p.freeMoveAvailable = false;
      else p.ap -= 1;
      p.room = action.room;
      p.revealedUntilMove = false;
      pushLog(s, {
        actor,
        text: free ? `Repli gratuit vers : ${roomName(action.room)}.` : `Déplacement vers : ${roomName(action.room)}.`,
        visibility: actor,
        kind: 'info',
      });
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} se déplace et disparaît dans l'ombre.`,
        visibility: other(actor) as Visibility,
        kind: 'info',
      });
      break;
    }

    // §4.2
    case 'double_move': {
      if (p.freeMoveAvailable) throw new Error('Impossible avec un repli gratuit actif.');
      if (p.ap < 2) throw new Error('PA insuffisants.');
      const targets = reachable(p.room, 2, s.basementFlood.active);
      if (!targets.includes(action.room)) throw new Error('Destination hors de portée (2 pièces max).');
      p.ap -= 2;
      p.room = action.room;
      p.revealedUntilMove = false;
      pushLog(s, {
        actor,
        text: `Double déplacement vers : ${roomName(action.room)}.`,
        visibility: actor,
        kind: 'info',
      });
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} se déplace rapidement.`,
        visibility: other(actor) as Visibility,
        kind: 'info',
      });
      break;
    }

    // §4.3
    case 'shoot': {
      if (p.ap < 2) throw new Error('PA insuffisants (2 PA).');
      const targets = [p.room, ...LINE_OF_SIGHT[p.room]];
      if (!targets.includes(action.room)) throw new Error('Pièce hors de la ligne de tir.');
      p.ap -= 2;
      p.revealedUntilMove = true;
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} tire depuis ${roomName(p.room)} sur ${roomName(action.room)} !`,
        visibility: 'both',
        kind: 'reveal',
      });
      if (opp.room === action.room) {
        damage(s, other(actor), 1, 'tir');
      } else {
        pushLog(s, { actor, text: 'Le coup ne touche personne.', visibility: 'both', kind: 'info' });
      }
      if (s.phase === 'playing') p.freeMoveAvailable = true; // repli gratuit (§2, §4.3)
      break;
    }

    // §4.4
    case 'listen': {
      if (p.ap < 1) throw new Error('PA insuffisants.');
      p.ap -= 1;
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} tend l'oreille…`,
        visibility: 'both',
        kind: 'info',
      });
      s.pending = { kind: 'listen', responder: other(actor), source: 'listen' };
      return s; // pas d'auto-end tant que l'interruption est en cours
    }

    // §4.5
    case 'trap': {
      if (p.ap < 1) throw new Error('PA insuffisants.');
      if (p.traps.length + p.delayedTraps.length >= MAX_TRAPS) throw new Error('Maximum 2 pièges actifs.');
      if (p.traps.includes(p.room)) throw new Error('Vous avez déjà un piège ici.');
      p.ap -= 1;
      p.traps.push(p.room);
      pushLog(s, {
        actor,
        text: `Piège posé : ${roomName(p.room)}.`,
        visibility: actor,
        kind: 'info',
      });
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} pose un piège…`,
        visibility: other(actor) as Visibility,
        kind: 'info',
      });
      break;
    }

    // §4.6
    case 'activate_trap': {
      if (p.ap < 1) throw new Error('PA insuffisants.');
      const idx = p.traps.indexOf(action.room);
      if (idx === -1) throw new Error("Vous n'avez pas de piège dans cette pièce.");
      p.ap -= 1;
      p.traps.splice(idx, 1);
      pushLog(s, {
        actor,
        text: `Un piège claque : ${roomName(action.room)} !`,
        visibility: 'both',
        kind: 'info',
      });
      if (opp.room === action.room) {
        damage(s, other(actor), 1, `piège en ${roomName(action.room)}`);
      }
      break;
    }

    // §4.7 + §5
    case 'activate_room': {
      const cost = roomEffectCost(s, actor);
      if (cost === null) throw new Error("Cette pièce n'a pas d'effet activable.");
      if (p.ap < cost) throw new Error('PA insuffisants.');

      switch (p.room) {
        case 4: {
          // Cuisine — ravitaillement (§5.1), gratuit, à activer
          if (!p.kitchenBonus) throw new Error('Ravitaillement indisponible.');
          p.kitchenBonus = false;
          p.ap += 1;
          p.revealedUntilMove = true;
          pushLog(s, {
            actor,
            text: `Le joueur ${actor + 1} se ravitaille en Cuisine : 3 PA ce tour.`,
            visibility: 'both',
            kind: 'reveal',
          });
          break;
        }
        case 1: {
          // Foyer — échos (§5.5)
          p.revealedUntilMove = true;
          pushLog(s, {
            actor,
            text: `Le joueur ${actor + 1} déclenche les échos du Foyer.`,
            visibility: 'both',
            kind: 'reveal',
          });
          if (opp.room && UPPER_FLOOR.includes(opp.room)) {
            opp.revealedUntilMove = true;
            pushLog(s, {
              actor,
              text: `Les échos trahissent le joueur ${other(actor) + 1} : ${roomName(opp.room)} !`,
              visibility: 'both',
              kind: 'reveal',
            });
          } else {
            s.pending = { kind: 'listen', responder: other(actor), source: 'echo' };
            return s;
          }
          break;
        }
        case 5: {
          // Bibliothèque — trappe de rebond (§5.3)
          p.ap -= 1;
          p.revealedUntilMove = true;
          pushLog(s, {
            actor,
            text: `Le joueur ${actor + 1} actionne la trappe de la Bibliothèque.`,
            visibility: 'both',
            kind: 'reveal',
          });
          if (opp.room === KITCHEN) {
            opp.room = BASEMENT;
            pushLog(s, {
              actor,
              text: `Le joueur ${other(actor) + 1} est précipité de la Cuisine au Sous-sol !`,
              visibility: 'both',
              kind: 'info',
            });
            if (s.basementFlood.active) {
              damage(s, other(actor), 1, 'chute dans le Sous-sol inondé');
              if (s.phase === 'playing') {
                s.pending = { kind: 'escape', responder: other(actor), options: basementEscapeRooms() };
                return s;
              }
            }
          } else {
            pushLog(s, { actor, text: 'La trappe claque dans le vide.', visibility: 'both', kind: 'info' });
          }
          break;
        }
        case 6: {
          // Chambre — levier d'inondation (§5.2)
          p.ap -= 1;
          p.revealedUntilMove = true;
          s.basementFlood = { active: true, owner: actor };
          pushLog(s, {
            actor,
            text: `Le joueur ${actor + 1} actionne le levier : le Sous-sol s'inonde !`,
            visibility: 'both',
            kind: 'reveal',
          });
          if (opp.room === BASEMENT) {
            damage(s, other(actor), 1, 'montée des eaux');
            if (s.phase === 'playing') {
              s.pending = { kind: 'escape', responder: other(actor), options: basementEscapeRooms() };
              return s;
            }
          }
          break;
        }
        case 7: {
          // Balcon — saut par-dessus la rambarde (§5.4)
          p.room = KITCHEN;
          p.revealedUntilMove = true;
          pushLog(s, {
            actor,
            text: `Le joueur ${actor + 1} saute du Balcon et atterrit dans la Cuisine !`,
            visibility: 'both',
            kind: 'reveal',
          });
          break;
        }
        case 8: {
          // Sous-sol — dispositif retardé (§5.6)
          if (!action.room) throw new Error('Choisissez la pièce cible du dispositif.');
          if (p.traps.includes(action.room) || p.delayedTraps.includes(action.room))
            throw new Error('Vous avez déjà un piège dans cette pièce.');
          p.ap -= 1;
          p.revealedUntilMove = true;
          p.delayedTraps.push(action.room);
          pushLog(s, {
            actor,
            text: `Dispositif retardé armé : ${roomName(action.room)} (déclenchement à votre prochain tour).`,
            visibility: actor,
            kind: 'info',
          });
          pushLog(s, {
            actor,
            text: `Le joueur ${actor + 1} manipule quelque chose dans le Sous-sol…`,
            visibility: other(actor) as Visibility,
            kind: 'reveal',
          });
          break;
        }
        default:
          throw new Error("Cette pièce n'a pas d'effet activable.");
      }
      break;
    }

    // §4.8
    case 'end_turn': {
      endTurnInternal(s, false);
      return s;
    }

    // §4.9
    case 'resign': {
      s.phase = 'finished';
      s.winner = other(actor);
      pushLog(s, {
        actor,
        text: `Le joueur ${actor + 1} abandonne. Victoire du joueur ${other(actor) + 1} !`,
        visibility: 'both',
        kind: 'system',
      });
      return s;
    }

    default:
      throw new Error('Action inconnue.');
  }

  maybeAutoEnd(s);
  return s;
}
