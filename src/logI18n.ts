import { LogEntry, PlayerIndex } from './game/engine';

type Tfn = (key: string, params?: Record<string, string | number>) => string;

/** Rend une entrée de journal dans la langue courante, avec les vrais pseudos. */
export function renderLog(entry: LogEntry, t: Tfn, playerNames: [string, string]): string {
  if (!entry.key) return entry.text; // filet de sécurité (ne devrait plus arriver)

  const raw = entry.params ?? {};
  const resolved: Record<string, string | number> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    if (k === 'player' || k === 'player2') {
      const idx = v as PlayerIndex;
      resolved[k] = playerNames[idx] || t(idx === 0 ? 'game.player1' : 'game.player2');
    } else if (k === 'room' || k === 'room2') {
      resolved[k] = t(`room.${v}`);
    } else if (k === 'reasonKey') {
      const roomParam = raw.reasonRoom !== undefined ? { room: t(`room.${raw.reasonRoom}`) } : undefined;
      resolved.reason = t(`log.reason.${v}`, roomParam);
    } else if (k === 'reasonRoom') {
      // consommé ci-dessus via reasonKey, rien à faire ici
    } else {
      resolved[k] = v as string | number;
    }
  }

  return t(entry.key, resolved);
}
