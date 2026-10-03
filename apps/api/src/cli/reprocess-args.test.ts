import { describe, it, expect } from 'vitest';
import { parseReprocessArgs } from './reprocess-args.js';

describe('parseReprocessArgs', () => {
  const validUuid = '018b7a66-b3e1-7e83-9b22-861f6540b615'; // Exemple d'UUID v7 valide
  
  it('doit renvoyer { mode: "all" } si --all est fourni avec la bonne sous-commande', () => {
    const result = parseReprocessArgs(['reprocess', '--all']);
    expect(result).toEqual({ mode: 'all' });
  });

  it('doit renvoyer { mode: "asset", assetId } si --asset est fourni avec un UUID valide', () => {
    const result = parseReprocessArgs(['reprocess', `--asset=${validUuid}`]);
    expect(result).toEqual({ mode: 'asset', assetId: validUuid });
  });

  it('doit lever une erreur si la sous-commande n\'est pas "reprocess"', () => {
    expect(() => parseReprocessArgs(['foo', '--all'])).toThrow('Sous-commande refusée : attendu "reprocess", reçu "foo".');
  });

  it('doit lever une erreur si aucune option n\'est fournie', () => {
    expect(() => parseReprocessArgs(['reprocess'])).toThrow('Une option est requise : fournissez --all ou --asset=<uuid>.');
  });

  it('doit lever une erreur si les deux options --all et --asset sont fournies', () => {
    expect(() => parseReprocessArgs(['reprocess', '--all', `--asset=${validUuid}`])).toThrow('Les options --all et --asset sont mutuellement exclusives, vous ne pouvez pas fournir les deux.');
  });

  it('doit lever une erreur si --asset ne contient pas un UUID valide', () => {
    expect(() => parseReprocessArgs(['reprocess', '--asset=invalid-uuid'])).toThrow('La valeur de --asset n\'est pas un UUID valide : "invalid-uuid".');
  });

  it('doit lever une erreur si une option inconnue est fournie', () => {
    expect(() => parseReprocessArgs(['reprocess', '--unknown'])).toThrow('Option inconnue : "--unknown".');
  });

  it('doit lever une erreur si aucun argument n\'est fourni', () => {
    expect(() => parseReprocessArgs([])).toThrow('La sous-commande "reprocess" est requise. Aucune option fournie.');
  });
});
