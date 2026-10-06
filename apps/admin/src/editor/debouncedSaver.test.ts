import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedSaver } from './debouncedSaver';

describe('debouncedSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devrait envoyer les données après 1000ms et pas avant', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const statusMock = vi.fn();
    
    const saver = createDebouncedSaver(saveMock, statusMock, 1000);
    
    saver.schedule('key1', 'value1');
    expect(statusMock).toHaveBeenLastCalledWith('pending');
    expect(saveMock).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(500);
    expect(saveMock).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(500);
    // Les promesses doivent être résolues pour que le save s'exécute dans executeSaves
    await vi.runAllTimersAsync();
    
    expect(saveMock).toHaveBeenCalledWith('key1', 'value1');
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenNthCalledWith(2, 'saving');
    expect(statusMock).toHaveBeenNthCalledWith(3, 'saved');
  });

  it('devrait regrouper les appels par clé (garder la dernière valeur)', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const statusMock = vi.fn();
    
    const saver = createDebouncedSaver(saveMock, statusMock, 1000);
    
    saver.schedule('key1', 'value1');
    saver.schedule('key1', 'value2');
    saver.schedule('key2', 'value3');
    
    await vi.runAllTimersAsync();
    
    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(saveMock).toHaveBeenCalledWith('key1', 'value2');
    expect(saveMock).toHaveBeenCalledWith('key2', 'value3');
  });

  it('devrait permettre un flush immédiat', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const statusMock = vi.fn();
    
    const saver = createDebouncedSaver(saveMock, statusMock, 1000);
    
    saver.schedule('key1', 'value1');
    
    await saver.flush();
    
    expect(saveMock).toHaveBeenCalledWith('key1', 'value1');
    expect(statusMock).toHaveBeenLastCalledWith('saved');
  });

  it('devrait annuler les sauvegardes en attente avec cancel()', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const statusMock = vi.fn();
    
    const saver = createDebouncedSaver(saveMock, statusMock, 1000);
    
    saver.schedule('key1', 'value1');
    
    saver.cancel();
    
    await vi.runAllTimersAsync();
    
    expect(saveMock).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenLastCalledWith('idle');
  });

  it('devrait émettre le statut error si un appel échoue', async () => {
    const saveMock = vi.fn().mockRejectedValue(new Error('Erreur réseau'));
    const statusMock = vi.fn();
    
    const saver = createDebouncedSaver(saveMock, statusMock, 1000);
    
    saver.schedule('key1', 'value1');
    
    await vi.runAllTimersAsync();
    
    expect(saveMock).toHaveBeenCalledWith('key1', 'value1');
    expect(statusMock).toHaveBeenLastCalledWith('error');
  });
});
