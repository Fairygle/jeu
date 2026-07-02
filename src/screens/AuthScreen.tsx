import { useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';

interface Props {
  onGuest: () => void;
}

export default function AuthScreen({ onGuest }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setInfo(null);
    if (!supabase) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { pseudo: pseudo || email.split('@')[0] } },
        });
        if (error) throw error;
        setInfo('Compte créé. Vérifiez votre email si la confirmation est activée, puis connectez-vous.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setError(e.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="panel auth-card">
        <div className="hero" style={{ padding: '6px 0 18px' }}>
          <h1 style={{ fontSize: 30 }}>Revolver Noir</h1>
          <p className="tagline">Deux joueurs. Huit pièces. Un seul survivant.</p>
          <div className="rule" />
        </div>

        {!supabaseConfigured && (
          <div className="info-box">
            Supabase n'est pas configuré (fichier <code>.env</code> manquant). Le mode local reste jouable en invité.
          </div>
        )}
        {error && <div className="error-box">{error}</div>}
        {info && <div className="info-box">{info}</div>}

        {supabaseConfigured && (
          <>
            {mode === 'signup' && (
              <div className="field">
                <label>Pseudo</label>
                <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Votre nom de chasseur" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <button className="btn btn-gold btn-block btn-lg" onClick={submit} disabled={loading || !email || !password}>
              {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
            </button>
            <button
              className="btn btn-block mt"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            >
              {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            </button>
          </>
        )}

        <button className="btn btn-block mt" onClick={onGuest}>
          Jouer en invité (local uniquement)
        </button>
      </div>
    </div>
  );
}
