import {
  SelectionUpdateSchema,
  type SelectionResponse,
  type SelectionUpdate,
} from '@xplor/shared';

function validated(draft: SelectionUpdate): SelectionUpdate {
  return SelectionUpdateSchema.parse(draft);
}

export function addTour(draft: SelectionUpdate, tourId: string): SelectionUpdate {
  if (draft.tourIds.includes(tourId)) return validated(draft);
  return validated({ ...draft, tourIds: [...draft.tourIds, tourId] });
}

export function removeTour(draft: SelectionUpdate, tourId: string): SelectionUpdate {
  return validated({
    tourIds: draft.tourIds.filter((id) => id !== tourId),
    featuredTourId: draft.featuredTourId === tourId ? null : draft.featuredTourId,
    attractTourIds: draft.attractTourIds.filter((id) => id !== tourId),
  });
}

export function moveTour(
  draft: SelectionUpdate,
  tourId: string,
  delta: number,
): SelectionUpdate {
  const index = draft.tourIds.indexOf(tourId);
  if (index < 0 || !Number.isInteger(delta)) return validated(draft);

  const destination = Math.max(0, Math.min(draft.tourIds.length - 1, index + delta));
  if (destination === index) return validated(draft);

  const tourIds = [...draft.tourIds];
  tourIds.splice(index, 1);
  tourIds.splice(destination, 0, tourId);
  return validated({ ...draft, tourIds });
}

export function setFeatured(
  draft: SelectionUpdate,
  tourId: string | null,
): SelectionUpdate {
  if (tourId !== null && !draft.tourIds.includes(tourId)) return validated(draft);
  return validated({ ...draft, featuredTourId: tourId });
}

export function toggleAttract(draft: SelectionUpdate, tourId: string): SelectionUpdate {
  if (!draft.tourIds.includes(tourId)) return validated(draft);

  const attractTourIds = draft.attractTourIds.includes(tourId)
    ? draft.attractTourIds.filter((id) => id !== tourId)
    : [...draft.attractTourIds, tourId];
  return validated({ ...draft, attractTourIds });
}

export function fromResponse(selection: SelectionResponse): SelectionUpdate {
  return validated({
    tourIds: [...selection.items]
      .sort((left, right) => left.position - right.position)
      .map((item) => item.tourId),
    featuredTourId: selection.featuredTourId,
    attractTourIds: selection.attractTourIds,
  });
}
