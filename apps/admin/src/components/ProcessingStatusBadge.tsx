import { useTranslation } from 'react-i18next';
import { ProcessingStatus } from '@xplor/shared';
import { Badge } from './ui/Badge.js';

export interface ProcessingStatusBadgeProps {
  status: ProcessingStatus;
  className?: string;
}

export function ProcessingStatusBadge({ status, className }: ProcessingStatusBadgeProps) {
  const { t } = useTranslation();

  const getVariant = () => {
    switch (status) {
      case ProcessingStatus.READY:
        return 'success';
      case ProcessingStatus.ERROR:
        return 'destructive';
      case ProcessingStatus.PROCESSING:
        return 'default';
      case ProcessingStatus.PENDING:
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Badge variant={getVariant()} className={className} data-testid={`processing-status-${status.toLowerCase()}`}>
      {t(`media.status.${status}`)}
    </Badge>
  );
}
