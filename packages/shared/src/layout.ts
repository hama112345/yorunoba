// 居酒屋1号店の間取り。
// 背景の絵（art/source/background.png、1536×1024）の上で測った位置を、店の座標（FLOOR：960×640）に直して使う。
// 背景を差し替えたら、ここの数字も絵に合わせて引き直すこと（数字はすべて「背景の絵の上のピクセル」）。
// サーバーは「歩ける場所」「座れる席」をここで検証し、画面は同じ値で絵を重ねる。

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 座ったとき体がどちらを向くか（front＝こちら向き、back＝奥向き、left/right＝横向き） */
export type Facing = "front" | "back" | "left" | "right";

export interface Seat {
  id: string;
  /** 座ったときの足元（床の位置）。重なり順もこの y で決まる */
  x: number;
  y: number;
  facing: Facing;
  /** 座面の高さ（床からの高さ、px）。床に座る絵のキャラは、このぶん持ち上げて椅子に乗せる */
  lift: number;
}

/** 背景の絵の大きさ（px） */
export const BG_SIZE = { width: 1536, height: 1024 } as const;

/** 店内の広さ（ピクセル）。Phaserの座標系と一致させる。背景の絵をこの大きさに縮めて敷く */
export const FLOOR = { width: 960, height: 640 } as const;

/** 背景の絵の1px が、店の座標で何pxか */
export const BG_SCALE = FLOOR.width / BG_SIZE.width;

/** 背景の絵の上の位置（px）を、店の座標に直す */
const p = (v: number) => Math.round(v * BG_SCALE);
/** 背景の絵の上の範囲（左上・右下）を、店の座標の Rect に直す */
const box = (x1: number, y1: number, x2: number, y2: number): Rect => ({
  x: p(x1),
  y: p(y1),
  w: p(x2) - p(x1),
  h: p(y2) - p(y1),
});

/** 歩ける範囲（床）。奥はカウンター席の前まで、手前はのれんの手前まで */
export const WALK_AREA: Rect = box(70, 335, 1470, 718);

/** カウンター（奥の壁沿い）。店員はこの奥に立つ */
export const COUNTER: Rect = box(392, 212, 1105, 330);

/** カウンター席（丸椅子8つ）。客はカウンターの方を向いて（背中をこちらに向けて）座る */
export const COUNTER_SEATS: Seat[] = [460, 545, 631, 708, 787, 865, 949, 1027].map((x, i) => ({
  id: `counter-${i + 1}`,
  x: p(x),
  y: p(334),
  facing: "back",
  lift: p(44),
}));

interface TableSpec {
  /** 天板の範囲（背景の絵の上） */
  top: [number, number, number, number];
  /** 通れない範囲（天板・脚・横の椅子） */
  block: [number, number, number, number];
  /** 奥の椅子2つの x と足元の y（こちら向きに座る） */
  back: [number, number, number];
  /** 左右の椅子の x と足元の y（テーブルの方を向いて座る） */
  sides: [number, number, number];
  /** 手前の椅子2つの x と足元の y（奥向きに座る） */
  front: [number, number, number];
}

const TABLE_SPECS: TableSpec[] = [
  { top: [182, 465, 427, 612], block: [140, 455, 468, 612], back: [309, 387, 510], sides: [172, 435, 560], front: [245, 350, 642] },
  { top: [650, 452, 900, 600], block: [605, 445, 945, 600], back: [700, 847, 497], sides: [635, 915, 545], front: [725, 822, 624] },
  { top: [1140, 465, 1375, 614], block: [1095, 455, 1418, 614], back: [1177, 1317, 510], sides: [1125, 1385, 560], front: [1210, 1310, 644] },
];

/** テーブル（6人掛け×3）の天板と脚。この範囲は歩けない */
export const TABLES: Rect[] = TABLE_SPECS.map((t) => box(...t.top));

export const TABLE_SEATS: Seat[] = TABLE_SPECS.flatMap((t, ti) => {
  const id = (n: number) => `table${ti + 1}-${n}`;
  return [
    { id: id(1), x: p(t.back[0]), y: p(t.back[2]), facing: "front", lift: p(33) },
    { id: id(2), x: p(t.back[1]), y: p(t.back[2]), facing: "front", lift: p(33) },
    { id: id(3), x: p(t.sides[0]), y: p(t.sides[2]), facing: "right", lift: p(33) },
    { id: id(4), x: p(t.sides[1]), y: p(t.sides[2]), facing: "left", lift: p(33) },
    { id: id(5), x: p(t.front[0]), y: p(t.front[2]), facing: "back", lift: p(33) },
    { id: id(6), x: p(t.front[1]), y: p(t.front[2]), facing: "back", lift: p(33) },
  ] satisfies Seat[];
});

/** 座れる場所すべて（カウンター席＋テーブル席） */
export const SEATS: Seat[] = [...COUNTER_SEATS, ...TABLE_SEATS];

export function findSeat(id: unknown): Seat | undefined {
  return SEATS.find((s) => s.id === id);
}

/** 歩けない場所：テーブル（横の椅子を含む）と、壁ぎわの飾り（左の階段・壺、右の掲示板） */
export const OBSTACLES: Rect[] = [
  ...TABLE_SPECS.map((t) => box(...t.block)),
  box(0, 300, 185, 440),
  box(1290, 330, 1490, 425),
];

/** 入口（のれん） */
export const ENTRANCE: Rect = box(640, 780, 900, 900);

/** 入ってきた客が最初に立つ範囲（のれんの内側） */
export const SPAWN_AREA: Rect = box(500, 640, 1040, 714);

/** キープボトルの名札を掛ける場所（奥の酒棚の大きな瓶の首。上の段→下の段の順） */
export const BOTTLE_TAG_SPOTS: { x: number; y: number }[] = [
  [535, 150], [580, 150], [625, 150], [690, 152], [740, 152],
  [535, 104], [580, 104], [625, 104],
].map(([x, y]) => ({ x: p(x), y: p(y) }));

/** 右奥の掲示板（タップすると今日のお題を出す） */
export const NOTICE_BOARD: Rect = box(1290, 165, 1490, 345);

/** 店員（AI店員ゲン）が立つ場所。カウンターの奥なので、腰から下はカウンターに隠れる */
export const STAFF_SPOT = { x: p(750), y: p(250) } as const;

/**
 * 絵の手前に重ねる部分（背景の絵から切り抜いて、人より手前に描く）。
 * depth より奥（y が小さい）にいる人は、この部分に体が隠れる。テーブルの奥の席に座った人の足や、カウンターの中の店員の腰など
 */
export interface Occluder {
  /** 背景の絵の上の範囲（px。切り抜きに使うので、店の座標に直さない） */
  src: [number, number, number, number];
  /** 重なり順（店の座標の y） */
  depth: number;
}

export const OCCLUDERS: Occluder[] = [
  // カウンター（天板と前板）。中の店員より手前、カウンター席の客より奥
  { src: [392, 212, 1105, 330], depth: p(330) },
  // テーブルの天板と脚（奥の席の人は、腰から下が天板に隠れる）。
  // 天板の上の行灯・花は四角く切り抜くと周りの床まで人に重なるので、切り抜かない
  ...TABLE_SPECS.map((t) => ({ src: t.top, depth: p(t.top[3]) })),
];

/** 提灯・行灯の位置（人数に合わせて揺れる光を重ねる）。絵の端の灯りは、光が店の外にはみ出すので入れない */
export const LANTERN_SPOTS: { x: number; y: number }[] = [
  [183, 95], [350, 85], [490, 88], [640, 85], [820, 85], [1110, 85],
  [1275, 240], [195, 245], [448, 195], [1040, 210],
  [307, 480], [776, 458], [1256, 480], [580, 870], [962, 870], [120, 815],
].map(([x, y]) => ({ x: p(x), y: p(y) }));

function inside(r: Rect, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** 歩ける場所か（歩ける範囲の中で、テーブルや飾りの上でない） */
export function isWalkable(x: number, y: number) {
  return inside(WALK_AREA, x, y) && !OBSTACLES.some((o) => inside(o, x, y));
}

/**
 * 行き先を歩ける場所に直す（サーバーが正。クライアントから来た座標は必ずこれを通す）。
 * 範囲の外なら範囲の端へ。テーブルなどの上なら、いちばん近い外側へ押し出す
 */
export function clampToFloor(x: number, y: number): { x: number; y: number } {
  const nx = Number.isFinite(x) ? x : WALK_AREA.x + WALK_AREA.w / 2;
  const ny = Number.isFinite(y) ? y : WALK_AREA.y + WALK_AREA.h / 2;
  const cx = Math.round(Math.min(Math.max(nx, WALK_AREA.x), WALK_AREA.x + WALK_AREA.w));
  const cy = Math.round(Math.min(Math.max(ny, WALK_AREA.y), WALK_AREA.y + WALK_AREA.h));
  const hit = OBSTACLES.find((o) => inside(o, cx, cy));
  if (!hit) return { x: cx, y: cy };
  const candidates = [
    { x: hit.x - 1, y: cy },
    { x: hit.x + hit.w + 1, y: cy },
    { x: cx, y: hit.y - 1 },
    { x: cx, y: hit.y + hit.h + 1 },
  ].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  return candidates.find((c) => isWalkable(c.x, c.y)) ?? { x: SPAWN_AREA.x, y: SPAWN_AREA.y };
}

interface Point {
  x: number;
  y: number;
}

/** テーブルの角から少し離して回る距離（px） */
const PATH_MARGIN = 6;

/** 線分 a→b が、四角 r の内側を通るか（ふちをかすめるだけなら通らない扱い） */
function crosses(a: Point, b: Point, r: Rect) {
  const [x1, y1, x2, y2] = [r.x + 0.5, r.y + 0.5, r.x + r.w - 0.5, r.y + r.h - 0.5];
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - x1],
    [dx, x2 - a.x],
    [-dy, a.y - y1],
    [dy, y2 - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** テーブルなどの上にいるなら、いちばん近いふちの外側の点（席を立つとき・座りに行くときの出入り口） */
function doorway(p: Point): Point | undefined {
  const o = OBSTACLES.find((r) => inside(r, p.x, p.y));
  if (!o) return undefined;
  const m = PATH_MARGIN;
  const options = [
    { d: p.x - o.x, x: o.x - m, y: p.y },
    { d: o.x + o.w - p.x, x: o.x + o.w + m, y: p.y },
    { d: p.y - o.y, x: p.x, y: o.y - m },
    { d: o.y + o.h - p.y, x: p.x, y: o.y + o.h + m },
  ].sort((a, b) => a.d - b.d);
  const best = options.find((c) => isWalkable(c.x, c.y)) ?? options[0];
  return { x: best.x, y: best.y };
}

/**
 * 歩く道すじ（通る点の並び。最後が行き先）。テーブルを突っ切らないよう、角を回って歩く。
 * 画面の見た目のためだけに使う（サーバーは行き先が歩ける場所かだけを確かめる）
 */
export function walkPath(from: Point, to: Point): Point[] {
  const exit = doorway(from);
  const entry = doorway(to);
  const a = exit ?? from;
  const b = entry ?? to;
  const clear = (p: Point, q: Point) => !OBSTACLES.some((o) => crosses(p, q, o));
  // 角の点（テーブルの四隅の少し外）を経由点の候補にして、いちばん短い道を探す
  const m = PATH_MARGIN;
  const corners = OBSTACLES.flatMap((o) => [
    { x: o.x - m, y: o.y - m },
    { x: o.x + o.w + m, y: o.y - m },
    { x: o.x - m, y: o.y + o.h + m },
    { x: o.x + o.w + m, y: o.y + o.h + m },
  ]).filter((c) => isWalkable(c.x, c.y));
  const nodes = [a, ...corners, b];
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < nodes.length; k++) if (!done[k] && dist[k] < Infinity && (i < 0 || dist[k] < dist[i])) i = k;
    if (i < 0 || i === nodes.length - 1) break;
    done[i] = true;
    for (let k = 0; k < nodes.length; k++) {
      if (done[k] || !clear(nodes[i], nodes[k])) continue;
      const d = dist[i] + Math.hypot(nodes[k].x - nodes[i].x, nodes[k].y - nodes[i].y);
      if (d < dist[k]) [dist[k], prev[k]] = [d, i];
    }
  }
  const route: Point[] = [];
  if (dist[nodes.length - 1] < Infinity) {
    for (let k = prev[nodes.length - 1]; k > 0; k = prev[k]) route.unshift(nodes[k]);
  }
  return [...(exit ? [exit] : []), ...route, ...(entry ? [entry] : []), { x: to.x, y: to.y }].filter(
    (p, i, all) => i === all.length - 1 || Math.hypot(p.x - from.x, p.y - from.y) > 0.5,
  );
}
