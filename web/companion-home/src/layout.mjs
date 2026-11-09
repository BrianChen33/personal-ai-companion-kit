// One shared floor plan for placement, clearances and the tail's swept envelope.
export const ROOM = { width: 12.8, depth: 10.2 };
export const ZONES = {
  window: [-0.3, 0, -1.5],
  entry: [1.75, 0, -1.5],
  desk: [-0.35, 0, -1.6],
  sofa: [-1.7, 0, -0.6],
  shelf: [-1.6, 0, -1.55],
  plant: [-8.9, 0, 3.6],
  table: [0, 0, 0.5],
  hammock: [0.55, 0, 1.5],
};
export const POSES = {
  idle: [-0.6, 0.13, 0, 0],
  reading: [0, 0.13, -2.1, 0],
  writing: [0, 0.13, -2.1, 0],
  phone: [3.2, 1.15, 3.9, 0],
  resting: [-2.4, 0.13, 0, 0],
  sleeping: [3.2, 1.15, 3.9, 0],
  eating: [-0.7, 0.13, 1.4, 0],
  tending: [-2.75, 0.13, 2.85, -Math.PI / 2],
  cleaning: [-0.6, 0.13, 0, 0],
};
// x/z bounds, including the space under desks and between hammock ropes.
export const OBSTACLES = [
  [-5.65, -3.25, -4.8, -3.5], // shelf
  [-5.3, -3.65, -2.1, 0.95], // sofa
  [0.6, 3.4, -4.2, -2.95], // desk
  [1.5, 2.3, -2.8, -1.7], // chair
  [-5.5, -4.4, 2.3, 3.4], // plant
  [-1.15, 0.3, 2.7, 3.7], // table
  [2.2, 4.2, 0.6, 4.5], // hammock
];

export function tailClearance(action) {
  // Reclining tails stay almost still beside fabric. Standing poses have clear aisles.
  return ['sleeping', 'phone'].includes(action) ? 0.012 : action === 'tending' ? 0.045 : 0.12;
}
