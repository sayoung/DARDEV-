import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export interface AxeCheckOptions {
  exclude?: string[];
}

/**
 * Vérifie l'absence de violations d'accessibilité WCAG 2.1 AA sur la page.
 * Lance AxeBuilder avec les tags wcag2a, wcag2aa, wcag21a et wcag21aa.
 * Échoue avec un message détaillant pour chaque violation l'ID, l'impact et les cibles.
 */
export async function expectNoA11yViolations(
  page: Page,
  options?: AxeCheckOptions,
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);

  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }

  const results = await builder.analyze();
  const violations = results.violations;

  const message =
    violations.length > 0
      ? `Violations d'accessibilité détectées (${String(violations.length)}) :\n${violations
          .map((violation) => {
            const impact = violation.impact ?? 'inconnu';
            const targets = violation.nodes
              .map((node) =>
                node.target
                  .map((target) => (typeof target === 'string' ? target : JSON.stringify(target)))
                  .join(' > '),
              )
              .join(', ');
            const targetsList = targets.length > 0 ? targets : '(aucune cible)';
            return `- ID: ${violation.id} | Impact: ${impact} | Cibles: ${targetsList}`;
          })
          .join('\n')}`
      : undefined;

  expect(violations, message).toEqual([]);
}
