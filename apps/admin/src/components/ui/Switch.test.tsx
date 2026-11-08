import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Switch } from './Switch.js';

describe('Switch', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with role="switch" and correct aria-checked state', () => {
    const { rerender } = render(<Switch checked={false} aria-label="Toggle active" />);

    const switchBtn = screen.getByRole('switch', { name: 'Toggle active' });
    expect(switchBtn.getAttribute('aria-checked')).toBe('false');

    rerender(<Switch checked={true} aria-label="Toggle active" />);
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onCheckedChange with opposite value on click', () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Toggle" />);

    const switchBtn = screen.getByRole('switch', { name: 'Toggle' });
    fireEvent.click(switchBtn);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not call onCheckedChange when disabled', () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        checked={false}
        disabled={true}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle"
      />,
    );

    const switchBtn = screen.getByRole('switch', { name: 'Toggle' });
    expect(switchBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(switchBtn);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('does not double toggle on click (native button click handles keyboard without custom onKeyDown)', () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Toggle" />);

    const switchBtn = screen.getByRole('switch', { name: 'Toggle' });
    fireEvent.click(switchBtn);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it('forwards ref to the underlying button element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Switch ref={ref} checked={true} id="test-switch" aria-label="Toggle" />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.id).toBe('test-switch');
  });
});
