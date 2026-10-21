import Phaser from "phaser";
import { fetchStatus, joinIzakaya, loadProfile, saveProfile } from "./net/connection";
import { BootScene } from "./scenes/BootScene";
import { IzakayaScene } from "./scenes/IzakayaScene";
import { showEntrance } from "./ui/entrance";
import { showError, showWaiting } from "./ui/hud";

declare global {
  interface Window {
    /** E2Eテスト用の窓口。本番でも害はないので常に出しておく */
    __yorunoba?: {
      sessionId: string;
      avatars: () => { id: string; x: number; y: number; tags: string[] }[];
      isSelfOnScreen: () => boolean;
      worldToScreen: (x: number, y: number) => { x: number; y: number };
    };
  }
}

// 店は入店前から描いておき、のれん（入店画面）越しに見せる
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1a1220",
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  // 低スペック端末でコマ落ちしても歩く速さが変わらないよう、実時間のdeltaを使う。
  // 会話が主役で激しい動きはないので30fpsに抑え、スマホの電池と発熱を減らす（長居する前提のため）
  fps: { smoothStep: false, limit: 30 },
  scene: [BootScene, IzakayaScene],
});

const sceneReady = new Promise<IzakayaScene>((resolve) => game.events.once("izakaya-ready", resolve));

showWaiting();
showEntrance(
  loadProfile(),
  fetchStatus().then((s) => s?.guests ?? null),
  async (profile) => {
    const room = await joinIzakaya(profile);
    saveProfile(profile);
    const scene = await sceneReady;
    scene.enterRoom(room);

    room.onLeave(() => showError("お店から出ました。再読み込みで再入店できます"));
    window.__yorunoba = {
      sessionId: room.sessionId,
      avatars: () => scene.snapshot(),
      isSelfOnScreen: () => scene.isSelfOnScreen(),
      worldToScreen: (x, y) => scene.worldToScreen(x, y),
    };
  },
);
