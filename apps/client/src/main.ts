import { FLOOR } from "@yorunoba/shared";
import Phaser from "phaser";
import { joinIzakaya, loadProfile } from "./net/connection";
import { IzakayaScene } from "./scenes/IzakayaScene";
import { showConnecting, showError } from "./ui/hud";

declare global {
  interface Window {
    /** E2Eテスト用の窓口。本番でも害はないので常に出しておく */
    __yorunoba?: { sessionId: string; avatars: () => { id: string; x: number; y: number }[] };
  }
}

async function main() {
  showConnecting();
  let room;
  try {
    room = await joinIzakaya(loadProfile());
  } catch (err) {
    console.error(err);
    showError("お店につながりませんでした。時間をおいて再読み込みしてください");
    return;
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: FLOOR.width,
    height: FLOOR.height,
    backgroundColor: "#1a1220",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // 低スペック端末でコマ落ちしても歩く速さが変わらないよう、実時間のdeltaを使う
    fps: { smoothStep: false },
    scene: [],
  });
  game.scene.add("izakaya", IzakayaScene, true, { room });

  room.onLeave(() => showError("お店から出ました。再読み込みで再入店できます"));

  window.__yorunoba = {
    sessionId: room.sessionId,
    avatars: () => (game.scene.getScene("izakaya") as IzakayaScene | null)?.snapshot() ?? [],
  };
}

main();
