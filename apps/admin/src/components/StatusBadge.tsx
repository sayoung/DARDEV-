import { useTranslation } from 'react-i18next';
import { TourStatus } from '@xplor/shared';
import { Badge } from './ui/Badge.js';

export interface StatusBadgeProps {
  status: TourStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();

  const getVariant = () => {
    switch (status) {
      case TourStatus.PUBLISHED:
        return 'success';
      case TourStatus.DRAFT:
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Badge variant={getVariant()} className={className} data-testid={`tour-status-${status.toLowerCase()}`}>
      {t(`catalog.tour.status.${status}`)}
    </Badge>
  );
}
