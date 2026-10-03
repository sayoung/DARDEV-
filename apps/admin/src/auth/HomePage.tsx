import { TourStatus, Role } from '@xplor/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listTours } from '../api/catalog.js';
import { useAuth } from './AuthProvider.js';
import { hrefFor, navigate } from '../router.js';

import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card.js';
import { Alert } from '../components/ui/Alert.js';

export function HomePage() {
  const { t } = useTranslation();
  const auth = useAuth();
  
  const [totalTours, setTotalTours] = useState<number | null>(null);
  const [draftTours, setDraftTours] = useState<number | null>(null);
  const [publishedTours, setPublishedTours] = useState<number | null>(null);
  const [sceneCount, setSceneCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (auth.state.status === 'authenticated') {
      setIsLoading(true);
      setError(false);
      Promise.all([
        listTours({ page: 1, pageSize: 100 }),
        listTours({ page: 1, pageSize: 1, status: TourStatus.DRAFT }),
        listTours({ page: 1, pageSize: 1, status: TourStatus.PUBLISHED })
      ])
        .then(([allRes, draftRes, pubRes]) => {
          setTotalTours(allRes.total);
          setSceneCount(allRes.items.reduce((sum, t) => sum + t.sceneCount, 0));
          setDraftTours(draftRes.total);
          setPublishedTours(pubRes.total);
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [auth.state.status]);

  if (auth.state.status !== 'authenticated') {
    return null;
  }

  if (isLoading) {
    return <p role="status">{t('page.home.loading')}</p>;
  }

  if (error) {
    return <Alert role="alert">{t('page.home.error')}</Alert>;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold font-sans text-primary">{t('page.home.title')}</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">{t('page.home.stats.total')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTours ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">{t('page.home.stats.scenes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sceneCount ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">{t('page.home.stats.drafts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftTours ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">{t('page.home.stats.published')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{publishedTours ?? '-'}</div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-xl font-bold mt-4">{t('page.home.shortcuts.title')}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(auth.state.profile.role === Role.ADMIN || auth.state.profile.role === Role.EDITOR) && (
          <a href={hrefFor('/tours/new')} onClick={(e) => { e.preventDefault(); navigate('/tours/new'); }} className="block">
            <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base text-primary">{t('page.home.shortcuts.newTour')}</CardTitle>
              </CardHeader>
            </Card>
          </a>
        )}
        <a href={hrefFor('/tours')} onClick={(e) => { e.preventDefault(); navigate('/tours'); }} className="block">
          <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base text-primary">{t('page.home.shortcuts.manageTours')}</CardTitle>
            </CardHeader>
          </Card>
        </a>
        <a href={hrefFor('/cities')} onClick={(e) => { e.preventDefault(); navigate('/cities'); }} className="block">
          <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base text-primary">{t('page.home.shortcuts.manageCities')}</CardTitle>
            </CardHeader>
          </Card>
        </a>
        <a href={hrefFor('/categories')} onClick={(e) => { e.preventDefault(); navigate('/categories'); }} className="block">
          <Card className="hover:bg-muted transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base text-primary">{t('page.home.shortcuts.manageCategories')}</CardTitle>
            </CardHeader>
          </Card>
        </a>
      </div>
    </section>
  );
}
