import { type Role, TourStatus } from '@xplor/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listTours } from '../api/catalog.js';
import { useAuth } from './AuthProvider.js';
import { hrefFor, navigate } from '../router.js';

import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card.js';

const ROLE_LABEL = {
  ADMIN: 'auth.role.ADMIN',
  EDITOR: 'auth.role.EDITOR',
  HOTEL_MANAGER: 'auth.role.HOTEL_MANAGER',
  PARTNER: 'auth.role.PARTNER',
} as const satisfies Record<Role, `auth.role.${Role}`>;

export function HomePage() {
  const { t } = useTranslation();
  const auth = useAuth();
  
  const [totalTours, setTotalTours] = useState<number | null>(null);
  const [draftTours, setDraftTours] = useState<number | null>(null);
  const [publishedTours, setPublishedTours] = useState<number | null>(null);

  useEffect(() => {
    if (auth.state.status === 'authenticated') {
      listTours({ page: 1, pageSize: 1 })
        .then((res) => { setTotalTours(res.total); })
        .catch(() => { /* ignore */ });
      listTours({ page: 1, pageSize: 1, status: TourStatus.DRAFT })
        .then((res) => { setDraftTours(res.total); })
        .catch(() => { /* ignore */ });
      listTours({ page: 1, pageSize: 1, status: TourStatus.PUBLISHED })
        .then((res) => { setPublishedTours(res.total); })
        .catch(() => { /* ignore */ });
    }
  }, [auth.state.status]);

  if (auth.state.status !== 'authenticated') {
    return null;
  }
  const { profile } = auth.state;
  const translatedRole = t(ROLE_LABEL[profile.role]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold font-sans text-primary">{t('page.home.title')}</h2>
        <div className="text-right flex items-baseline gap-2">
          <p className="font-semibold text-lg">{profile.name}</p>
          {profile.name !== translatedRole && (
            <p className="text-sm text-muted-foreground">{translatedRole}</p>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">Visites totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTours ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">Brouillons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftTours ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">Publiées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{publishedTours ?? '-'}</div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-xl font-bold mt-4">Raccourcis</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <a href={hrefFor('/tours')} onClick={(e) => { e.preventDefault(); navigate('/tours'); }} className="block">
          <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base text-primary">Gérer les visites</CardTitle>
            </CardHeader>
          </Card>
        </a>
        <a href={hrefFor('/cities')} onClick={(e) => { e.preventDefault(); navigate('/cities'); }} className="block">
          <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base text-primary">Gérer les villes</CardTitle>
            </CardHeader>
          </Card>
        </a>
        <a href={hrefFor('/categories')} onClick={(e) => { e.preventDefault(); navigate('/categories'); }} className="block">
          <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base text-primary">Gérer les catégories</CardTitle>
            </CardHeader>
          </Card>
        </a>
      </div>
    </section>
  );
}
