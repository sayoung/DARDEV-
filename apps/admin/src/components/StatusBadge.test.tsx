import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TourStatus } from '@xplor/shared';
import { StatusBadge } from './StatusBadge.js';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('StatusBadge', () => {
  it('renders DRAFT status correctly', () => {
    render(<StatusBadge status={TourStatus.DRAFT} />);
    expect(screen.getByText('catalog.tour.status.DRAFT')).toBeTruthy();
  });

  it('renders PUBLISHED status correctly', () => {
    render(<StatusBadge status={TourStatus.PUBLISHED} />);
    expect(screen.getByText('catalog.tour.status.PUBLISHED')).toBeTruthy();
  });
});
