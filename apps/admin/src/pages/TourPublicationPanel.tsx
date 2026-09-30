import { useState } from 'react';
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
import { validateTour, publishTour, unpublishTour, listScenes } from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';

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

  const userRole = state.status === 'authenticated' ? state.profile.role : null;
  const canPublish = userRole === Role.ADMIN || userRole === Role.EDITOR;

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

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">{t('catalog.publication.status')}:</span>
        <StatusBadge status={tour.status} />
        {canPublish && (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" type="button" onClick={() => { void handleValidate(); }} disabled={submitting}>
              {t('catalog.publication.validate')}
            </Button>
            {tour.status === TourStatus.DRAFT && (
              <Button type="button" onClick={() => { void handlePublish(); }} disabled={submitting}>
                {t('catalog.publication.publish')}
              </Button>
            )}
            {tour.status === TourStatus.PUBLISHED && (
              <Button variant="secondary" type="button" onClick={() => { void handleUnpublish(); }} disabled={submitting}>
                {t('catalog.publication.unpublish')}
              </Button>
            )}
          </div>
        )}
      </div>

      {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}
      {successMsg && <div className="text-sm font-medium text-green-600" role="status">{successMsg}</div>}

      {issues && issues.length > 0 && (
        <Alert variant="destructive" role="alert">
          <h4 className="font-semibold mb-2">{t('catalog.publication.issuesTitle')}</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {issues.map((issue, idx) => {
              const label = t(`catalog.issue.${issue.code}`);
              const title = issue.sceneId ? sceneTitles[issue.sceneId] : null;
              return (
                <li key={`${issue.code}-${idx.toString()}`}>
                  {label}
                  {issue.sceneId && (
                    <>
                      {' - '}
                      <a href={`#scene-${issue.sceneId}`} className="underline hover:text-red-800 dark:hover:text-red-400">
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
