import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n';
import { AVATAR_KEYS, AvatarIcon } from './avatars';

interface Props {
  userId: string;
  pseudo: string;
  onClose: () => void;
}

interface Stats {
  games_played: number;
  games_won: number;
  turns_sum: number;
  avatar: string | null;
}

export default function ProfileModal({ userId, pseudo, onClose }: Props) {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('profiles')
      .select('games_played, games_won, turns_sum, avatar')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setStats({
          games_played: data?.games_played ?? 0,
          games_won: data?.games_won ?? 0,
          turns_sum: data?.turns_sum ?? 0,
          avatar: data?.avatar ?? null,
        });
      });
  }, [userId]);

  async function chooseAvatar(key: string) {
    if (!supabase || saving) return;
    setSaving(true);
    setStats((s) => (s ? { ...s, avatar: key } : s));
    await supabase.from('profiles').upsert({ id: userId, pseudo, avatar: key });
    setSaving(false);
  }

  const avg = stats && stats.games_played > 0 ? (stats.turns_sum / stats.games_played).toFixed(1) : '—';

  return createPortal(
    <div className="wheel-overlay" onClick={onClose}>
      <div className="log-modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="log-modal-header">
          <span>{pseudo}</span>
          <button className="wheel-close-inline" onClick={onClose}>✕</button>
        </div>

        <div className="profile-body">
          <div className="profile-avatar-current">
            {stats?.avatar ? <AvatarIcon avatar={stats.avatar} size={44} /> : <span className="profile-initial">{pseudo[0]?.toUpperCase()}</span>}
          </div>

          <div className="profile-stats">
            <div className="stat-cell">
              <span className="stat-value">{stats?.games_played ?? '—'}</span>
              <span className="stat-label">{t('profile.played')}</span>
            </div>
            <div className="stat-cell">
              <span className="stat-value">{stats?.games_won ?? '—'}</span>
              <span className="stat-label">{t('profile.won')}</span>
            </div>
            <div className="stat-cell">
              <span className="stat-value">{avg}</span>
              <span className="stat-label">{t('profile.avgTurns')}</span>
            </div>
          </div>

          <div className="profile-section-title">{t('profile.chooseAvatar')}</div>
          <div className="avatar-grid">
            {AVATAR_KEYS.map((k) => (
              <button
                key={k}
                className={`avatar-opt ${stats?.avatar === k ? 'selected' : ''}`}
                onClick={() => chooseAvatar(k)}
                disabled={saving}
              >
                <AvatarIcon avatar={k} size={26} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
