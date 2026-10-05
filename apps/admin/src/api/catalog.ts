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
  CityListResponseSchema,
  CategoryListResponseSchema,
  type CityCreate,
  type CityUpdate,
  type CityListResponse,
  type CategoryCreate,
  type CategoryUpdate,
  type CategoryListResponse,
  type TourCreate,
  type TourUpdate,
  type AssetListQuery,
  type AssetResponse,
  type PaginatedAssetResponse,
  AssetResponseSchema,
  PaginatedAssetResponseSchema,
  SceneListResponseSchema,
  SceneResponseSchema,
  type SceneListResponse,
  type SceneResponse,
  type SceneCreate,
  type SceneUpdate,
  type SceneReorderRequest,
  type SetStartSceneRequest,
  TourValidationResponseSchema,
  type TourValidationResponse,
  HotspotResponseSchema,
  type HotspotResponse,
  type HotspotCreate,
  type HotspotUpdate,
  z
} from '@xplor/shared';
import { requestJson } from './client.js';

export async function listCities(): Promise<CityListResponse> {
  return requestJson('/api/v1/admin/cities', CityListResponseSchema);
}

export async function createCity(data: CityCreate): Promise<CityResponse> {
  return requestJson('/api/v1/admin/cities', CityResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCity(id: string, data: CityUpdate): Promise<CityResponse> {
  return requestJson(`/api/v1/admin/cities/${id}`, CityResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCity(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/cities/${id}`, null, {
    method: 'DELETE',
  });
}

export async function listCategories(): Promise<CategoryListResponse> {
  return requestJson('/api/v1/admin/categories', CategoryListResponseSchema);
}

export async function createCategory(data: CategoryCreate): Promise<CategoryResponse> {
  return requestJson('/api/v1/admin/categories', CategoryResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: string, data: CategoryUpdate): Promise<CategoryResponse> {
  return requestJson(`/api/v1/admin/categories/${id}`, CategoryResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/categories/${id}`, null, {
    method: 'DELETE',
  });
}

export async function listTours(query?: TourListQuery): Promise<PaginatedTourResponse> {
  const url = new URL('/api/v1/admin/tours', 'http://d'); // base url doesn't matter for path + search
  if (query) {
    if (query.page) url.searchParams.set('page', query.page.toString());
    if (query.pageSize) url.searchParams.set('pageSize', query.pageSize.toString());
    if (query.status) url.searchParams.set('status', query.status);
    if (query.cityId) url.searchParams.set('cityId', query.cityId);
    if (query.categoryId) url.searchParams.set('categoryId', query.categoryId);
    if (query.q) url.searchParams.set('q', query.q);
  }
  return requestJson(`${url.pathname}${url.search}`, PaginatedTourResponseSchema);
}

export async function getTour(id: string): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${id}`, TourResponseSchema);
}

export async function createTour(data: TourCreate): Promise<TourResponse> {
  return requestJson('/api/v1/admin/tours', TourResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTour(id: string, data: TourUpdate): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${id}`, TourResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTour(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/tours/${id}`, null, {
    method: 'DELETE',
  });
}

export async function duplicateTour(id: string): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${id}/duplicate`, TourResponseSchema, {
    method: 'POST',
  });
}

export async function listAssets(query?: AssetListQuery): Promise<PaginatedAssetResponse> {
  const url = new URL('/api/v1/admin/assets', 'http://d'); // base url doesn't matter for path + search
  if (query) {
    if (query.page) url.searchParams.set('page', query.page.toString());
    if (query.pageSize) url.searchParams.set('pageSize', query.pageSize.toString());
    if (query.kind) url.searchParams.set('kind', query.kind);
  }
  return requestJson(`${url.pathname}${url.search}`, PaginatedAssetResponseSchema);
}

export async function getAsset(id: string): Promise<AssetResponse> {
  return requestJson(`/api/v1/admin/assets/${id}`, AssetResponseSchema);
}

export async function listScenes(tourId: string): Promise<SceneListResponse> {
  return requestJson(`/api/v1/admin/tours/${tourId}/scenes`, SceneListResponseSchema);
}

export async function getScene(id: string): Promise<SceneResponse> {
  return requestJson(`/api/v1/admin/scenes/${id}`, SceneResponseSchema);
}

export async function createScene(tourId: string, data: SceneCreate): Promise<SceneResponse> {
  return requestJson<SceneResponse>(`/api/v1/admin/tours/${tourId}/scenes`, SceneResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateScene(id: string, data: SceneUpdate): Promise<SceneResponse> {
  return requestJson<SceneResponse>(`/api/v1/admin/scenes/${id}`, SceneResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteScene(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/scenes/${id}`, null, {
    method: 'DELETE',
  });
}

export async function reorderScenes(tourId: string, body: SceneReorderRequest): Promise<SceneListResponse> {
  return requestJson(`/api/v1/admin/tours/${tourId}/scenes/reorder`, SceneListResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function setStartScene(tourId: string, body: SetStartSceneRequest): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${tourId}/scenes/set-start`, TourResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function validateTour(id: string): Promise<TourValidationResponse> {
  return requestJson(`/api/v1/admin/tours/${id}/validate`, TourValidationResponseSchema, {
    method: 'POST',
  });
}

export async function publishTour(id: string): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${id}/publish`, TourResponseSchema, {
    method: 'POST',
  });
}

export async function unpublishTour(id: string): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${id}/unpublish`, TourResponseSchema, {
    method: 'POST',
  });
}


export async function listHotspots(sceneId: string): Promise<HotspotResponse[]> {
  const schema = z.array(HotspotResponseSchema);
  return requestJson(`/api/v1/admin/scenes/${sceneId}/hotspots`, schema);
}

export async function getHotspot(id: string): Promise<HotspotResponse> {
  return requestJson(`/api/v1/admin/hotspots/${id}`, HotspotResponseSchema);
}

export async function createHotspot(sceneId: string, data: HotspotCreate): Promise<HotspotResponse> {
  return requestJson(`/api/v1/admin/scenes/${sceneId}/hotspots`, HotspotResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHotspot(id: string, data: HotspotUpdate): Promise<HotspotResponse> {
  return requestJson(`/api/v1/admin/hotspots/${id}`, HotspotResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteHotspot(id: string): Promise<void> {
  await requestJson(`/api/v1/admin/hotspots/${id}`, null, {
    method: 'DELETE',
  });
}

export async function regenerateShareToken(id: string): Promise<TourResponse> {
  return requestJson(`/api/v1/admin/tours/${id}/share-token`, TourResponseSchema, {
    method: 'POST',
  });
}
