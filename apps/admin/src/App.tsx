import { useTranslation } from 'react-i18next';

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
import { useAppLocation, type Notice } from './router.js';

import { AppLayout } from './components/AppLayout.js';

export function App() {
  return (
    <AuthProvider>
      <AdminShell />
    </AuthProvider>
  );
}

const SUCCESS_MESSAGE = {
  reset: 'auth.setPassword.successReset',
  invite: 'auth.setPassword.successInvite',
} as const satisfies Record<
  Notice,
  'auth.setPassword.successReset' | 'auth.setPassword.successInvite'
>;

function AdminShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route, notice } = useAppLocation();

  const isPublicRoute =
    route.name === 'forgot' || route.name === 'reset' || route.name === 'invite';
  const isAuthenticatedRoute = !isPublicRoute;
  const isAnonymous = auth.state.status === 'anonymous';
  const isAuthenticated = auth.state.status === 'authenticated';

  return (
    <AppLayout>
      {route.name === 'forgot' ? <ForgotPasswordPage /> : null}
      {route.name === 'reset' ? <SetPasswordPage kind="reset" token={route.token} /> : null}
      {route.name === 'invite' ? <SetPasswordPage kind="invite" token={route.token} /> : null}

      {isAuthenticatedRoute && isAnonymous && notice !== null ? (
        <p className="p-4 text-muted-foreground" role="status">
          {t(SUCCESS_MESSAGE[notice])}
        </p>
      ) : null}

      {isAuthenticatedRoute && isAnonymous ? <LoginPage /> : null}

      {isAuthenticated && route.name === 'home' ? <HomePage /> : null}
      {isAuthenticated && route.name === 'cities' ? <CitiesPage /> : null}
      {isAuthenticated && route.name === 'categories' ? <CategoriesPage /> : null}
      {isAuthenticated && route.name === 'tours' ? <ToursPage /> : null}
      {isAuthenticated && route.name === 'tour-new' ? <TourNewPage /> : null}
      {isAuthenticated && route.name === 'tour-detail' ? <TourDetailPage /> : null}
      {isAuthenticated && route.name === 'scene-detail' ? <SceneDetailPage /> : null}
      {isAuthenticated && route.name === 'media' ? <MediaPage /> : null}
      {isAuthenticated && route.name === 'hotspots' ? <HotspotsPage /> : null}
      {isAuthenticated && (route.name === 'hotspot-new' || route.name === 'hotspot-detail') ? <HotspotDetailPage /> : null}
    </AppLayout>
  );
}
