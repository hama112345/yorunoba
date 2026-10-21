import {
  EVT,
  MSG,
  type AnnounceEvent,
  type ChatEvent,
  type JailedEvent,
  type NoticeEvent,
} from "@yorunoba/shared";
import Phaser from "phaser";
import { campaignProps, initAnalytics, track } from "./analytics";
import { startAmbience } from "./audio/ambience";
import { DPR } from "./display";
import { fetchStatus, joinIzakaya, loadProfile, saveProfile, staffToken } from "./net/connection";
import { BootScene } from "./scenes/BootScene";
import { IzakayaScene } from "./scenes/IzakayaScene";
import { showChatBar } from "./ui/chatBar";
import { showEntrance } from "./ui/entrance";
import { showGuestCard } from "./ui/guestCard";
import { showError, showWaiting } from "./ui/hud";
import { invite } from "./ui/invite";
import { showJail } from "./ui/jail";
import { showRegularsPass } from "./ui/regularsPass";

declare global {
  interface Window {
    /** E2Eテスト用の窓口。本番でも害はないので常に出しておく */
    __yorunoba?: {
      sessionId: string;
      avatars: () => { id: string; x: number; y: number; tags: string[]; seat: string }[];
      bubbles: () => { id: number; text: string; x: number; y: number; alpha: number; reactions: Record<string, number> }[];
      seats: () => { id: string; x: number; y: number; free: boolean; onScreen: boolean }[];
      isSelfOnScreen: () => boolean;
      worldToScreen: (x: number, y: number) => { x: number; y: number };
    };
  }
}

// 店主の合言葉（URLの #staff=…）は、計測を始める前に読み取ってURLから消す
staffToken();
initAnalytics();
track("page_view", campaignProps());

// 店は入店前から描いておき、のれん（入店画面）越しに見せる
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1a1220",
  // 画面の細かさ（DPR）倍の大きさで描いて、1/DPR に縮めて表示する（文字がにじまないように）
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth * DPR, height: window.innerHeight * DPR, zoom: 1 / DPR },
  // 低スペック端末でコマ落ちしても歩く速さが変わらないよう、実時間のdeltaを使う。
  // 会話が主役で激しい動きはないので30fpsに抑え、スマホの電池と発熱を減らす（長居する前提のため）
  fps: { smoothStep: false, limit: 30 },
  scene: [BootScene, IzakayaScene],
});

window.addEventListener("resize", () => game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR));

const sceneReady = new Promise<IzakayaScene>((resolve) => game.events.once("izakaya-ready", resolve));

showWaiting();
showEntrance(
  loadProfile(),
  fetchStatus(),
  async (profile) => {
    // 音は「入店ボタンを押した瞬間」に用意しないと鳴らせない（ブラウザの決まり）ので、通信より先に作る
    const ambience = startAmbience();
    const room = await joinIzakaya(profile);
    saveProfile(profile);
    const scene = await sceneReady;
    // 計測：入店した時点の店内人数（自分を含む）。最初の人数が届いたときに一度だけ送る
    game.events.once("guests", (count: number) => track("room_joined", { guests: count, tags: profile.tags.length }));
    scene.enterRoom(room);
    const joinedAt = Date.now();

    // 退店（タブを閉じる・切断）で滞在時間を送る。一度だけ
    let left = false;
    const sendLeft = (beacon: boolean) => {
      if (left) return;
      left = true;
      track("room_left", { seconds: Math.round((Date.now() - joinedAt) / 1000) }, beacon);
    };
    window.addEventListener("pagehide", () => sendLeft(true));

    // 画面下の会話欄。発言はサーバーを通して全員の吹き出しになる
    let chats = 0;
    const chat = showChatBar((text) => {
      room.send(MSG.chat, { text });
      chats += 1;
      // 計測は文字数だけ（本文は送らない）
      track("chat_sent", { length: [...text].length, nth: chats });
    });
    room.onMessage(EVT.chat, (e: ChatEvent) => {
      const name = room.state.players.get(e.from)?.name ?? "だれか";
      chat.addLine(name, e.text, e.from === room.sessionId);
      if (e.from !== room.sessionId) ambience.pop();
    });

    // 店内の音：人数でざわめきが変わる。右上のボタンで消音
    game.events.on("guests", (count: number) => ambience.setGuests(count));
    const soundButton = document.getElementById("sound") as HTMLButtonElement;
    const renderSound = () => (soundButton.textContent = ambience.muted ? "🔇" : "🔊");
    soundButton.hidden = false;
    renderSound();
    soundButton.addEventListener("click", () => {
      ambience.toggleMute();
      renderSound();
    });
    room.onMessage(EVT.notice, (e: NoticeEvent) => chat.notice(e.text));
    room.onMessage(EVT.announce, (e: AnnounceEvent) => chat.announce(e.text));

    // 右上の「常連パス（準備中）」と「誘う」
    const actions = document.getElementById("actions")!;
    actions.hidden = false;
    document.getElementById("pass")!.addEventListener("click", () => showRegularsPass());
    document.getElementById("invite")!.addEventListener("click", () => void invite((t) => chat.notice(t)));

    // ほかの客をタップ → 名札カード（困ったときは通報）
    game.events.on("guest-tap", (sessionId: string) => {
      const guest = room.state.players.get(sessionId);
      if (!guest) return;
      const viewerIsStaff = room.state.players.get(room.sessionId)?.staff ?? false;
      showGuestCard(
        { name: guest.name, tags: guest.tags ? guest.tags.split(",") : [], staff: guest.staff },
        viewerIsStaff,
        () => {
          room.send(MSG.report, { target: sessionId });
          track("report_sent", { by_staff: viewerIsStaff });
        },
      );
    });

    let jailed = false;
    room.onMessage(EVT.jailed, (e: JailedEvent) => {
      jailed = true;
      showJail(e.until, e.reason);
    });

    room.onLeave(() => {
      sendLeft(false);
      if (!jailed) showError("お店から出ました。再読み込みで再入店できます");
    });
    window.__yorunoba = {
      sessionId: room.sessionId,
      avatars: () => scene.snapshot(),
      bubbles: () => scene.bubbleSnapshot(),
      seats: () => scene.seatSnapshot(),
      isSelfOnScreen: () => scene.isSelfOnScreen(),
      worldToScreen: (x, y) => scene.worldToScreen(x, y),
    };
  },
);
