import {
  CategoryResponseSchema,
  CityResponseSchema,
  PaginatedTourResponseSchema,
  TourResponseSchema,
  type CategoryResponse,
  type CityResponse,
  type PaginatedTourResponse,
  type TourListQuery,
  type TourResponse,
} from '@xplor/shared';
import { requestJson } from './client.js';

export async function listCities(): Promise<CityResponse[]> {
  const result = await requestJson('/api/v1/admin/cities', {
    parse: (val: unknown) => {
      if (!Array.isArray(val)) {
        throw new Error('Expected array');
      }
      return val.map((v) => CityResponseSchema.parse(v));
    },
  });
  return result ?? [];
}

export async function createCity(data: unknown): Promise<CityResponse> {
  const result = await requestJson('/api/v1/admin/cities', CityResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!result) throw new Error('Expected result');
  return result;
}

export async function updateCity(id: string, data: unknown): Promise<CityResponse> {
  const result = await requestJson(`/api/v1/admin/cities/${id}`, CityResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!result) throw new Error('Expected result');
  return result;
}

export async function deleteCity(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/cities/${id}`, CityResponseSchema, {
    method: 'DELETE',
  });
}

export async function listCategories(): Promise<CategoryResponse[]> {
  const result = await requestJson('/api/v1/admin/categories', {
    parse: (val: unknown) => {
      if (!Array.isArray(val)) {
        throw new Error('Expected array');
      }
      return val.map((v) => CategoryResponseSchema.parse(v));
    },
  });
  return result ?? [];
}

export async function createCategory(data: unknown): Promise<CategoryResponse> {
  const result = await requestJson('/api/v1/admin/categories', CategoryResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!result) throw new Error('Expected result');
  return result;
}

export async function updateCategory(id: string, data: unknown): Promise<CategoryResponse> {
  const result = await requestJson(`/api/v1/admin/categories/${id}`, CategoryResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!result) throw new Error('Expected result');
  return result;
}

export async function deleteCategory(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/categories/${id}`, CategoryResponseSchema, {
    method: 'DELETE',
  });
}

export async function listTours(query?: TourListQuery): Promise<PaginatedTourResponse> {
  const url = new URL('/api/v1/admin/tours', 'http://localhost'); // base url doesn't matter for path + search
  if (query) {
    if (query.page) url.searchParams.set('page', query.page.toString());
    if (query.pageSize) url.searchParams.set('pageSize', query.pageSize.toString());
    if (query.status) url.searchParams.set('status', query.status);
    if (query.cityId) url.searchParams.set('cityId', query.cityId);
    if (query.categoryId) url.searchParams.set('categoryId', query.categoryId);
    if (query.q) url.searchParams.set('q', query.q);
  }
  const result = await requestJson(`${url.pathname}${url.search}`, PaginatedTourResponseSchema);
  if (!result) throw new Error('Expected result');
  return result;
}

export async function getTour(id: string): Promise<TourResponse> {
  const result = await requestJson(`/api/v1/admin/tours/${id}`, TourResponseSchema);
  if (!result) throw new Error('Expected result');
  return result;
}

export async function createTour(data: unknown): Promise<TourResponse> {
  const result = await requestJson('/api/v1/admin/tours', TourResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!result) throw new Error('Expected result');
  return result;
}

export async function updateTour(id: string, data: unknown): Promise<TourResponse> {
  const result = await requestJson(`/api/v1/admin/tours/${id}`, TourResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!result) throw new Error('Expected result');
  return result;
}

export async function deleteTour(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/tours/${id}`, TourResponseSchema, {
    method: 'DELETE',
  });
}
