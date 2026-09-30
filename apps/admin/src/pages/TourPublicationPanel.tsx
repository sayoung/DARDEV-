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

  const statusText = t(`catalog.tour.status.${tour.status}`);

  return (
    <section className="tour-publication-panel" style={{ paddingBlock: '1rem', borderBottom: '1px solid #ccc', marginBlockEnd: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <strong>{t('catalog.publication.status')}: {statusText}</strong>
        {canPublish && (
          <>
            <button type="button" onClick={() => { void handleValidate(); }} disabled={submitting}>
              {t('catalog.publication.validate')}
            </button>
            {tour.status === TourStatus.DRAFT && (
              <button type="button" onClick={() => { void handlePublish(); }} disabled={submitting}>
                {t('catalog.publication.publish')}
              </button>
            )}
            {tour.status === TourStatus.PUBLISHED && (
              <button type="button" onClick={() => { void handleUnpublish(); }} disabled={submitting}>
                {t('catalog.publication.unpublish')}
              </button>
            )}
          </>
        )}
      </div>

      {errorMsg && <div className="form-error" role="alert" style={{ marginBlockStart: '1rem', color: 'red' }}>{errorMsg}</div>}
      {successMsg && <div className="form-success" role="status" style={{ marginBlockStart: '1rem', color: 'green' }}>{successMsg}</div>}

      {issues && issues.length > 0 && (
        <div role="alert" style={{ marginBlockStart: '1rem', padding: '1rem', backgroundColor: '#ffebe9', border: '1px solid #ff8182' }}>
          <h4 style={{ marginBlockStart: 0 }}>{t('catalog.publication.issuesTitle')}</h4>
          <ul style={{ marginBlockEnd: 0, paddingInlineStart: '1.5rem' }}>
            {issues.map((issue, idx) => {
              const label = t(`catalog.issue.${issue.code}`);
              const title = issue.sceneId ? sceneTitles[issue.sceneId] : null;
              return (
                <li key={`${issue.code}-${idx.toString()}`} style={{ marginBlockEnd: '0.5rem' }}>
                  {label}
                  {issue.sceneId && (
                    <>
                      {' - '}
                      <a href={`#scene-${issue.sceneId}`}>{title || issue.sceneId}</a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
