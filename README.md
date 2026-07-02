# Revolver Noir

Duel tactique de cache-cache mortel dans une maison à huit pièces. Deux joueurs, deux points de vie, un seul survivant. Jeu web responsive (desktop, tablette, mobile) construit avec React, Vite, TypeScript et Supabase.

## Fonctionnalités

- **Connexion / inscription** par email via Supabase Auth (mode invité possible pour jouer en local).
- **Partie locale** : deux joueurs sur le même appareil, avec écran de passage de main qui masque les informations cachées.
- **Multijoueur en ligne** : créez une partie, partagez son code à 6 caractères, jouez en temps réel (Supabase Realtime).
- **Règles complètes du cahier des charges** : déplacements, double déplacement, tir avec repli gratuit, écoute, pièges simples et retardés, effets des 8 pièces (échos du Foyer, inondation de la Chambre, trappe de la Bibliothèque, saut du Balcon, ravitaillement de la Cuisine, dispositif retardé du Sous-sol), visibilité et révélation, journal de partie filtré selon ce que chaque joueur a le droit de voir.

## Démarrage

```bash
npm install
npm run dev
```

Le jeu est jouable immédiatement en **mode local** (bouton « Jouer en invité »), même sans Supabase.

## Configuration Supabase (login + multijoueur)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez le contenu de `supabase/schema.sql`.
3. Dans **Authentication → Providers**, vérifiez que « Email » est activé.
4. Copiez `.env.example` en `.env` et renseignez :
   ```
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_cle_anon
   ```
5. Relancez `npm run dev`.

> Note : l'état complet de la partie est stocké côté serveur et filtré côté client. C'est suffisant pour jouer entre amis ; pour un anti-triche strict, il faudrait déplacer le moteur (`src/game/engine.ts`) dans une Edge Function Supabase — le moteur est déjà isolé et pur pour rendre cette migration simple.

## Pousser sur votre repo GitHub

```bash
git init
git add .
git commit -m "Revolver Noir — jeu complet (local + multijoueur Supabase)"
git branch -M main
git remote add origin https://github.com/Fairygle/Revolver-noir-fable.git
git push -u origin main --force
```

(`--force` uniquement si le repo contient déjà des fichiers à écraser.)

## Structure

```
src/
  game/board.ts     Pièces, adjacences, lignes de vue (§3)
  game/engine.ts    Moteur de règles pur, partagé local/en ligne (§2, §4–§7)
  components/GameView.tsx  Plateau, HUD, actions, journal
  screens/          Auth, Accueil, Règles, Partie locale, Multijoueur
  lib/supabase.ts   Client Supabase
supabase/schema.sql Table games + RLS + Realtime
```

## Build de production

```bash
npm run build   # sortie dans dist/
```

Déployable tel quel sur Vercel, Netlify ou GitHub Pages (pensez à définir les variables d'environnement `VITE_SUPABASE_*`).
