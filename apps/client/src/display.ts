// 画面の細かさ（高精細ディスプレイ対応）。
// スマホは1pxを2〜3個の点で表示するので、そのぶん細かく描かないと文字がにじむ。
// ただし細かくしすぎると描画が重くなるので2倍までにする。

export const DPR = Math.min(window.devicePixelRatio || 1, 2);

/** 文字は拡大して映すことがあるので、常に2倍の細かさで作っておく */
export const TEXT_RESOLUTION = 2;
