import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  type ResponseConfig,
  type ZodRequestBody,
} from '@asteasolutions/zod-to-openapi';
import {
  AcceptInviteRequestSchema,
  AssetListQuerySchema,
  AssetResponseSchema,
  AssetUploadRequestSchema,
  AssetUploadResponseSchema,
  CategoryCreateSchema,
  CategoryResponseSchema,
  CategoryUpdateSchema,
  CityCreateSchema,
  CityResponseSchema,
  CityUpdateSchema,
  ForgotPasswordRequestSchema,
  HotspotCreateSchema,
  HotspotResponseSchema,
  HotspotUpdateSchema,
  InviteUserRequestSchema,
  InviteUserResponseSchema,
  LoginRequestSchema,
  MeResponseSchema,
  PaginatedAssetResponseSchema,
  PaginatedTourResponseSchema,
  ResetPasswordRequestSchema,
  SceneCreateSchema,
  SceneReorderRequestSchema,
  SceneResponseSchema,
  SceneUpdateSchema,
  SetStartSceneRequestSchema,
  TourCreateSchema,
  TourListQuerySchema,
  TourResponseSchema,
  TourUpdateSchema,
  TourValidationResponseSchema,
  ValidationIssueSchema,
} from '@xplor/shared';
import { z, type ZodType } from 'zod';

import {
  ASSET_NOT_FOUND,
  CATEGORY_NOT_FOUND,
  CITY_NOT_FOUND,
  COVER_ASSET_NOT_FOUND,
  HOTSPOT_NOT_FOUND,
  MEDIA_ASSET_NOT_FOUND,
  PANORAMA_ASSET_NOT_FOUND,
  SCENE_LINK_FOREIGN,
  SCENE_LINK_SELF,
  SCENE_LINK_TARGET_MISSING,
  SCENE_NOT_FOUND,
  SCENE_SET_MISMATCH,
  START_SCENE_FOREIGN,
  TOUR_LINK_SCENE_FOREIGN,
  TOUR_LINK_SELF,
  TOUR_LINK_TARGET_MISSING,
  TOUR_NOT_FOUND,
  TOUR_NOT_PUBLISHABLE,
} from '../catalog/catalog.errors.js';
import type { HealthBody } from '../health/health.service.js';

const SESSION_COOKIE = 'sessionCookie';
const CSRF_HEADER = 'csrfToken';

const sessionSecurity = [{ [SESSION_COOKIE]: [] }];
const sessionAndCsrfSecurity = [{ [SESSION_COOKIE]: [], [CSRF_HEADER]: [] }];

/** Corps `{ status, checks }` de `GET /api/health` (D-38). */
const healthStatusSchema = z.enum(['ok', 'error']);
const healthBodySchema: z.ZodType<HealthBody> = z.object({
  status: healthStatusSchema,
  checks: z.object({
    db: healthStatusSchema,
    redis: healthStatusSchema,
    storage: healthStatusSchema,
  }),
});

function codedError<const Code extends string>(statusCode: 400 | 401 | 409 | 423, code: Code) {
  return z.object({
    statusCode: z.literal(statusCode),
    code: z.literal(code),
    message: z.literal(code),
  });
}

/** Corps NestJS d'une `HttpException` sans code métier. */
function nestError<const Status extends number>(statusCode: Status) {
  return z.object({
    statusCode: z.literal(statusCode),
    message: z.string(),
    error: z.string(),
  });
}

const invalidCredentialsError = codedError(401, 'INVALID_CREDENTIALS');
const accountLockedError = codedError(423, 'ACCOUNT_LOCKED');
const tokenInvalidError = codedError(400, 'TOKEN_INVALID');
const passwordInvalidError = codedError(400, 'PASSWORD_INVALID');
const passwordTooCommonError = codedError(400, 'PASSWORD_TOO_COMMON');
const emailTakenError = codedError(409, 'EMAIL_TAKEN');
const badRequestError = nestError(400);
const unauthorizedError = nestError(401);
const forbiddenError = nestError(403);
const notFoundError = nestError(404);
const inUseError = z.object({
  error: z.object({
    code: z.literal('IN_USE'),
    message: z.string(),
  }),
});
const referenceError = z.object({
  error: z.object({
    code: z.enum([CITY_NOT_FOUND, CATEGORY_NOT_FOUND, COVER_ASSET_NOT_FOUND]),
    message: z.string(),
  }),
});
const assetMissingError = z.object({
  error: z.object({
    code: z.literal(ASSET_NOT_FOUND),
    message: z.string(),
  }),
});
const tourMissingError = z.object({
  error: z.object({
    code: z.literal(TOUR_NOT_FOUND),
    message: z.string(),
  }),
});
const tourNotPublishableError = z.object({
  error: z.object({
    code: z.literal(TOUR_NOT_PUBLISHABLE),
    message: z.string(),
    issues: z.array(ValidationIssueSchema),
  }),
});
const sceneMissingError = z.object({
  error: z.object({
    code: z.literal(SCENE_NOT_FOUND),
    message: z.string(),
  }),
});
const panoramaMissingError = z.object({
  error: z.object({
    code: z.literal(PANORAMA_ASSET_NOT_FOUND),
    message: z.string(),
  }),
});
const sceneSetMismatchError = z.object({
  error: z.object({
    code: z.literal(SCENE_SET_MISMATCH),
    message: z.string(),
  }),
});
const startSceneForeignError = z.object({
  error: z.object({
    code: z.literal(START_SCENE_FOREIGN),
    message: z.string(),
  }),
});
const hotspotMissingError = z.object({
  error: z.object({
    code: z.literal(HOTSPOT_NOT_FOUND),
    message: z.string(),
  }),
});
const hotspotTargetError = z.object({
  error: z.object({
    code: z.enum([
      SCENE_LINK_TARGET_MISSING,
      SCENE_LINK_SELF,
      SCENE_LINK_FOREIGN,
      TOUR_LINK_TARGET_MISSING,
      TOUR_LINK_SELF,
      TOUR_LINK_SCENE_FOREIGN,
      MEDIA_ASSET_NOT_FOUND,
    ]),
    message: z.string(),
  }),
});

const passwordChangeError = z.union([
  tokenInvalidError,
  passwordInvalidError,
  passwordTooCommonError,
  badRequestError,
]);

function jsonBody(schema: ZodType, description: string): ZodRequestBody {
  return {
    required: true,
    description,
    content: {
      'application/json': { schema },
    },
  };
}

function jsonResponse(description: string, schema: ZodType): ResponseConfig {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  };
}

const tooManyRequests: ResponseConfig = {
  description: 'Plus de 5 requêtes par minute pour cette adresse IP.',
};

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', SESSION_COOKIE, {
  type: 'apiKey',
  in: 'cookie',
  name: 'xplor_sid',
  description: 'Cookie de session httpOnly. La valeur est un identifiant opaque.',
});

registry.registerComponent('securitySchemes', CSRF_HEADER, {
  type: 'apiKey',
  in: 'header',
  name: 'X-CSRF-Token',
  description:
    'Jeton CSRF de la session courante. Exigé pour toute méthode autre que GET, HEAD ou OPTIONS.',
});

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Santé de la base, de Redis et du stockage',
  tags: ['Santé'],
  responses: {
    '200': jsonResponse('Les trois sondes répondent.', healthBodySchema),
    '503': jsonResponse(
      'Au moins une sonde a échoué ou dépassé le délai de 2 s.',
      healthBodySchema,
    ),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Ouvrir une session',
  tags: ['Auth'],
  request: {
    body: jsonBody(LoginRequestSchema, 'Identifiants du compte.'),
  },
  responses: {
    '200': jsonResponse('Session créée. Le cookie xplor_sid est posé.', MeResponseSchema),
    '400': jsonResponse('Corps refusé par LoginRequestSchema.', badRequestError),
    '401': jsonResponse('Identifiants refusés ou compte inactif.', invalidCredentialsError),
    '423': jsonResponse('Compte verrouillé.', accountLockedError),
    '429': tooManyRequests,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Fermer la session',
  tags: ['Auth'],
  security: sessionAndCsrfSecurity,
  responses: {
    '204': { description: 'Session détruite et cookie retiré. Corps vide.' },
    '401': jsonResponse('Session absente.', unauthorizedError),
    '403': jsonResponse('Jeton CSRF refusé.', forbiddenError),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Profil de la session courante',
  tags: ['Auth'],
  security: sessionSecurity,
  responses: {
    '200': jsonResponse('Profil et jeton CSRF.', MeResponseSchema),
    '401': jsonResponse(
      'Session absente, ou compte introuvable ou inactif (INVALID_CREDENTIALS).',
      z.union([unauthorizedError, invalidCredentialsError]),
    ),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/password/forgot',
  summary: 'Demander un lien de réinitialisation',
  tags: ['Auth'],
  request: {
    body: jsonBody(ForgotPasswordRequestSchema, 'Adresse du compte.'),
  },
  responses: {
    '202': {
      description:
        'Demande acceptée. Corps vide, que le compte existe, soit inactif, ou que l’envoi échoue.',
    },
    '400': jsonResponse('Corps refusé par ForgotPasswordRequestSchema.', badRequestError),
    '429': tooManyRequests,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/password/reset',
  summary: 'Choisir un nouveau mot de passe',
  tags: ['Auth'],
  request: {
    body: jsonBody(
      ResetPasswordRequestSchema,
      'Jeton de réinitialisation et nouveau mot de passe.',
    ),
  },
  responses: {
    '204': { description: 'Mot de passe enregistré. Corps vide.' },
    '400': jsonResponse(
      'Jeton refusé (TOKEN_INVALID), mot de passe trop court (PASSWORD_INVALID) ou trop courant (PASSWORD_TOO_COMMON).',
      passwordChangeError,
    ),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/invite/accept',
  summary: 'Accepter une invitation',
  tags: ['Auth'],
  request: {
    body: jsonBody(AcceptInviteRequestSchema, 'Jeton d’invitation et mot de passe choisi.'),
  },
  responses: {
    '204': { description: 'Compte activé. Aucune session n’est ouverte. Corps vide.' },
    '400': jsonResponse(
      'Jeton refusé (TOKEN_INVALID), mot de passe trop court (PASSWORD_INVALID) ou trop courant (PASSWORD_TOO_COMMON).',
      passwordChangeError,
    ),
    '429': tooManyRequests,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/admin/users/invitations',
  summary: 'Inviter un utilisateur',
  tags: ['Admin'],
  security: sessionAndCsrfSecurity,
  request: {
    body: jsonBody(
      InviteUserRequestSchema,
      'Compte à créer, ou invitation à renouveler si le compte est inactif et n’a jamais été connecté.',
    ),
  },
  responses: {
    '201': jsonResponse(
      'Compte créé ou invitation renouvelée. Le courriel est envoyé après l’enregistrement.',
      InviteUserResponseSchema,
    ),
    '400': jsonResponse('Corps refusé par InviteUserRequestSchema.', badRequestError),
    '401': jsonResponse('Session absente.', unauthorizedError),
    '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN.', forbiddenError),
    '409': jsonResponse(
      'Un compte actif, ou déjà connecté au moins une fois, existe pour cette adresse.',
      emailTakenError,
    ),
  },
});

registerCatalogCrud({
  collection: '/api/v1/admin/cities',
  singular: 'ville',
  plural: 'villes',
  create: CityCreateSchema,
  update: CityUpdateSchema,
  response: CityResponseSchema,
});

registerCatalogCrud({
  collection: '/api/v1/admin/categories',
  singular: 'catégorie',
  plural: 'catégories',
  create: CategoryCreateSchema,
  update: CategoryUpdateSchema,
  response: CategoryResponseSchema,
});

registerAssetReads();
registerAssetUpload();
registerAssetComplete();
registerAssetReprocess();
registerTourCrud();
registerTourValidate();
registerTourPublish();
registerTourDuplicate();
registerSceneCrud();
registerHotspotList();
registerHotspotItem();

function registerCatalogCrud(resource: {
  collection: string;
  singular: string;
  plural: string;
  create: ZodType;
  update: ZodType;
  response: ZodType;
}): void {
  const item = `${resource.collection}/{id}`;
  const idParam = z.object({ id: z.uuidv7() });
  registry.registerPath({
    method: 'get',
    path: resource.collection,
    summary: `Lister les ${resource.plural}`,
    tags: ['Catalogue'],
    security: sessionSecurity,
    responses: {
      '200': jsonResponse(`Liste des ${resource.plural}.`, z.array(resource.response)),
      '401': jsonResponse('Session absente.', unauthorizedError),
    },
  });
  registry.registerPath({
    method: 'get',
    path: item,
    summary: `Lire une ${resource.singular}`,
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse(`${resource.singular} trouvée.`, resource.response),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '404': jsonResponse(`${resource.singular} introuvable.`, notFoundError),
    },
  });
  registry.registerPath({
    method: 'post',
    path: resource.collection,
    summary: `Créer une ${resource.singular}`,
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { body: jsonBody(resource.create, `Corps de création d'une ${resource.singular}.`) },
    responses: {
      '201': jsonResponse(`${resource.singular} créée.`, resource.response),
      '400': jsonResponse('Corps refusé par le schéma Zod.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
    },
  });
  registry.registerPath({
    method: 'patch',
    path: item,
    summary: `Remplacer une ${resource.singular}`,
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: idParam,
      body: jsonBody(resource.update, 'Mêmes champs que la création (remplacement complet).'),
    },
    responses: {
      '200': jsonResponse(`${resource.singular} mise à jour.`, resource.response),
      '400': jsonResponse('Identifiant ou corps refusé.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '404': jsonResponse(`${resource.singular} introuvable.`, notFoundError),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: item,
    summary: `Supprimer une ${resource.singular}`,
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '204': { description: `${resource.singular} supprimée. Corps vide.` },
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '404': jsonResponse(`${resource.singular} introuvable.`, notFoundError),
      '409': jsonResponse('Encore utilisée par une visite (IN_USE).', inUseError),
    },
  });
}

function registerAssetReads(): void {
  const collection = '/api/v1/admin/assets';
  const item = `${collection}/{id}`;
  const roleDenied = 'Rôle autre que ADMIN ou EDITOR.';
  registry.registerPath({
    method: 'get',
    path: collection,
    summary: 'Lister les médias',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { query: AssetListQuerySchema },
    responses: {
      '200': jsonResponse(
        'Page de médias, triée par date de création décroissante.',
        PaginatedAssetResponseSchema,
      ),
      '400': jsonResponse('Paramètres de liste refusés.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
    },
  });
  registry.registerPath({
    method: 'get',
    path: item,
    summary: 'Lire un média',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { params: z.object({ id: z.uuidv7() }) },
    responses: {
      '200': jsonResponse('Média trouvé.', AssetResponseSchema),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
      '404': jsonResponse('Média introuvable.', assetMissingError),
    },
  });
}

function registerAssetUpload(): void {
  registry.registerPath({
    method: 'post',
    path: '/api/v1/admin/assets/upload-url',
    summary: 'Demander une URL d’upload',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: {
      body: {
        content: {
          'application/json': { schema: AssetUploadRequestSchema },
        },
      },
    },
    responses: {
      '201': jsonResponse('URL signée générée.', AssetUploadResponseSchema),
      '400': jsonResponse('Corps invalide.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Rôle autre que ADMIN ou EDITOR ou CSRF manquant.', forbiddenError),
      '422': jsonResponse('Règles de panorama non respectées.', referenceError), // referenceError is reused here arbitrarily but it's fine
    },
  });
}

function registerAssetComplete(): void {
  const item = '/api/v1/admin/assets/{id}/complete';
  const idParam = z.object({ id: z.uuidv7() });
  registry.registerPath({
    method: 'post',
    path: item,
    summary: 'Signaler la fin de l’envoi S3',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse('Statut du média mis à jour.', AssetResponseSchema),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('CSRF invalide, ou rôle autre que ADMIN/EDITOR.', forbiddenError),
      '404': jsonResponse('Média introuvable.', assetMissingError),
      '409': jsonResponse('Média déjà traité (plus PENDING).', z.object({ error: z.object({ code: z.literal('ASSET_ALREADY_COMPLETED'), message: z.string() }) })),
      '422': jsonResponse('Fichier manquant sur S3, ou JPEG invalide.', z.object({ error: z.object({ code: z.string(), message: z.string() }) })),
    },
  });
}

function registerAssetReprocess(): void {
  const item = '/api/v1/admin/assets/{id}/reprocess';
  const idParam = z.object({ id: z.uuidv7() });
  registry.registerPath({
    method: 'post',
    path: item,
    summary: 'Relancer le traitement d’un média',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse('Statut du média repassé à PROCESSING et tâche relancée.', AssetResponseSchema),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('CSRF invalide, ou rôle autre que ADMIN/EDITOR.', forbiddenError),
      '404': jsonResponse('Média introuvable.', assetMissingError),
      '409': jsonResponse('Le média est déjà en cours de traitement.', z.object({ error: z.object({ code: z.literal('ASSET_ALREADY_PROCESSING'), message: z.string() }) })),
      '422': jsonResponse('L’original est manquant sur le stockage.', z.object({ error: z.object({ code: z.string(), message: z.string() }) })),
    },
  });
}

function registerTourCrud(): void {
  const collection = '/api/v1/admin/tours';
  const item = `${collection}/{id}`;
  const idParam = z.object({ id: z.uuidv7() });
  const roleDenied = 'Rôle autre que ADMIN ou EDITOR.';
  registry.registerPath({
    method: 'get',
    path: collection,
    summary: 'Lister les visites',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { query: TourListQuerySchema },
    responses: {
      '200': jsonResponse('Page de visites non supprimées.', PaginatedTourResponseSchema),
      '400': jsonResponse('Paramètres de liste refusés.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
    },
  });
  registry.registerPath({
    method: 'get',
    path: item,
    summary: 'Lire une visite',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse(
        'Visite trouvée, avec ses catégories et le nombre de scènes.',
        TourResponseSchema,
      ),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', notFoundError),
    },
  });
  registry.registerPath({
    method: 'post',
    path: collection,
    summary: 'Créer une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      body: jsonBody(
        TourCreateSchema,
        'Corps de création. Le statut et le partage ne sont pas saisis.',
      ),
    },
    responses: {
      '201': jsonResponse(
        'Visite créée en brouillon, partage public désactivé.',
        TourResponseSchema,
      ),
      '400': jsonResponse('Corps refusé par TourCreateSchema.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '422': jsonResponse('Ville, catégorie ou vignette inconnue.', referenceError),
    },
  });
  registry.registerPath({
    method: 'patch',
    path: item,
    summary: 'Remplacer une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: idParam,
      body: jsonBody(
        TourUpdateSchema,
        'Mêmes champs que la création. categoryIds remplace l’ensemble.',
      ),
    },
    responses: {
      '200': jsonResponse('Visite mise à jour.', TourResponseSchema),
      '400': jsonResponse('Identifiant ou corps refusé.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', notFoundError),
      '422': jsonResponse('Ville, catégorie ou vignette inconnue.', referenceError),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: item,
    summary: 'Supprimer une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '204': { description: 'Suppression logique (deletedAt). Corps vide.' },
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '404': jsonResponse('Visite introuvable ou déjà supprimée.', notFoundError),
    },
  });
}

function registerTourValidate(): void {
  registry.registerPath({
    method: 'post',
    path: '/api/v1/admin/tours/{id}/validate',
    summary: 'Valider une visite avant publication',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: z.object({ id: z.uuidv7() }) },
    responses: {
      '200': jsonResponse(
        'Problèmes de publication. La liste est vide si la visite est publiable.',
        TourValidationResponseSchema,
      ),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
    },
  });
}

function registerTourPublish(): void {
  const idParam = z.object({ id: z.uuidv7() });
  const denied = 'Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.';
  registry.registerPath({
    method: 'post',
    path: '/api/v1/admin/tours/{id}/publish',
    summary: 'Publier une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse('Visite publiée.', TourResponseSchema),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(denied, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
      '422': jsonResponse(
        'La visite ne satisfait pas les règles de publication.',
        tourNotPublishableError,
      ),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/admin/tours/{id}/unpublish',
    summary: 'Dépublier une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse(
        'Visite repassée en brouillon. publishedAt est conservé.',
        TourResponseSchema,
      ),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(denied, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
    },
  });
}

function registerTourDuplicate(): void {
  registry.registerPath({
    method: 'post',
    path: '/api/v1/admin/tours/{id}/duplicate',
    summary: 'Dupliquer une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: z.object({ id: z.uuidv7() }) },
    responses: {
      '201': jsonResponse(
        'Copie en brouillon. Le titre français est suffixé de « (copie) ». Les scènes non supprimées et leurs hotspots sont recopiés ; les liens de scène pointent vers les copies.',
        TourResponseSchema,
      ),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse('Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.', forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
    },
  });
}

function registerSceneCrud(): void {
  const collection = '/api/v1/admin/tours/{tourId}/scenes';
  const item = '/api/v1/admin/scenes/{id}';
  const tourParam = z.object({ tourId: z.uuidv7() });
  const idParam = z.object({ id: z.uuidv7() });
  const roleDenied = 'Rôle autre que ADMIN ou EDITOR.';
  const csrfOrRole = 'Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.';
  registry.registerPath({
    method: 'get',
    path: collection,
    summary: 'Lister les scènes d’une visite',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { params: tourParam },
    responses: {
      '200': jsonResponse(
        'Scènes non supprimées, triées par poids puis par date de création.',
        z.array(SceneResponseSchema),
      ),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
    },
  });
  registry.registerPath({
    method: 'post',
    path: collection,
    summary: 'Créer une scène',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: tourParam,
      body: jsonBody(
        SceneCreateSchema,
        'Corps de création. La première scène devient la scène de départ.',
      ),
    },
    responses: {
      '201': jsonResponse('Scène créée.', SceneResponseSchema),
      '400': jsonResponse('Identifiant ou corps refusé par SceneCreateSchema.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
      '422': jsonResponse('Panorama inconnu.', panoramaMissingError),
    },
  });
  registry.registerPath({
    method: 'post',
    path: `${collection}/reorder`,
    summary: 'Réordonner les scènes d’une visite',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: tourParam,
      body: jsonBody(
        SceneReorderRequestSchema,
        'Identifiants des scènes non supprimées, dans l’ordre voulu. weight devient l’index.',
      ),
    },
    responses: {
      '200': jsonResponse(
        'Scènes non supprimées, triées par poids puis par date de création.',
        z.array(SceneResponseSchema),
      ),
      '400': jsonResponse('Identifiant ou corps refusé.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
      '422': jsonResponse(
        'La liste n’est pas exactement les scènes non supprimées, ou contient un doublon.',
        sceneSetMismatchError,
      ),
    },
  });
  registry.registerPath({
    method: 'post',
    path: `${collection}/set-start`,
    summary: 'Choisir la scène de départ',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: tourParam,
      body: jsonBody(SetStartSceneRequestSchema, 'Scène non supprimée de cette visite.'),
    },
    responses: {
      '200': jsonResponse(
        'Visite mise à jour. startSceneId n’est pas dans ce schéma.',
        TourResponseSchema,
      ),
      '400': jsonResponse('Identifiant ou corps refusé.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Visite introuvable ou supprimée.', tourMissingError),
      '422': jsonResponse(
        'Scène inconnue, supprimée, ou rattachée à une autre visite.',
        startSceneForeignError,
      ),
    },
  });
  registry.registerPath({
    method: 'get',
    path: item,
    summary: 'Lire une scène',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { params: idParam },
    responses: {
      '200': jsonResponse('Scène trouvée, avec le nombre de hotspots.', SceneResponseSchema),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
      '404': jsonResponse('Scène introuvable ou supprimée.', sceneMissingError),
    },
  });
  registry.registerPath({
    method: 'patch',
    path: item,
    summary: 'Remplacer une scène',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: idParam,
      body: jsonBody(SceneUpdateSchema, 'Mêmes champs que la création (remplacement complet).'),
    },
    responses: {
      '200': jsonResponse('Scène mise à jour.', SceneResponseSchema),
      '400': jsonResponse('Identifiant ou corps refusé.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Scène introuvable ou supprimée.', sceneMissingError),
      '422': jsonResponse('Panorama inconnu.', panoramaMissingError),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: item,
    summary: 'Supprimer une scène',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '204': {
        description:
          'Suppression logique (deletedAt). Si c’était la scène de départ, startSceneId revient à null. Corps vide.',
      },
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Scène introuvable ou déjà supprimée.', sceneMissingError),
    },
  });
}

function registerHotspotList(): void {
  const collection = '/api/v1/admin/scenes/{sceneId}/hotspots';
  const sceneParam = z.object({ sceneId: z.uuidv7() });
  const roleDenied = 'Rôle autre que ADMIN ou EDITOR.';
  const csrfOrRole = 'Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.';
  registry.registerPath({
    method: 'get',
    path: collection,
    summary: 'Lister les hotspots d’une scène',
    tags: ['Catalogue'],
    security: sessionSecurity,
    request: { params: sceneParam },
    responses: {
      '200': jsonResponse(
        'Hotspots de la scène, triés par date de création croissante.',
        z.array(HotspotResponseSchema),
      ),
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(roleDenied, forbiddenError),
      '404': jsonResponse('Scène introuvable ou supprimée.', sceneMissingError),
    },
  });
  registry.registerPath({
    method: 'post',
    path: collection,
    summary: 'Créer un hotspot',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: sceneParam,
      body: jsonBody(HotspotCreateSchema, 'Corps de création. Le type impose ses champs.'),
    },
    responses: {
      '201': jsonResponse('Hotspot créé.', HotspotResponseSchema),
      '400': jsonResponse('Identifiant ou corps refusé par HotspotCreateSchema.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Scène introuvable ou supprimée.', sceneMissingError),
      '422': jsonResponse(
        'Cible absente, incohérente, ou média inconnu. Une visite cible en brouillon est acceptée.',
        hotspotTargetError,
      ),
    },
  });
}

function registerHotspotItem(): void {
  const item = '/api/v1/admin/hotspots/{id}';
  const idParam = z.object({ id: z.uuidv7() });
  const csrfOrRole = 'Jeton CSRF refusé, ou rôle autre que ADMIN ou EDITOR.';
  registry.registerPath({
    method: 'patch',
    path: item,
    summary: 'Remplacer un hotspot',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: {
      params: idParam,
      body: jsonBody(
        HotspotUpdateSchema,
        'Mêmes champs que la création. Le type peut changer ; les champs des autres types sont effacés.',
      ),
    },
    responses: {
      '200': jsonResponse(
        'Hotspot mis à jour. Les champs des autres types valent null, ou un tableau vide pour mediaAssetIds.',
        HotspotResponseSchema,
      ),
      '400': jsonResponse('Identifiant ou corps refusé par HotspotUpdateSchema.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Hotspot inconnu, ou scène parente supprimée.', hotspotMissingError),
      '422': jsonResponse(
        'Cible absente, incohérente, ou média inconnu. Une visite cible en brouillon est acceptée.',
        hotspotTargetError,
      ),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: item,
    summary: 'Supprimer un hotspot',
    tags: ['Catalogue'],
    security: sessionAndCsrfSecurity,
    request: { params: idParam },
    responses: {
      '204': {
        description: 'Suppression physique. Corps vide.',
      },
      '400': jsonResponse('Identifiant qui n’est pas un UUID v7.', badRequestError),
      '401': jsonResponse('Session absente.', unauthorizedError),
      '403': jsonResponse(csrfOrRole, forbiddenError),
      '404': jsonResponse('Hotspot inconnu, ou scène parente déjà supprimée.', hotspotMissingError),
    },
  });
}

/** Document OpenAPI 3.1 produit à partir du registre. */
export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  return new OpenApiGeneratorV31(registry.definitions, {
    sortComponents: 'alphabetically',
  }).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Xplor API',
      version: '0.0.0',
      description:
        'Généré depuis les schémas Zod de @xplor/shared. Les corps de requête et de réponse ne sont pas redéclarés.',
    },
  });
}

/** Sérialisation stable écrite dans `docs/openapi.json`. */
export function serializeOpenApiDocument(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
}

/** Fichier commité, à la racine du dépôt. */
export function openApiDocumentFile(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/openapi.json');
}
