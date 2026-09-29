import { Role, type Principal } from '@xplor/shared';

/** ADMIN et EDITOR lisent et écrivent les visites (API-21), les scènes et les médias. */
export function canManageContent(principal: Principal): boolean {
  return principal.role === Role.ADMIN || principal.role === Role.EDITOR;
}

/** ADMIN et EDITOR gèrent les villes et les catégories (API-25). */
export function canManageCatalog(principal: Principal): boolean {
  return principal.role === Role.ADMIN || principal.role === Role.EDITOR;
}

/** Seul ADMIN crée et administre les comptes (F-90). */
export function canManageUsers(principal: Principal): boolean {
  return principal.role === Role.ADMIN;
}

/**
 * ADMIN accède à tout hôtel.
 * HOTEL_MANAGER et PARTNER seulement si l'hôtel est rattaché.
 * EDITOR n'accède à aucun hôtel.
 */
export function canAccessHotel(principal: Principal, hotelId: string): boolean {
  if (principal.role === Role.ADMIN) {
    return true;
  }
  if (principal.role === Role.HOTEL_MANAGER || principal.role === Role.PARTNER) {
    return principal.hotelIds.includes(hotelId);
  }
  return false;
}

/** ADMIN : tous les hôtels. EDITOR : aucun. Les autres rôles : hôtels rattachés. */
export function scopeHotelIds(principal: Principal): 'ALL' | string[] {
  if (principal.role === Role.ADMIN) {
    return 'ALL';
  }
  if (principal.role === Role.EDITOR) {
    return [];
  }
  return principal.hotelIds;
}

/** Les partenaires ne voient que des statistiques agrégées (D-04). */
export function canViewRawStats(principal: Principal): boolean {
  return principal.role !== Role.PARTNER;
}
