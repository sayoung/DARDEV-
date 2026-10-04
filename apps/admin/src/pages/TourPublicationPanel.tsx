import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TourResponse,
  type ValidationIssue,
  ValidationIssueSchema,
  TourStatus,
  localize,
  z,
  Role
} from '@xplor/shared';
import { validateTour, publishTour, unpublishTour, listScenes, regenerateShareToken } from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import { shareUrl, tourQrSvg } from '../lib/tour-qr.js';

import { StatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';

interface Props {
  tour: TourResponse;
  onTourUpdated: (tour: TourResponse) => void;
}

export function TourPublicationPanel({ tour, onTourUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [sceneTitles, setSceneTitles] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  const userRole = state.status === 'authenticated' ? state.profile.role : null;
  const canPublish = userRole === Role.ADMIN || userRole === Role.EDITOR;

  const webBase = typeof import.meta.env.VITE_PUBLIC_WEB_URL === 'string' 
    ? import.meta.env.VITE_PUBLIC_WEB_URL 
    : window.location.origin;

  const webUrl = tour.status === TourStatus.PUBLISHED && tour.publicShare && tour.shareToken
    ? shareUrl(webBase, tour.shareToken)
    : null;

  useEffect(() => {
    let cancelled = false;
    setQrSvg(null);

    if (webUrl) {
      tourQrSvg(webUrl)
        .then((svg) => {
          if (!cancelled) setQrSvg(svg);
        })
        .catch((err: unknown) => {
          if (!cancelled) console.error(err);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [webUrl]);

  const handleDownloadQr = () => {
    if (!qrSvg || !tour.shareToken) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xplor-${tour.shareToken}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchSceneTitles = async (issuesList: ValidationIssue[]) => {
    const sceneIds = issuesList.map(i => i.sceneId).filter((id): id is string => !!id);
    if (sceneIds.length === 0) return {};

    try {
      const scenes = await listScenes(tour.id);
      const titles: Record<string, string> = {};
      scenes.forEach(scene => {
        titles[scene.id] = localize(scene.title, i18n.language);
      });
      return titles;
    } catch {
      return {};
    }
  };

  const handleValidate = async () => {
    setSubmitting(true);
    setIssues(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await validateTour(tour.id);
      if (res.issues.length === 0) {
        setSuccessMsg(t('catalog.publication.noIssues'));
      } else {
        const titles = await fetchSceneTitles(res.issues);
        setSceneTitles(titles);
        setIssues(res.issues);
      }
    } catch {
      setErrorMsg(t('common.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setSubmitting(true);
    setIssues(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const updatedTour = await publishTour(tour.id);
      onTourUpdated(updatedTour);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOUR_NOT_PUBLISHABLE' && err.issues) {
        const parsedIssues = z.array(ValidationIssueSchema).safeParse(err.issues);
        if (parsedIssues.success) {
          const titles = await fetchSceneTitles(parsedIssues.data);
          setSceneTitles(titles);
          setIssues(parsedIssues.data);
        } else {
          setErrorMsg(t('common.error.generic'));
        }
      } else {
        setErrorMsg(t('common.error.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    setSubmitting(true);
    setIssues(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const updatedTour = await unpublishTour(tour.id);
      onTourUpdated(updatedTour);
    } catch {
      setErrorMsg(t('common.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateShareLink = async () => {
    if (!window.confirm(t('catalog.publication.regenerateConfirm'))) return;

    setSubmitting(true);
    setIssues(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const updatedTour = await regenerateShareToken(tour.id);
      onTourUpdated(updatedTour);
      setSuccessMsg(t('catalog.publication.regenerateSuccess'));
    } catch {
      setErrorMsg(t('common.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{t('catalog.publication.status')}:</span>
          <StatusBadge status={tour.status} />
          {tour.shareToken && (
            <>
              <span className="text-sm font-medium ms-4">{t('catalog.publication.shareToken')}:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded" data-testid="share-token-display">{tour.shareToken}</code>
            </>
          )}
        </div>
        {canPublish && (
          <div className="flex gap-2">
            <Button variant="outline" type="button" data-testid="validate-tour-btn" onClick={() => { void handleValidate(); }} disabled={submitting}>
              {t('catalog.publication.validate')}
            </Button>
            {tour.status === TourStatus.DRAFT && (
              <Button type="button" data-testid="publish-tour-btn" onClick={() => { void handlePublish(); }} disabled={submitting}>
                {t('catalog.publication.publish')}
              </Button>
            )}
            {tour.status === TourStatus.PUBLISHED && (
              <Button variant="secondary" type="button" onClick={() => { void handleUnpublish(); }} disabled={submitting}>
                {t('catalog.publication.unpublish')}
              </Button>
            )}
            <Button variant="outline" type="button" data-testid="regenerate-share-link-btn" onClick={() => { void handleRegenerateShareLink(); }} disabled={submitting}>
              {t('catalog.publication.regenerateShareLink')}
            </Button>
          </div>
        )}
      </div>

      {webUrl && qrSvg && (
        <div className="mt-4 p-4 border rounded-lg bg-muted/30 flex flex-col items-start gap-4" data-testid="qr-code-section">
          <h4 className="font-semibold">{t('catalog.publication.publicLink')}</h4>
          <div className="flex items-center gap-2 w-full">
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
              {webUrl}
            </a>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mt-2">
            <div 
              className="w-48 h-48 bg-white p-2 rounded shadow-sm"
              role="img"
              aria-label={t('catalog.publication.qrCodeTitle')}
              title={t('catalog.publication.qrCodeTitle')}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              data-testid="qr-code-svg"
            />
            <div className="flex flex-col gap-2">
              <Button variant="outline" type="button" onClick={handleDownloadQr}>
                {t('catalog.publication.downloadQrCode')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}
      {successMsg && <Alert variant="default" role="status" data-testid="validation-success">{successMsg}</Alert>}

      {issues && issues.length > 0 && (
        <Alert variant="destructive" role="alert">
          <h4 className="font-semibold mb-2">{t('catalog.publication.issuesTitle')}</h4>
          <ul className="list-disc ps-5 space-y-1 text-sm">
            {issues.map((issue, idx) => {
              const label = t(`catalog.issue.${issue.code}`);
              const title = issue.sceneId ? sceneTitles[issue.sceneId] : null;
              return (
                <li key={`${issue.code}-${idx.toString()}`}>
                  {label}
                  {issue.sceneId && (
                    <>
                      {' - '}
                      <a href={`#scene-${issue.sceneId}`} className="hover:underline text-destructive">
                        {title || issue.sceneId}
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Alert>
      )}
    </section>
  );
}

