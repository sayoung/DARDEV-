import { describe, expect, it, vi } from 'vitest';

describe('main (point d\'entrée du kiosque)', () => {
  it('démarre le kiosque en appelant bootstrapKiosk avec window et document', async () => {
    const bootstrapKioskMock = vi.fn();
    vi.doMock('./bootstrap.js', () => ({
      bootstrapKiosk: bootstrapKioskMock,
    }));

    await import('./main.js');

    expect(bootstrapKioskMock).toHaveBeenCalledTimes(1);
    expect(bootstrapKioskMock).toHaveBeenCalledWith(window, document);
  });
});
