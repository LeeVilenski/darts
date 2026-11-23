/**
 * Regulation dartboard geometry. All radii in millimetres, measured from the
 * board centre to the centre of the wire. Shared by the hit resolver and the
 * procedural board renderer so visuals and scoring cannot drift apart.
 */
export const BOARD = {
  innerBull: 6.35,
  outerBull: 15.9,
  trebleInner: 99,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  /** Overall board (scoring area + number ring), for rendering. */
  boardRadius: 225.5,
  /** Half-width of the wire plus a nominal dart tip radius, for wire-contact checks. */
  wireContact: 1.2,
} as const;

/** Sector numbers clockwise starting at 12 o'clock. */
export const SECTORS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const SECTOR_ANGLE = 360 / SECTORS.length; // 18°

/** Ring radii (mm) that carry a circular wire. */
export const RING_WIRES = [
  BOARD.innerBull,
  BOARD.outerBull,
  BOARD.trebleInner,
  BOARD.trebleOuter,
  BOARD.doubleInner,
  BOARD.doubleOuter,
] as const;

/** World placement (metres). Board face is the plane z = 0, facing +z. */
export const WORLD = {
  bullHeight: 1.73,
  ocheDistance: 2.37,
} as const;

/** Angle in degrees, clockwise from 12 o'clock, in [0, 360). */
export function clockAngle(xMm: number, yMm: number): number {
  const deg = (Math.atan2(xMm, yMm) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Index into SECTORS for a clockwise angle. */
export function sectorIndexAt(angleDeg: number): number {
  return Math.floor(((angleDeg + SECTOR_ANGLE / 2) % 360) / SECTOR_ANGLE) % SECTORS.length;
}

/** Board-local point (mm) at the centre of a given sector and radius — handy for aiming and tests. */
export function pointInSector(sectorNumber: number, radiusMm: number): { x: number; y: number } {
  const idx = SECTORS.indexOf(sectorNumber as (typeof SECTORS)[number]);
  if (idx < 0) throw new Error(`Unknown sector ${sectorNumber}`);
  const a = (idx * SECTOR_ANGLE * Math.PI) / 180;
  return { x: Math.sin(a) * radiusMm, y: Math.cos(a) * radiusMm };
}
