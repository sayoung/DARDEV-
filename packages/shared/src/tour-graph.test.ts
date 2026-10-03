import { describe, expect, it } from 'vitest';
import { TourGraphSchema } from './tour-graph.js';

const uuidA = '01990000-0000-7000-8000-00000000000a';
const uuidB = '01990000-0000-7000-8000-00000000000b';
const scene1 = '01990000-0000-7000-8000-000000000001';
const scene2 = '01990000-0000-7000-8000-000000000002';
const hotspot1 = '01990000-0000-7000-8000-000000000003';
const hotspot2 = '01990000-0000-7000-8000-000000000004';
const hotspot3 = '01990000-0000-7000-8000-000000000005';

const exampleGraph = {
  id: uuidA, 
  contentVersion: 12, 
  lang: "fr",
  title: "Kasbah des Oudayas", 
  summary: "…", 
  city: "Rabat",
  categories: ["Monuments", "Médina"],
  coverUrl: "…", 
  practicalInfo: "…", 
  location: { lat: 34.0314, lng: -6.8363 },
  startSceneId: scene1,
  scenes: [
    {
      id: scene1, 
      title: "Porte Bab Oudaya", 
      caption: "…",
      panorama: {
        preview: "…/preview.jpg", 
        web: "…/web.jpg",
        tiles: { width: 8192, cols: 16, rows: 8, baseUrl: "…/tiles/{col}_{row}.jpg" }
      },
      initialView: { yaw: 0.0, pitch: 0.05, zoom: 50 },
      narrationUrl: "…/fr.mp3", 
      ambientUrl: null, 
      thumb: "…",
      hotspots: [
        { id: hotspot1, type: "SCENE_LINK", yaw: 1.2, pitch: -0.1, label: "Entrer dans la kasbah", icon: "ARROW", targetSceneId: scene2, arrivalYaw: 3.1 },
        { id: hotspot2, type: "TOUR_LINK", yaw: -2.0, pitch: 0.0, label: "Aller au Jardin andalou", icon: "PORTAL", targetTourId: uuidB, targetSceneId: null },
        { id: hotspot3, type: "INFO", yaw: 0.4, pitch: 0.3, label: "Histoire de la porte", icon: "INFO", bodyHtml: "<p>…</p>", images: ["…"] }
      ]
    }
  ],
  linkedTours: [ { id: uuidB, title: "Jardin andalou", coverUrl: "…", availableOffline: true } ]
};

describe('TourGraphSchema', () => {
  it('accepte l’exemple du cahier des charges (section 7.4)', () => {
    expect(TourGraphSchema.parse(exampleGraph)).toEqual(exampleGraph);
  });

  it('refuse un hotspot INFO sans bodyHtml', () => {
    const invalidGraph = {
      ...exampleGraph,
      scenes: [
        {
          ...exampleGraph.scenes[0],
          hotspots: [
            { id: hotspot3, type: "INFO", yaw: 0.4, pitch: 0.3, label: "Histoire de la porte", icon: "INFO", images: ["…"] }
          ]
        }
      ]
    };
    expect(TourGraphSchema.safeParse(invalidGraph).success).toBe(false);
  });

  it('refuse un hotspot TOUR_LINK sans targetTourId', () => {
    const invalidGraph = {
      ...exampleGraph,
      scenes: [
        {
          ...exampleGraph.scenes[0],
          hotspots: [
            { id: hotspot2, type: "TOUR_LINK", yaw: -2.0, pitch: 0.0, label: "Aller au Jardin andalou", icon: "PORTAL", targetSceneId: null }
          ]
        }
      ]
    };
    expect(TourGraphSchema.safeParse(invalidGraph).success).toBe(false);
  });

  it('refuse un graphe avec scenes: []', () => {
    const invalidGraph = { ...exampleGraph, scenes: [] };
    expect(TourGraphSchema.safeParse(invalidGraph).success).toBe(false);
  });
});
