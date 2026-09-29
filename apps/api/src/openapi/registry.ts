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
  CategoryCreateSchema,
  CategoryResponseSchema,
  CategoryUpdateSchema,
  CityCreateSchema,
  CityResponseSchema,
  CityUpdateSchema,
  ForgotPasswordRequestSchema,
  InviteUserRequestSchema,
  InviteUserResponseSchema,
  LoginRequestSchema,
  MeResponseSchema,
  ResetPasswordRequestSchema,
} from '@xplor/shared';
import { z, type ZodType } from 'zod';

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
      '409': jsonResponse(
        'Encore utilisée par une visite (IN_USE).',
        inUseError,
      ),
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
