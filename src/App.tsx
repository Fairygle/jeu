import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import RulesScreen from './screens/RulesScreen';
import LocalGame from './screens/LocalGame';
import OnlineGame from './screens/OnlineGame';
import FriendsSidebar from './components/FriendsSidebar';
import { supabase, supabaseConfigured } from './lib/supabase';

type Screen = 'home' | 'rules' | 'local' | 'online';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [ready, setReady] = useState(!supabaseConfigured);

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
            <span className="muted small">{pseudo ?? 'Invité'}</span>
          </div>
          <HomeScreen
            pseudo={pseudo}
            onLocal={() => setScreen('local')}
            onOnline={() => setScreen('online')}
            onRules={() => setScreen('rules')}
            onLogout={logout}
            onlineEnabled={onlineEnabled}
          />
        </>
      )}
      {screen === 'home' && session && <FriendsSidebar userId={session.user.id} />}
      {screen === 'rules' && <RulesScreen onBack={() => setScreen('home')} />}
      {screen === 'local' && <LocalGame onBack={() => setScreen('home')} />}
      {screen === 'online' && session && (
        <OnlineGame userId={session.user.id} pseudo={pseudo ?? 'Joueur'} onBack={() => setScreen('home')} />
      )}
    </div>
  );
}
