// 居酒屋1号店の間取り。座標は FLOOR と同じピクセル座標。
// D3で「席に座る」をサーバー側で検証するときもこの定義を使う。

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Seat {
  id: string;
  x: number;
  y: number;
}

/** 奥の壁（棚・短冊メニューが並ぶ） */
export const BACK_WALL_HEIGHT = 120;

/** カウンター（奥の壁沿い） */
export const COUNTER: Rect = { x: 160, y: 150, w: 640, h: 44 };

/** カウンター席 */
export const COUNTER_SEATS: Seat[] = Array.from({ length: 8 }, (_, i) => ({
  id: `counter-${i + 1}`,
  x: 200 + i * 80,
  y: 222,
}));

/** テーブル（4人掛け×3） */
export const TABLES: Rect[] = [
  { x: 120, y: 330, w: 140, h: 84 },
  { x: 410, y: 380, w: 140, h: 84 },
  { x: 700, y: 330, w: 140, h: 84 },
];

export const TABLE_SEATS: Seat[] = TABLES.flatMap((t, ti) => [
  { id: `table${ti + 1}-1`, x: t.x + 35, y: t.y - 22 },
  { id: `table${ti + 1}-2`, x: t.x + t.w - 35, y: t.y - 22 },
  { id: `table${ti + 1}-3`, x: t.x + 35, y: t.y + t.h + 22 },
  { id: `table${ti + 1}-4`, x: t.x + t.w - 35, y: t.y + t.h + 22 },
]);

/** 座れる場所すべて（カウンター席＋テーブル席） */
export const SEATS: Seat[] = [...COUNTER_SEATS, ...TABLE_SEATS];

export function findSeat(id: unknown): Seat | undefined {
  return SEATS.find((s) => s.id === id);
}

/** 入口（のれん）。下の壁の中央 */
export const ENTRANCE: Rect = { x: 420, y: 600, w: 120, h: 40 };
