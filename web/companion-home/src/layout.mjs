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
  reading: [1.95, 0.36, -2.2, Math.PI],
  writing: [1.95, 0.36, -2.2, Math.PI],
  phone: [3.2, 1.15, 3.9, 0],
  resting: [-2.4, 0.13, 0, 0],
  sleeping: [3.2, 1.15, 3.9, 0],
  eating: [-1.65, 0.36, 1.5, 0],
  tending: [-2.75, 0.13, 2.85, -Math.PI / 2],
  cleaning: [-0.6, 0.13, 0, 0],
};
// x/z bounds, including the space under desks and between hammock ropes.
export const OBSTACLES = [
  [-5.65, -3.25, -4.8, -3.5], // shelf
  [-5.3, -3.65, -2.1, 0.95], // sofa
  [0.6, 3.4, -4.2, -2.95], // desk
  [1.45, 2.45, -2.7, -1.7], // desk stool
  [-5.5, -4.4, 2.3, 3.4], // plant
  [-2.55, -0.75, 2.35, 4.15], // dining table (stool sits behind its edge)
  [2.2, 4.2, 0.6, 4.5], // hammock
];

export function tailClearance(action) {
  // Reclining tails stay almost still beside fabric. Standing poses have clear aisles.
  return ['sleeping', 'phone'].includes(action) ? 0.012 :
    ['reading', 'writing', 'eating'].includes(action) ? 0.02 : action === 'tending' ? 0.045 : 0.12;
}
