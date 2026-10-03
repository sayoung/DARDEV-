import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import logoUrl from '../assets/brand/xplor-logo.svg';

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 bg-background">
      <img src={logoUrl} alt="Xplor" className="h-12 mb-2" />
      <p className="font-comfortaa text-xl mb-6 text-foreground">{t('auth.slogan')}</p>
      {children}
    </div>
  );
}
