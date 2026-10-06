import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';

describe('test', () => {
  let mockFetch: Mock<typeof fetch>;
  
  it('works', () => {
    mockFetch = vi.fn();
    const call = mockFetch.mock.calls[0];
    if (call) {
      const init = call[1];
      console.log(init?.method);
    }
  });
});
