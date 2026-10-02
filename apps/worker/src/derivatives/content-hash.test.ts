import { describe, it, expect } from 'vitest';
import { sha256Hex } from './content-hash.js';

describe('sha256Hex', () => {
  it('returns the correct hash for an empty buffer', () => {
    const emptyBuffer = Buffer.from('');
    const hash = sha256Hex(emptyBuffer);
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hash.length).toBe(64);
  });

  it('returns the correct hash for "abc"', () => {
    const abcBuffer = Buffer.from('abc');
    const hash = sha256Hex(abcBuffer);
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hash.length).toBe(64);
  });

  it('returns different hashes for different contents', () => {
    const hash1 = sha256Hex(Buffer.from('hello'));
    const hash2 = sha256Hex(Buffer.from('world'));
    expect(hash1).not.toBe(hash2);
  });
});
