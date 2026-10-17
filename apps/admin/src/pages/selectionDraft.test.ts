import { SelectionUpdateSchema, type SelectionResponse, type SelectionUpdate } from '@xplor/shared';
import { describe, expect, it } from 'vitest';
import {
  addTour,
  fromResponse,
  moveTour,
  removeTour,
  setFeatured,
  toggleAttract,
} from './selectionDraft.js';

const tourA = '00000000-0000-4000-8000-000000000001';
const tourB = '00000000-0000-4000-8000-000000000002';
const tourC = '00000000-0000-4000-8000-000000000003';
const absentTour = '00000000-0000-4000-8000-000000000004';

const draft: SelectionUpdate = {
  tourIds: [tourA, tourB, tourC],
  featuredTourId: tourB,
  attractTourIds: [tourA, tourB],
};

function expectValid(result: SelectionUpdate): void {
  expect(SelectionUpdateSchema.safeParse(result).success).toBe(true);
}

describe('selection draft helpers', () => {
  it('adds a tour at the end and ignores duplicates', () => {
    const added = addTour(draft, absentTour);
    expect(added.tourIds).toEqual([tourA, tourB, tourC, absentTour]);
    expect(addTour(added, tourA)).toEqual(added);
    expectValid(added);
  });

  it('removes a tour and clears its featured and attract references', () => {
    const result = removeTour(draft, tourB);
    expect(result).toEqual({
      tourIds: [tourA, tourC],
      featuredTourId: null,
      attractTourIds: [tourA],
    });
    expectValid(result);
  });

  it('moves tours by a delta while keeping moves inside the list bounds', () => {
    expect(moveTour(draft, tourC, -1).tourIds).toEqual([tourA, tourC, tourB]);
    expect(moveTour(draft, tourA, -1).tourIds).toEqual(draft.tourIds);
    expect(moveTour(draft, tourC, 10).tourIds).toEqual([tourA, tourB, tourC]);
    expect(moveTour(draft, absentTour, -1)).toEqual(draft);
    expectValid(moveTour(draft, tourC, -1));
  });

  it('sets or clears the featured tour and refuses a tour outside the draft', () => {
    expect(setFeatured(draft, tourC).featuredTourId).toBe(tourC);
    expect(setFeatured(draft, null).featuredTourId).toBeNull();
    expect(setFeatured(draft, absentTour)).toEqual(draft);
    expectValid(setFeatured(draft, tourC));
  });

  it('toggles attract tours and refuses a tour outside the draft', () => {
    expect(toggleAttract(draft, tourA).attractTourIds).toEqual([tourB]);
    expect(toggleAttract(draft, tourC).attractTourIds).toEqual([tourA, tourB, tourC]);
    expect(toggleAttract(draft, absentTour)).toEqual(draft);
    expectValid(toggleAttract(draft, tourC));
  });

  it('converts a response to an update ordered by item position', () => {
    const response: SelectionResponse = {
      hotelId: '10000000-0000-4000-8000-000000000001',
      version: 2,
      featuredTourId: tourB,
      attractTourIds: [tourA],
      items: [
        { tourId: tourC, position: 8 },
        { tourId: tourA, position: 0 },
        { tourId: tourB, position: 3 },
      ],
      updatedAt: '2026-10-17T10:00:00.000Z',
    };
    const result = fromResponse(response);
    expect(result).toEqual({
      tourIds: [tourA, tourB, tourC],
      featuredTourId: tourB,
      attractTourIds: [tourA],
    });
    expectValid(result);
  });
});
