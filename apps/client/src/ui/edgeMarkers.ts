/**
 * 画面の外にいる客の目印。スマホ縦はカメラが自分を追いかけるので、ほかの客が画面の外にいることがある。
 * 画面の端に「◀ みさき」のような小さな札を出し、押すとその人の近くへ歩く（賑わいが見えるように）。
 */
export interface EdgeMarker {
  id: string;
  name: string;
  /** 札を置く画面上の位置（CSSのpx） */
  x: number;
  y: number;
  side: "left" | "right" | "up" | "down";
}

const ARROWS = { left: "◀", right: "▶", up: "▲", down: "▼" } as const;

let root: HTMLElement | null = null;
const buttons = new Map<string, HTMLButtonElement>();

export function renderEdgeMarkers(markers: EdgeMarker[], onTap: (id: string) => void) {
  if (!root) {
    root = document.createElement("div");
    root.id = "edge-markers";
    document.body.append(root);
  }
  const alive = new Set(markers.map((m) => m.id));
  for (const [id, b] of buttons) {
    if (!alive.has(id)) {
      b.remove();
      buttons.delete(id);
    }
  }
  for (const m of markers) {
    let b = buttons.get(m.id);
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "edge-marker";
      b.dataset.id = m.id;
      b.addEventListener("click", () => onTap(m.id));
      root.append(b);
      buttons.set(m.id, b);
    }
    const name = m.name.length > 6 ? `${m.name.slice(0, 6)}…` : m.name;
    const label = m.side === "right" || m.side === "down" ? `${name} ${ARROWS[m.side]}` : `${ARROWS[m.side]} ${name}`;
    if (b.textContent !== label) b.textContent = label; // textContentで入れる（HTMLとして解釈させない）
    b.setAttribute("aria-label", `${m.name}さんのほうへ歩く`);
    b.style.left = `${Math.round(m.x)}px`;
    b.style.top = `${Math.round(m.y)}px`;
  }
}
