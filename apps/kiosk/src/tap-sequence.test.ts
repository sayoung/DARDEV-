import { describe, expect, it } from 'vitest';

import { createTapSequenceDetector } from './tap-sequence.js';

describe('createTapSequenceDetector', () => {
  it('déclenche lors de 5 appuis en 3 s avec une horloge injectée', () => {
    let currentTime = 1000;
    let triggerCount = 0;

    const detector = createTapSequenceDetector({
      now: () => currentTime,
      onTrigger: () => {
        triggerCount++;
      },
    });

    currentTime = 1000;
    detector.tap();
    currentTime = 1500;
    detector.tap();
    currentTime = 2000;
    detector.tap();
    currentTime = 2500;
    detector.tap();
    currentTime = 4000; // 4000 - 1000 = 3000 ms (exactement dans la fenêtre de 3 s)
    detector.tap();

    expect(triggerCount).toBe(1);
  });

  it('ne déclenche pas si 5 appuis sont étalés sur plus de 3 s', () => {
    let currentTime = 1000;
    let triggerCount = 0;

    const detector = createTapSequenceDetector({
      now: () => currentTime,
      onTrigger: () => {
        triggerCount++;
      },
    });

    currentTime = 1000;
    detector.tap(); // premier appui à t=1000
    currentTime = 1800;
    detector.tap();
    currentTime = 2600;
    detector.tap();
    currentTime = 3400;
    detector.tap();
    currentTime = 4001; // 4001 - 1000 = 3001 ms (> 3000 ms, le premier appui est expiré)
    detector.tap();

    expect(triggerCount).toBe(0);
  });

  it('déclenche deux fois pour deux séries consécutives de 5 appuis', () => {
    let currentTime = 0;
    let triggerCount = 0;

    const detector = createTapSequenceDetector({
      now: () => currentTime,
      onTrigger: () => {
        triggerCount++;
      },
    });

    // Première série de 5 appuis en 2 s
    currentTime = 0;
    detector.tap();
    currentTime = 500;
    detector.tap();
    currentTime = 1000;
    detector.tap();
    currentTime = 1500;
    detector.tap();
    currentTime = 2000;
    detector.tap();

    expect(triggerCount).toBe(1);

    // Un 6e appui immédiat ne déclenche pas car le compteur a été remis à zéro
    currentTime = 2100;
    detector.tap();
    expect(triggerCount).toBe(1);

    // Suite de la 2e série (4 appuis supplémentaires pour atteindre 5 au total dans la 2e série)
    currentTime = 2300;
    detector.tap();
    currentTime = 2500;
    detector.tap();
    currentTime = 2700;
    detector.tap();
    currentTime = 2900;
    detector.tap();

    expect(triggerCount).toBe(2);
  });

  it('ne déclenche pas pour 4 appuis', () => {
    let currentTime = 0;
    let triggerCount = 0;

    const detector = createTapSequenceDetector({
      now: () => currentTime,
      onTrigger: () => {
        triggerCount++;
      },
    });

    currentTime = 100;
    detector.tap();
    currentTime = 300;
    detector.tap();
    currentTime = 500;
    detector.tap();
    currentTime = 700;
    detector.tap();

    expect(triggerCount).toBe(0);
  });

  it('déclenche quand une série de 5 appuis est complétée après expiration d’anciens appuis', () => {
    let currentTime = 0;
    let triggerCount = 0;

    const detector = createTapSequenceDetector({
      now: () => currentTime,
      onTrigger: () => {
        triggerCount++;
      },
    });

    currentTime = 0;
    detector.tap(); // appui 1 à 0 ms
    currentTime = 1000;
    detector.tap(); // appui 2 à 1000 ms
    currentTime = 2000;
    detector.tap(); // appui 3 à 2000 ms
    currentTime = 3000;
    detector.tap(); // appui 4 à 3000 ms

    currentTime = 3200;
    detector.tap(); // appui 5 à 3200 ms -> appui 1 expiré, reste 4 appuis [1000, 2000, 3000, 3200]
    expect(triggerCount).toBe(0);

    currentTime = 3800;
    detector.tap(); // appui 6 à 3800 ms -> dans la fenêtre [1000..3800] (2800 ms <= 3000 ms), 5 appuis
    expect(triggerCount).toBe(1);
  });

  it('gère des paramètres personnalisés requiredTaps et windowMs', () => {
    let currentTime = 100;
    let triggerCount = 0;

    const detector = createTapSequenceDetector({
      requiredTaps: 3,
      windowMs: 1000,
      now: () => currentTime,
      onTrigger: () => {
        triggerCount++;
      },
    });

    currentTime = 100;
    detector.tap();
    currentTime = 500;
    detector.tap();
    currentTime = 900;
    detector.tap();

    expect(triggerCount).toBe(1);
  });

  it('utilise Date.now par défaut si now n’est pas fourni', () => {
    let triggerCount = 0;
    const detector = createTapSequenceDetector({
      onTrigger: () => {
        triggerCount++;
      },
    });

    // 5 appuis consécutifs synchrones
    for (let index = 0; index < 5; index++) {
      detector.tap();
    }

    expect(triggerCount).toBe(1);
  });

  it('déclenche même si plusieurs appuis ont lieu à la même milliseconde', () => {
    let triggerCount = 0;
    const detector = createTapSequenceDetector({
      now: () => 42,
      onTrigger: () => {
        triggerCount++;
      },
    });

    for (let index = 0; index < 5; index++) {
      detector.tap();
    }

    expect(triggerCount).toBe(1);
  });

  it('valide que requiredTaps est un entier strictement positif', () => {
    expect(() =>
      createTapSequenceDetector({
        requiredTaps: 0,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);

    expect(() =>
      createTapSequenceDetector({
        requiredTaps: -3,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);

    expect(() =>
      createTapSequenceDetector({
        requiredTaps: 3.5,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);
  });

  it('valide que windowMs est un nombre fini strictement positif', () => {
    expect(() =>
      createTapSequenceDetector({
        windowMs: 0,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);

    expect(() =>
      createTapSequenceDetector({
        windowMs: -1000,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);

    expect(() =>
      createTapSequenceDetector({
        windowMs: Number.POSITIVE_INFINITY,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);

    expect(() =>
      createTapSequenceDetector({
        windowMs: Number.NaN,
        onTrigger: () => undefined,
      }),
    ).toThrow(RangeError);
  });
});
