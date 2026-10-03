import { idSchema } from '@xplor/shared';

export type ReprocessMode =
  | { mode: 'all' }
  | { mode: 'asset'; assetId: string };

export function parseReprocessArgs(argv: string[]): ReprocessMode {
  if (argv.length === 0) {
    throw new Error('La sous-commande "reprocess" est requise. Aucune option fournie.');
  }

  const [command, ...args] = argv;

  if (command !== 'reprocess') {
    throw new Error(`Sous-commande refusée : attendu "reprocess", reçu "${command ?? 'undefined'}".`);
  }

  let isAll = false;
  let assetId: string | undefined = undefined;

  for (const arg of args) {
    if (arg === '--all') {
      isAll = true;
    } else if (arg.startsWith('--asset=')) {
      const value = arg.slice('--asset='.length);
      const parsed = idSchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`La valeur de --asset n'est pas un UUID valide : "${value}".`);
      }
      assetId = value;
    } else {
      throw new Error(`Option inconnue : "${arg}".`);
    }
  }

  if (isAll && assetId !== undefined) {
    throw new Error('Les options --all et --asset sont mutuellement exclusives, vous ne pouvez pas fournir les deux.');
  }

  if (!isAll && assetId === undefined) {
    throw new Error('Une option est requise : fournissez --all ou --asset=<uuid>.');
  }

  if (isAll) {
    return { mode: 'all' };
  }

  return { mode: 'asset', assetId: assetId as string };
}
