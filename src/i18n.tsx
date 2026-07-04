import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Lang = 'fr' | 'en';

type Dict = Record<string, string>;

const FR: Dict = {
  // Accueil
  'home.subtitle': '2 joueurs · 8 pièces · 1 survivant',
  'home.quick': 'Partie rapide',
  'home.create': 'Créer',
  'home.join': 'Rejoindre',
  'home.local': 'Local',
  'home.local.hint': '— même appareil',
  'home.codeMulti': 'Code multijoueur',
  'home.rules': 'Règles',
  'home.logout': 'Déconnexion',
  'home.online': 'en ligne',
  'home.salon': 'Salon',
  'home.salon.write': 'Écrire au salon…',
  'home.salon.empty': "Personne n'a encore parlé…",
  'home.salon.locked': 'Connectez-vous pour accéder au salon.',
  'home.salon.unavailable': "Salon indisponible pour l'instant (migration serveur à faire).",
  'home.searching': 'Recherche',
  'home.confirming': 'Confirmation…',
  'home.found': 'Partie trouvée !',
  'home.opponent': 'Adversaire',
  'home.accept': 'Accepter',
  'home.refuse': 'Refuser',
  // Multijoueur
  'mp.title': 'Multijoueur',
  'mp.back': 'Retour',
  'mp.createRoom': 'Créer un salon (code)',
  'mp.or': 'ou',
  'mp.code': 'CODE',
  'mp.join': 'Rejoindre',
  'mp.created': 'Partie créée',
  'mp.searchingTitle': 'Recherche…',
  'mp.shareCode': 'Partagez ce code avec votre adversaire :',
  'mp.waiting': "En attente d'un adversaire",
  'mp.cancel': 'Annuler',
  'mp.disconnected': 'Adversaire déconnecté',
  'mp.leftGame': 'a quitté la partie.',
  'mp.backHome': "Retour à l'accueil",
  'mp.victory': 'Victoire !',
  'mp.defeat': 'Défaite…',
  'mp.over': 'Partie terminée',
  'mp.wins': "l'emporte.",
  'mp.online': 'en ligne',
  'mp.offline': 'hors ligne',
  // Chat
  'chat.message': 'Message…',
  'chat.opponent': 'Adversaire',
  // Amis
  'friends.title': 'Amis',
  'friends.add': 'Pseudo à ajouter…',
  'friends.requests': 'Demandes reçues',
  'friends.mine': 'Mes amis',
  'friends.sent': 'Demandes envoyées',
  'friends.pending': 'en attente',
  'friends.none': "Aucun ami pour l'instant. Ajoutez-les par pseudo !",
  'friends.notFound': 'Aucun joueur avec ce pseudo.',
  'friends.alreadySent': 'Demande déjà envoyée.',
  'friends.sentTo': 'Demande envoyée à',
  'friends.unavailable': "La liste d'amis n'est pas encore activée sur le serveur.",
  'friends.online': 'en ligne',
  'friends.offline': 'hors ligne',
  // Jeu
  'game.chooseHideTitle': 'Choisissez votre cachette',
  'game.oppHiding': "L'adversaire se cache…",
  'game.escapeBasement': 'Fuyez le sous-sol',
  'game.respond': 'Répondez',
  'game.waiting': 'Attente…',
  'game.finished': 'Terminé',
  'game.yourTurn': 'Votre tour',
  'game.oppTurn': 'Tour adverse',
  'game.chooseHide': 'Touchez une pièce pour vous y cacher, en secret.',
  'game.oppChoosing': "L'adversaire choisit sa position…",
  'game.startSecret': 'La partie commence. Chaque joueur choisit sa pièce de départ en secret.',
  'game.listenAsk': 'Touchez une pièce voisine de la vôtre.',
  'game.escapeAsk': 'Touchez une pièce de refuge adjacente.',
  'game.waitingOpp': "En attente de l'adversaire…",
  'game.endTurn': 'Fin de tour',
  'game.floor.top': 'Étage',
  'game.floor.ground': 'Rez-de-chaussée',
  'game.floor.basement': 'Sous-sol',
  'game.foldPrompt': 'Repliez-vous — touchez une pièce voisine',
  'game.from': 'Depuis',
  'game.foldTo': 'Repli vers',
  'game.neighbors': 'Pièces voisines :',
  'game.escapeTo': 'Fuyez vers :',
  // Actions
  'act.move': 'Aller',
  'act.fold': 'Repli',
  'act.sprint': 'Sprint',
  'act.shoot': 'Tirer',
  'act.listen': 'Écouter',
  'act.trap': 'Piège',
  'act.trigger': 'Déclencher',
  'act.delayed': 'Retardé',
  'act.free': 'gratuit',
  'act.echos': 'Échos',
  'act.refill': 'Ravitailler',
  'act.hatch': 'Trappe',
  'act.flood': 'Inonder',
  'act.jump': 'Sauter',
  // Local
  'local.handoff': 'Au tour de',
  'local.handoffHint': 'Les autres, détournez le regard — la maison garde ses secrets.',
  'local.ready': "Je suis prêt",
  // Auth
  'auth.login': 'Se connecter',
  'auth.signup': "S'inscrire",
  'auth.email': 'E-mail',
  'auth.password': 'Mot de passe',
  'auth.pseudo': 'Pseudo',
  'auth.noAccount': 'Pas de compte ? Inscrivez-vous',
  'auth.hasAccount': 'Déjà un compte ? Connectez-vous',
  'auth.checkEmail': 'Vérifiez votre e-mail pour confirmer votre compte.',
};

const EN: Dict = {
  'home.subtitle': '2 players · 8 rooms · 1 survivor',
  'home.quick': 'Quick match',
  'home.create': 'Create',
  'home.join': 'Join',
  'home.local': 'Local',
  'home.local.hint': '— same device',
  'home.codeMulti': 'Multiplayer code',
  'home.rules': 'Rules',
  'home.logout': 'Log out',
  'home.online': 'online',
  'home.salon': 'Lounge',
  'home.salon.write': 'Write to the lounge…',
  'home.salon.empty': 'Nobody has spoken yet…',
  'home.salon.locked': 'Sign in to access the lounge.',
  'home.salon.unavailable': 'Lounge unavailable for now (server migration pending).',
  'home.searching': 'Searching',
  'home.confirming': 'Confirming…',
  'home.found': 'Match found!',
  'home.opponent': 'Opponent',
  'home.accept': 'Accept',
  'home.refuse': 'Decline',
  'mp.title': 'Multiplayer',
  'mp.back': 'Back',
  'mp.createRoom': 'Create a room (code)',
  'mp.or': 'or',
  'mp.code': 'CODE',
  'mp.join': 'Join',
  'mp.created': 'Game created',
  'mp.searchingTitle': 'Searching…',
  'mp.shareCode': 'Share this code with your opponent:',
  'mp.waiting': 'Waiting for an opponent',
  'mp.cancel': 'Cancel',
  'mp.disconnected': 'Opponent disconnected',
  'mp.leftGame': 'left the game.',
  'mp.backHome': 'Back to home',
  'mp.victory': 'Victory!',
  'mp.defeat': 'Defeat…',
  'mp.over': 'Game over',
  'mp.wins': 'wins.',
  'mp.online': 'online',
  'mp.offline': 'offline',
  'chat.message': 'Message…',
  'chat.opponent': 'Opponent',
  'friends.title': 'Friends',
  'friends.add': 'Username to add…',
  'friends.requests': 'Incoming requests',
  'friends.mine': 'My friends',
  'friends.sent': 'Sent requests',
  'friends.pending': 'pending',
  'friends.none': 'No friends yet. Add them by username!',
  'friends.notFound': 'No player with that username.',
  'friends.alreadySent': 'Request already sent.',
  'friends.sentTo': 'Request sent to',
  'friends.unavailable': 'The friends list is not enabled on the server yet.',
  'friends.online': 'online',
  'friends.offline': 'offline',
  'game.chooseHideTitle': 'Choose your hiding spot',
  'game.oppHiding': 'The opponent is hiding…',
  'game.escapeBasement': 'Flee the basement',
  'game.respond': 'Respond',
  'game.waiting': 'Waiting…',
  'game.finished': 'Done',
  'game.yourTurn': 'Your turn',
  'game.oppTurn': "Opponent's turn",
  'game.chooseHide': 'Tap a room to hide there, in secret.',
  'game.oppChoosing': 'The opponent is choosing their spot…',
  'game.startSecret': 'The game begins. Each player secretly picks a starting room.',
  'game.listenAsk': 'Tap a room adjacent to yours.',
  'game.escapeAsk': 'Tap an adjacent refuge room.',
  'game.waitingOpp': 'Waiting for the opponent…',
  'game.endTurn': 'End turn',
  'game.floor.top': 'Upstairs',
  'game.floor.ground': 'Ground floor',
  'game.floor.basement': 'Basement',
  'game.foldPrompt': 'Fall back — tap a neighboring room',
  'game.from': 'From',
  'game.foldTo': 'Fall back to',
  'game.neighbors': 'Neighboring rooms:',
  'game.escapeTo': 'Escape to:',
  'act.move': 'Move',
  'act.fold': 'Fall back',
  'act.sprint': 'Sprint',
  'act.shoot': 'Shoot',
  'act.listen': 'Listen',
  'act.trap': 'Trap',
  'act.trigger': 'Trigger',
  'act.delayed': 'Delayed',
  'act.free': 'free',
  'act.echos': 'Echoes',
  'act.refill': 'Resupply',
  'act.hatch': 'Hatch',
  'act.flood': 'Flood',
  'act.jump': 'Jump',
  'local.handoff': "It's the turn of",
  'local.handoffHint': 'Everyone else, look away — the house keeps its secrets.',
  'local.ready': "I'm ready",
  'auth.login': 'Sign in',
  'auth.signup': 'Sign up',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.pseudo': 'Username',
  'auth.noAccount': 'No account? Sign up',
  'auth.hasAccount': 'Already have an account? Sign in',
  'auth.checkEmail': 'Check your email to confirm your account.',
};

const DICTS: Record<Lang, Dict> = { fr: FR, en: EN };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: 'fr', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = typeof localStorage !== 'undefined' ? (localStorage.getItem('lang') as Lang | null) : null;
    if (saved === 'fr' || saved === 'en') return saved;
    const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
    return nav.startsWith('en') ? 'en' : 'fr';
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('lang', l);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);
  const t = (key: string) => DICTS[lang][key] ?? DICTS.fr[key] ?? key;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
