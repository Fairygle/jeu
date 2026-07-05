import { useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { useI18n } from '../i18n';

interface Props {
  onGuest: () => void;
}

export default function AuthScreen({ onGuest }: Props) {
  const { t } = useI18n();
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
        const redirectTo = window.location.origin + import.meta.env.BASE_URL;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { pseudo: pseudo || email.split('@')[0] }, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setInfo(t('auth.accountCreated'));
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
          <p className="tagline">{t('auth.tagline')}</p>
          <div className="rule" />
        </div>

        {!supabaseConfigured && (
          <div className="info-box">
            {t('auth.notConfigured')}
          </div>
        )}
        {error && <div className="error-box">{error}</div>}
        {info && <div className="info-box">{info}</div>}

        {supabaseConfigured && (
          <>
            {mode === 'signup' && (
              <div className="field">
                <label>{t('auth.pseudo')}</label>
                <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder={t('auth.pseudoPlaceholder')} />
              </div>
            )}
            <div className="field">
              <label>{t('auth.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
            </div>
            <div className="field">
              <label>{t('auth.password')}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <button className="btn btn-gold btn-block btn-lg" onClick={submit} disabled={loading || !email || !password}>
              {loading ? '…' : mode === 'login' ? t('auth.login') : t('auth.createAccount')}
            </button>
            <button
              className="btn btn-block mt"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            >
              {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
            </button>
          </>
        )}

        <button className="btn btn-block mt" onClick={onGuest}>
          {t('auth.guestPlay')}
        </button>
      </div>
    </div>
  );
}
