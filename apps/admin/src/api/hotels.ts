import {
  SelectionResponseSchema,
  type SelectionResponse,
  type SelectionUpdate,
} from '@xplor/shared';
import { requestJson } from './client.js';

export async function getHotelSelection(hotelId: string): Promise<SelectionResponse> {
  return requestJson(`/api/v1/admin/hotels/${hotelId}/selection`, SelectionResponseSchema);
}

export async function saveHotelSelection(
  hotelId: string,
  body: SelectionUpdate,
): Promise<SelectionResponse> {
  return requestJson(`/api/v1/admin/hotels/${hotelId}/selection`, SelectionResponseSchema, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
