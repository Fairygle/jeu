import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import RulesScreen from './screens/RulesScreen';
import LocalGame from './screens/LocalGame';
import OnlineGame from './screens/OnlineGame';
import { supabase, supabaseConfigured } from './lib/supabase';
import { useI18n } from './i18n';
import ProfileModal from './components/ProfileModal';
import { AvatarIcon } from './components/avatars';

type Screen = 'home' | 'rules' | 'local' | 'online';
type OnlineMode = 'code' | 'join';

export default function App() {
  const { lang, setLang } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [onlineMode, setOnlineMode] = useState<OnlineMode>('code');
  const [activeRow, setActiveRow] = useState<any>(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [showProfile, setShowProfile] = useState(false);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);


  // Présence : signale que le joueur est en ligne (liste d'amis)
  useEffect(() => {
    if (!supabase || !session) return;
    const sb = supabase;
    const me = session.user;
    const p = (me.user_metadata?.pseudo as string | undefined) ?? me.email?.split('@')[0] ?? 'Joueur';
    const beat = () =>
      sb.from('profiles').upsert({ id: me.id, pseudo: p, last_seen: new Date().toISOString() }).then(() => {});
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [session]);

  if (!ready) return null;

  const loggedIn = Boolean(session) || guest;
  if (!loggedIn) {
    return (
      <div className="app-shell">
        <AuthScreen onGuest={() => setGuest(true)} />
      </div>
    );
  }

  const pseudo: string | null =
    (session?.user.user_metadata?.pseudo as string | undefined) ?? session?.user.email?.split('@')[0] ?? null;

  useEffect(() => {
    const uid = session?.user.id;
    if (!supabase || !uid) return;
    supabase.from('profiles').select('avatar').eq('id', uid).maybeSingle().then(({ data }) => {
      if (data?.avatar) setMyAvatar(data.avatar);
    });
  }, [session?.user.id, showProfile]);
  const onlineEnabled = Boolean(session && supabaseConfigured);

  async function logout() {
    setScreen('home');
    setGuest(false);
    if (supabase) await supabase.auth.signOut();
  }

  return (
    <div className="app-shell">
      {screen === 'home' && (
        <>
          <div className="topbar">
            <div className="brand">
              Revolver Noir
              <small>huit pièces · deux vies</small>
            </div>
            <div className="topbar-right">
              <div className="lang-switch">
                <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>
                  FR
                </button>
                <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>
                  EN
                </button>
              </div>
              <button
                className="pseudo-button topbar-pseudo"
                onClick={() => session?.user.id && setShowProfile(true)}
                disabled={!session?.user.id}
              >
                {myAvatar && <AvatarIcon avatar={myAvatar} size={17} />}
                <span className="brand-sub-text muted small">{pseudo ?? 'Invité'}</span>
              </button>
            </div>
          </div>
          <HomeScreen
            pseudo={pseudo}
            userId={session?.user.id ?? null}
            onLocal={() => setScreen('local')}
            onCreateCode={() => {
              setOnlineMode('code');
              setActiveRow(null);
              setScreen('online');
            }}
            onJoinCode={() => {
              setOnlineMode('join');
              setActiveRow(null);
              setScreen('online');
            }}
            onEnterGame={(row) => {
              setActiveRow(row);
              setOnlineMode('code');
              setScreen('online');
            }}
            onRules={() => setScreen('rules')}
            onLogout={logout}
            onlineEnabled={onlineEnabled}
          />
          {showProfile && session?.user.id && pseudo && (
            <ProfileModal userId={session.user.id} pseudo={pseudo} onClose={() => setShowProfile(false)} />
          )}
        </>
      )}
      {screen === 'rules' && <RulesScreen onBack={() => setScreen('home')} />}
      {screen === 'local' && <LocalGame onBack={() => setScreen('home')} />}
      {screen === 'online' && session && (
        <OnlineGame
          userId={session.user.id}
          pseudo={pseudo ?? 'Joueur'}
          onBack={() => setScreen('home')}
          initialMode={onlineMode}
          initialRow={activeRow}
        />
      )}
    </div>
  );
}
