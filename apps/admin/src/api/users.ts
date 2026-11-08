import {
  AdminUserSchema,
  PaginatedAdminUsersResponseSchema,
  SetUserHotelsRequestSchema,
  UpdateAdminUserRequestSchema,
  type AdminUser,
  type AdminUserListQuery,
  type PaginatedAdminUsersResponse,
  type UpdateAdminUserRequest,
} from '@xplor/shared';
import { requestJson } from './client.js';

function buildUsersQueryString(query: Partial<AdminUserListQuery>): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) {
    params.set('page', query.page.toString());
  }
  if (query.pageSize !== undefined) {
    params.set('pageSize', query.pageSize.toString());
  }
  if (query.role !== undefined) {
    params.set('role', query.role);
  }
  if (query.active !== undefined) {
    params.set('active', String(query.active));
  }
  if (query.q !== undefined && query.q.trim().length > 0) {
    params.set('q', query.q.trim());
  }
  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : '';
}

export async function listUsers(
  query: Partial<AdminUserListQuery> = {},
): Promise<PaginatedAdminUsersResponse> {
  const search = buildUsersQueryString(query);
  return requestJson(`/api/v1/admin/users${search}`, PaginatedAdminUsersResponseSchema);
}

export async function getUser(id: string): Promise<AdminUser> {
  return requestJson(`/api/v1/admin/users/${id}`, AdminUserSchema);
}

export async function updateUser(
  id: string,
  input: UpdateAdminUserRequest,
): Promise<AdminUser> {
  const body = UpdateAdminUserRequestSchema.parse(input);
  return requestJson(`/api/v1/admin/users/${id}`, AdminUserSchema, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function setUserHotels(
  id: string,
  hotelIds: readonly string[] | string[],
): Promise<AdminUser> {
  const body = SetUserHotelsRequestSchema.parse({ hotelIds });
  return requestJson(`/api/v1/admin/users/${id}/hotels`, AdminUserSchema, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
