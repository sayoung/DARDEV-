import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '@xplor/shared';

import { AuthProvider, useAuth } from './auth/AuthProvider.js';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage.js';
import { HomePage } from './auth/HomePage.js';
import { LoginPage } from './auth/LoginPage.js';
import { SetPasswordPage } from './auth/SetPasswordPage.js';
import { CategoriesPage } from './pages/CategoriesPage.js';
import { CitiesPage } from './pages/CitiesPage.js';
import { TourDetailPage } from './pages/TourDetailPage.js';
import { SceneDetailPage } from './pages/SceneDetailPage.js';
import { TourNewPage } from './pages/TourNewPage.js';
import { ToursPage } from './pages/ToursPage.js';
import { MediaPage } from './pages/MediaPage.js';
import { HotspotsPage } from './pages/HotspotsPage.js';
import { HotspotDetailPage } from './pages/HotspotDetailPage.js';
import { HotelsPage } from './pages/HotelsPage.js';
import { SelectionPage } from './pages/SelectionPage.js';
import { KiosksPage } from './pages/KiosksPage.js';
import { StatsPage } from './pages/StatsPage.js';
import { AccountSecurityPage } from './pages/AccountSecurityPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { UserDetailPage } from './pages/UserDetailPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { navigate, useAppLocation } from './router.js';

import { AppLayout } from './components/AppLayout.js';

export function App({ children }: { children?: ReactNode } = {}) {
  return (
    <AuthProvider>
      <AdminShell />
      {children}
    </AuthProvider>
  );
}

const SUCCESS_MESSAGE = {
  reset: 'auth.setPassword.successReset',
  invite: 'auth.setPassword.successInvite',
} as const satisfies Record<
  'reset' | 'invite',
  'auth.setPassword.successReset' | 'auth.setPassword.successInvite'
>;

function AdminShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route, notice } = useAppLocation();

  const isPublicRoute =
    route.name === 'forgot' || route.name === 'reset' || route.name === 'invite';
  const isAuthenticatedRoute = !isPublicRoute;
  const isAnonymous =
    auth.state.status === 'anonymous' || auth.state.status === 'two-factor';
  const isAuthenticated = auth.state.status === 'authenticated';

  const isEnforcing2fa =
    auth.state.status === 'authenticated' &&
    auth.state.profile.role === Role.ADMIN &&
    !auth.state.profile.totpEnabled;

  useEffect(() => {
    if (isEnforcing2fa && isAuthenticatedRoute && route.name !== 'account-security') {
      navigate('/account/security');
    }
  }, [isEnforcing2fa, isAuthenticatedRoute, route.name]);

  const canRenderProtected =
    isAuthenticated && (!isEnforcing2fa || route.name === 'account-security');

  return (
    <AppLayout>
      {route.name === 'forgot' ? <ForgotPasswordPage /> : null}
      {route.name === 'reset' ? <SetPasswordPage kind="reset" token={route.token} /> : null}
      {route.name === 'invite' ? <SetPasswordPage kind="invite" token={route.token} /> : null}

      {isAuthenticatedRoute && isAnonymous && notice !== null && (notice === 'reset' || notice === 'invite') ? (
        <p className="p-4 text-muted-foreground" role="status">
          {t(SUCCESS_MESSAGE[notice])}
        </p>
      ) : null}

      {isAuthenticatedRoute && isAnonymous ? <LoginPage /> : null}

      {canRenderProtected && route.name === 'home' ? <HomePage /> : null}
      {canRenderProtected && route.name === 'cities' ? <CitiesPage /> : null}
      {canRenderProtected && route.name === 'hotels' ? <HotelsPage /> : null}
      {canRenderProtected && route.name === 'kiosks' ? <KiosksPage /> : null}
      {canRenderProtected && route.name === 'stats' ? <StatsPage /> : null}
      {canRenderProtected && route.name === 'hotel-selection' ? <SelectionPage hotelId={route.id} /> : null}
      {canRenderProtected && route.name === 'categories' ? <CategoriesPage /> : null}
      {canRenderProtected && route.name === 'tours' ? <ToursPage /> : null}
      {canRenderProtected && route.name === 'tour-new' ? <TourNewPage /> : null}
      {canRenderProtected && route.name === 'tour-detail' ? <TourDetailPage /> : null}
      {canRenderProtected && route.name === 'scene-detail' ? <SceneDetailPage /> : null}
      {canRenderProtected && route.name === 'media' ? <MediaPage /> : null}
      {canRenderProtected && route.name === 'hotspots' ? <HotspotsPage /> : null}
      {canRenderProtected && (route.name === 'hotspot-new' || route.name === 'hotspot-detail') ? <HotspotDetailPage /> : null}
      {isAuthenticated && route.name === 'account-security' ? <AccountSecurityPage /> : null}
      {canRenderProtected && route.name === 'users' ? <UsersPage /> : null}
      {canRenderProtected && route.name === 'user-detail' ? <UserDetailPage userId={route.id} /> : null}
      {canRenderProtected && route.name === 'audit' ? <AuditPage /> : null}
    </AppLayout>
  );
}
