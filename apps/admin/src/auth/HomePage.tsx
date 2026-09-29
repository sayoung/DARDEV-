import { useTranslation } from 'react-i18next';

import { useAuth } from './AuthProvider.js';

export function HomePage() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.state.status !== 'authenticated') {
    return null;
  }
  const { profile } = auth.state;

  return (
    <section className="home-session">
      <p>{profile.name}</p>
      <p>{profile.role}</p>
      <button
        type="button"
        onClick={() => {
          void auth.logout().catch(() => undefined);
        }}
      >
        {t('auth.logout')}
      </button>
    </section>
  );
}
