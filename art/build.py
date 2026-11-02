#!/usr/bin/env python3
"""
キャラと背景の絵を、ゲームで使う形に変換する。絵を差し替えたらこれを実行する。

  python3 art/build.py              # 変換して apps/client に書き出す
  python3 art/build.py --preview 出力先フォルダ   # 切り出し番号の一覧と、動きごとの確認画像も作る

- 入力：art/source/*.png（届いた絵そのまま）と art/characters.json（どの絵をどの動きに使うか）
- 出力：apps/client/public/assets/chars/<id>.webp（同じ大きさのコマを並べた1枚）
        apps/client/public/assets/izakaya-bg.webp（背景）
        apps/client/src/art/characters.json（コマの大きさと動きの対応）
必要なもの：Python 3 と Pillow・numpy
"""
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT_IMG = ROOT / "apps" / "client" / "public" / "assets"
OUT_JSON = ROOT / "apps" / "client" / "src" / "art" / "characters.json"

# 1つの動きの速さ（1秒あたりのコマ数）
RATES = {"idle": 2, "idle_back": 2, "walk_down": 8, "walk_up": 8, "walk_side": 8,
         "sit_front": 1, "sit_back": 1, "sit_side": 1, "drink": 4, "sit_drink": 4, "cheer": 5, "laugh": 5}
COLUMNS = 8


def load(path):
    """透明のある絵はそのまま、背景に市松模様が焼き込まれた絵は外側から塗りつぶして透明にする。
    半透明のふち（赤っぽいにじみ）は消して、くっきりさせる"""
    im = Image.open(path)
    if im.mode == "RGBA":
        rgba = np.array(im)
        mask = rgba[..., 3] >= 128
    else:
        rgb = np.array(im.convert("RGB"))
        mask = ~flood_light_background(rgb)
        rgba = np.dstack([rgb, np.zeros(rgb.shape[:2], np.uint8)])
    rgba[..., 3] = np.where(mask, 255, 0)
    return rgba, mask


def flood_light_background(rgb):
    h, w, _ = rgb.shape
    c = rgb.astype(int)
    spread = np.max(c, axis=2) - np.min(c, axis=2)
    light = (spread < 18) & (np.min(c, axis=2) > 200)
    bg = np.zeros((h, w), bool)
    q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    return bg


def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
    return lab, n


def bbox(m):
    ys, xs = np.nonzero(m)
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def cut_at_valley(proj, a, b, k):
    """[a,b) を k 個に分ける。境目は等分の位置の近くで一番細い所"""
    cuts, w = [a], (b - a) / k
    for j in range(1, k):
        guess = int(a + w * j)
        lo, hi = int(guess - w * 0.3), int(guess + w * 0.3)
        cuts.append(lo + int(np.argmin(proj[lo:hi])))
    cuts.append(b)
    return list(zip(cuts[:-1], cuts[1:]))


def detect(mask, splits):
    """シートから1コマずつ切り出す。戻り値は {"行.列" または "行.列:k": 1コマの不透明部分(マスク)}"""
    h2, w2 = mask.shape[0] // 2, mask.shape[1] // 2
    small = mask[: h2 * 2, : w2 * 2].reshape(h2, 2, w2, 2).any(axis=(1, 3))  # 速さのため半分の大きさで数える
    lab, n = label(small)
    full = np.kron(lab, np.ones((2, 2), np.int32))
    full = np.pad(full, ((0, mask.shape[0] - full.shape[0]), (0, mask.shape[1] - full.shape[1])))
    comps = []
    for i in range(1, n + 1):
        m = (full == i) & mask
        if m.sum() < 1500:  # 汗・「！」などの小さな記号は使わない
            continue
        comps.append((bbox(m), m))
    medh = sorted(b[3] - b[1] for b, _ in comps)[len(comps) // 2]
    medw = sorted(b[2] - b[0] for b, _ in comps)[len(comps) // 3]  # 1人ぶんの幅（狭いほうから1/3の所）
    pieces = []
    for b, m in comps:
        rows_ = [(b, m)]
        if b[3] - b[1] > medh * 1.55:  # 上下の行がくっついている
            k = round((b[3] - b[1]) / medh)
            rows_ = []
            for a, z in cut_at_valley(m.sum(1), b[1], b[3], k):
                part = m.copy()
                part[:a] = False
                part[z:] = False
                if part.sum() >= 1500:
                    rows_.append((bbox(part), part))
        for bb, mm in rows_:
            if bb[2] - bb[0] > medw * 1.45:  # 横に何人かくっついている
                k = round((bb[2] - bb[0]) / medw)
                for a, z in cut_at_valley(mm.sum(0), bb[0], bb[2], k):
                    part = mm.copy()
                    part[:, :a] = False
                    part[:, z:] = False
                    if part.sum() >= 1500:
                        pieces.append((bbox(part), part))
            else:
                pieces.append((bb, mm))
    # 行ごとにまとめ、左から順に番号を付ける
    pieces.sort(key=lambda p: (p[0][1] + p[0][3]) / 2)
    rows, cur = [], []
    for p in pieces:
        cy = (p[0][1] + p[0][3]) / 2
        if cur and cy - np.mean([(c[0][1] + c[0][3]) / 2 for c in cur]) > medh * 0.5:
            rows.append(cur)
            cur = []
        cur.append(p)
    rows.append(cur)
    frames = {}
    for r, row in enumerate(rows):
        for c, (b, m) in enumerate(sorted(row, key=lambda p: p[0][0])):
            key = f"{r}.{c}"
            k = splits.get(key, 1)
            if k == 1:
                frames[key] = m
                continue
            for j, (a, z) in enumerate(cut_at_valley(m.sum(0), b[0], b[2], k)):
                part = m.copy()
                part[:, :a] = False
                part[:, z:] = False
                frames[f"{key}:{j}"] = part
    return frames


def crop(rgba, m):
    x0, y0, x1, y1 = bbox(m)
    sub = m[y0:y1, x0:x1].copy()
    # 隣のコマと分けたときに残った細い切れ端（左右の端に触れている小さな塊）を消す
    lab, n = label(sub)
    if n > 1:
        areas = np.bincount(lab.ravel())[1:]
        for i, area in enumerate(areas, start=1):
            part = lab == i
            touches_side = part[:, 0].any() or part[:, -1].any()
            if touches_side and area < areas.max() * 0.15:
                sub[part] = False
        if sub.any():
            bx = bbox(sub)
            x0, y0, x1, y1 = x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]
            sub = sub[bx[1]:bx[3], bx[0]:bx[2]]
    img = rgba[y0:y1, x0:x1].copy()
    img[..., 3] = np.where(sub, 255, 0)
    return Image.fromarray(img)


def foot_center(img):
    """足もと（下から1/4）の不透明部分の真ん中。持ち物や記号でずれないよう、ここを中心にそろえる"""
    a = np.array(img)[..., 3] > 0
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * 0.75):])
    return float(xs.mean()) if len(xs) else img.width / 2


def build_character(spec, target, preview_dir=None):
    rgba, mask = load(SRC / spec["source"])
    frames = detect(mask, spec.get("split", {}))
    if preview_dir:
        save_index_sheet(rgba, frames, preview_dir / f"index-{spec['id']}.png")
    keys = []
    for names in spec["anims"].values():
        for k in names:
            if k not in frames:
                sys.exit(f"{spec['id']}: {k} が見つかりません（一覧画像で番号を確かめてください）")
            if k not in keys:
                keys.append(k)
    crops = {k: crop(rgba, frames[k]) for k in keys}
    # 立ち姿の高さをそろえる（キャラごとに1つの倍率）。
    # 元の絵は行ごとに描かれた大きさが違うことがあるので、動きごとに補正できる（manifest の scale）
    idle_h = sorted(crops[k].height for k in spec["anims"]["idle"])
    scale = target / idle_h[len(idle_h) // 2]
    per_key = {}
    for name, ks in spec["anims"].items():
        for k in ks:
            per_key.setdefault(k, spec.get("scale", {}).get(name, 1.0))
    scaled = {k: im.resize((max(1, round(im.width * scale * per_key[k])), max(1, round(im.height * scale * per_key[k]))),
                           Image.LANCZOS)
              for k, im in crops.items()}
    for im in scaled.values():  # 縮小でできた半透明のふちを、もう一度くっきりさせる
        a = np.array(im)
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
        im.paste(Image.fromarray(a))
    half = max(max(foot_center(im), im.width - foot_center(im)) for im in scaled.values())
    fw = int(math.ceil(half * 2)) + 4
    fh = max(im.height for im in scaled.values()) + 4
    rows = math.ceil(len(keys) / COLUMNS)
    sheet = Image.new("RGBA", (fw * min(COLUMNS, len(keys)), fh * rows), (0, 0, 0, 0))
    index = {}
    for i, k in enumerate(keys):
        im = scaled[k]
        cx, cy = (i % COLUMNS) * fw, (i // COLUMNS) * fh
        sheet.alpha_composite(im, (int(round(cx + fw / 2 - foot_center(im))), cy + fh - 2 - im.height))
        index[k] = i
    out = OUT_IMG / "chars" / f"{spec['id']}.webp"
    out.parent.mkdir(parents=True, exist_ok=True)
    # 軽くするため少しだけ圧縮する（透明部分の形はそのまま）
    sheet.save(out, "WEBP", quality=90, alpha_quality=100, method=6)
    anims = {name: {"frames": [index[k] for k in ks], "rate": RATES.get(name, 4)} for name, ks in spec["anims"].items()}
    if preview_dir:
        save_anim_preview(sheet, fw, fh, anims, preview_dir / f"anims-{spec['id']}.png")
    print(f"{spec['id']}: {len(keys)}コマ {fw}x{fh} → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")
    return {
        "id": spec["id"],
        "label": spec["label"],
        "url": f"assets/chars/{spec['id']}.webp",
        "frameWidth": fw,
        "frameHeight": fh,
        "side": spec["side"],
        "sitSide": spec.get("sitSide", spec["side"]),
        "staffOnly": bool(spec.get("staffOnly")),
        "anims": anims,
    }


def save_index_sheet(rgba, frames, path):
    im = Image.fromarray(rgba)
    canvas = Image.new("RGBA", im.size, (60, 40, 30, 255))
    canvas.alpha_composite(im)
    d = ImageDraw.Draw(canvas)
    for k, m in frames.items():
        b = bbox(m)
        d.rectangle(b, outline=(0, 255, 0, 255), width=2)
        d.rectangle([b[0], b[1], b[0] + 34, b[1] + 12], fill=(0, 0, 0, 255))
        d.text((b[0] + 2, b[1] + 1), k, fill=(255, 255, 0, 255))
    canvas.convert("RGB").save(path)


def save_anim_preview(sheet, fw, fh, anims, path):
    width = max(len(a["frames"]) for a in anims.values()) * fw + 110
    out = Image.new("RGBA", (width, fh * len(anims)), (60, 40, 30, 255))
    d = ImageDraw.Draw(out)
    cols = sheet.width // fw
    for r, (name, a) in enumerate(anims.items()):
        d.text((4, r * fh + fh // 2), name, fill=(255, 255, 0, 255))
        for c, i in enumerate(a["frames"]):
            box = ((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh)
            out.alpha_composite(sheet.crop(box), (110 + c * fw, r * fh))
            d.line([(110 + c * fw, r * fh + fh - 2), (110 + (c + 1) * fw, r * fh + fh - 2)], fill=(0, 255, 0, 255))
    out.convert("RGB").save(path)


def build_background():
    bg = Image.open(SRC / "background.png").convert("RGB")
    out = OUT_IMG / "izakaya-bg.webp"
    bg.save(out, "WEBP", quality=88, method=6)
    print(f"背景: {bg.size} → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")
    return {"url": "assets/izakaya-bg.webp", "width": bg.width, "height": bg.height}


def main():
    preview_dir = None
    if "--preview" in sys.argv:
        preview_dir = Path(sys.argv[sys.argv.index("--preview") + 1])
        preview_dir.mkdir(parents=True, exist_ok=True)
    spec = json.loads((ROOT / "art" / "characters.json").read_text())
    only = [a for a in sys.argv[1:] if not a.startswith("--") and a != str(preview_dir)]
    chars = [build_character(c, spec["targetHeight"], preview_dir) for c in spec["characters"] if not only or c["id"] in only]
    if only:
        return  # 一部だけ作り直したときは、対応表は書き換えない
    data = {"targetHeight": spec["targetHeight"], "background": build_background(), "characters": chars}
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"対応表 → {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
