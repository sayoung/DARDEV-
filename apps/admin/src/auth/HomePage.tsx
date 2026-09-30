import type { Role } from '@xplor/shared';
import { useTranslation } from 'react-i18next';

import { useAuth } from './AuthProvider.js';

const ROLE_LABEL = {
  ADMIN: 'auth.role.ADMIN',
  EDITOR: 'auth.role.EDITOR',
  HOTEL_MANAGER: 'auth.role.HOTEL_MANAGER',
  PARTNER: 'auth.role.PARTNER',
} as const satisfies Record<Role, `auth.role.${Role}`>;

export function HomePage() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.state.status !== 'authenticated') {
    return null;
  }
  const { profile } = auth.state;

  return (
    <section className="home-session">
      <h2>{t('page.home.title')}</h2>
      <p>{profile.name}</p>
      <p>{t(ROLE_LABEL[profile.role])}</p>
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
