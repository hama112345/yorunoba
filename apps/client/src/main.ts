import {
  EVT,
  MSG,
  type AnnounceEvent,
  type ChatEvent,
  type JailedEvent,
  type NoticeEvent,
  type TopicEvent,
  type WipeEvent,
} from "@yorunoba/shared";
import Phaser from "phaser";
import { campaignProps, initAnalytics, track } from "./analytics";
import { startAmbience } from "./audio/ambience";
import { DPR } from "./display";
import { fetchStatus, joinIzakaya, loadProfile, saveProfile, staffToken } from "./net/connection";
import { BootScene } from "./scenes/BootScene";
import { IzakayaScene } from "./scenes/IzakayaScene";
import { showChatBar } from "./ui/chatBar";
import { showCheckout } from "./ui/checkout";
import { showEntrance } from "./ui/entrance";
import { showFirstVisitHint } from "./ui/firstVisit";
import { showGuestCard } from "./ui/guestCard";
import { showGoodbye } from "./ui/goodbye";
import { showError, showReconnecting, showWaiting } from "./ui/hud";
import { invite } from "./ui/invite";
import { showJail } from "./ui/jail";
import { createKanpaiDetector } from "./ui/kanpai";
import { showRegularsPass } from "./ui/regularsPass";
import { showTopicsCard } from "./ui/topics";

declare global {
  interface Window {
    /** E2Eテスト用の窓口。本番でも害はないので常に出しておく */
    __yorunoba?: {
      sessionId: string;
      avatars: () => { id: string; x: number; y: number; tags: string[]; seat: string; look: string }[];
      /** 見た乾杯の数 */
      toasts: () => number;
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
  // 画面の上に重ねたボタン（会話欄・反応の選択肢・常連パスなど）を押したとき、その下の店まで押されないようにする。
  // 既定ではPhaserがウィンドウ全体のタップも拾うため、「わかる」を押すと下の吹き出しが押し直されて反応が届かないことがあった
  input: { windowEvents: false },
  scene: [BootScene, IzakayaScene],
});

window.addEventListener("resize", () => game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR));

const sceneReady = new Promise<IzakayaScene>((resolve) => game.events.once("izakaya-ready", resolve));
// 店の様子（人数・営業時間・キープボトル）。入店画面と、酒棚の名札に使う
const shopStatus = fetchStatus();
let bottles: string[] = [];
void Promise.all([sceneReady, shopStatus]).then(([scene, status]) => {
  bottles = status?.bottles ?? [];
  scene.showBottles(bottles);
});

showWaiting();
showEntrance(
  loadProfile(),
  shopStatus,
  async (profile) => {
    // 音は「入店ボタンを押した瞬間」に用意しないと鳴らせない（ブラウザの決まり）ので、通信より先に作る
    const ambience = startAmbience();
    const room = await joinIzakaya(profile);
    saveProfile(profile);
    const scene = await sceneReady;
    // 計測：入店した時点の店内人数（自分を含む）。最初の人数が届いたときに一度だけ送る
    game.events.once("guests", (count: number) => track("room_joined", { guests: count, tags: profile.tags.length, look: profile.look }));
    scene.enterRoom(room);
    const joinedAt = Date.now();

    // 退店で滞在時間を送る。一度だけ。via：お会計で出た（checkout）／タブを閉じた（close）／接続が切れた（lost）
    let left = false;
    const sendLeft = (beacon: boolean, via: "checkout" | "close" | "lost") => {
      if (left) return;
      left = true;
      track("room_left", { seconds: Math.round((Date.now() - joinedAt) / 1000), via }, beacon);
    };
    let checkedOut = false;
    // タブを閉じたときは、本人が出たことにする（接続が切れただけの人として30秒残らないように）
    window.addEventListener("pagehide", (e) => {
      sendLeft(true, "close");
      if (!e.persisted) void room.leave();
    });

    // 画面下の会話欄。発言はサーバーを通して全員の吹き出しになる
    let chats = 0;
    const chat = showChatBar(
      (text) => {
        room.send(MSG.chat, { text });
        chats += 1;
        // 計測は文字数だけ（本文は送らない）
        track("chat_sent", { length: [...text].length, nth: chats });
      },
      () => {
        room.send(MSG.toast);
        track("toast_sent");
      },
    );
    showFirstVisitHint();
    room.onMessage(EVT.chat, (e: ChatEvent) => {
      const speaker = room.state.players.get(e.from);
      const name = speaker ? (speaker.ai ? `🤖${speaker.name}` : speaker.name) : "だれか";
      chat.addLine(name, e.text, e.from === room.sessionId, e.id);
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
    room.onMessage(EVT.wipe, (e: WipeEvent) => chat.wipe(e.bubbleId));
    room.onMessage(EVT.topic, (e: TopicEvent) => chat.topic(e.text));

    // 🍻 乾杯：グラスの音。8秒以内に2人以上なら「かんぱーい！」
    const kanpai = createKanpaiDetector();
    game.events.on("toast", (from: string) => {
      ambience.toast();
      kanpai(from);
    });
    // 来店・お帰りを会話欄に（あいさつのきっかけ。保存はしない）
    game.events.on("guest-arrived", (name: string, tags: string[]) => {
      const tagText = tags.length ? `（${tags.map((t) => `#${t}`).join(" ")}）` : "";
      chat.system(`🏮 ${name}さん${tagText}が来店`);
    });
    game.events.on("guest-left", (name: string) => chat.system(`${name}さんがお帰りになりました`));
    // 掲示板 → 今日のお題。選んだお題は会話欄に入る
    game.events.on("board-tap", () => {
      track("topic_viewed");
      showTopicsCard((topic) => chat.fill(topic));
    });

    // 右上の「常連パス（準備中）」と「誘う」
    const actions = document.getElementById("actions")!;
    actions.hidden = false;
    document.getElementById("pass")!.addEventListener("click", () => showRegularsPass(bottles));
    document.getElementById("invite")!.addEventListener("click", () => void invite((t) => chat.notice(t)));
    // お会計：「また来たい？」を1問だけ聞いて店を出る
    document.getElementById("checkout-button")!.addEventListener("click", () =>
      showCheckout(() => {
        checkedOut = true;
        sendLeft(false, "checkout");
        void room.leave();
      }),
    );

    // ほかの客をタップ → 名札カード（困ったときは通報）
    game.events.on("guest-tap", (sessionId: string) => {
      const guest = room.state.players.get(sessionId);
      if (!guest) return;
      const viewerIsStaff = room.state.players.get(room.sessionId)?.staff ?? false;
      showGuestCard(
        { name: guest.name, tags: guest.tags ? guest.tags.split(",") : [], staff: guest.staff, ai: guest.ai },
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

    // 電波が途切れた・アプリを切り替えたなどで接続が切れたら、自動でつなぎ直す（サーバーは30秒まで席を残す）
    room.reconnection.maxRetries = 12;
    room.onDrop(() => {
      showReconnecting();
      chat.notice("📶 接続が切れました。つなぎ直しています…");
    });
    room.onReconnect(() => {
      scene.refreshGuests();
      chat.notice("📶 つながりました");
    });
    // 戻れなかった（お店の開け直しなど）ときは「もう一度入る」を出す
    room.onLeave(() => {
      sendLeft(false, "lost");
      // 店を出たら、店の中の操作（右上のボタン・会話欄・案内）は片付ける
      actions.hidden = true;
      document.getElementById("chat")?.setAttribute("hidden", "");
      document.getElementById("first-visit")?.remove();
      if (jailed) return;
      showError("店を出ました");
      showGoodbye(checkedOut ? "checkout" : "lost");
    });
    window.__yorunoba = {
      sessionId: room.sessionId,
      avatars: () => scene.snapshot(),
      toasts: () => scene.toastCount(),
      bubbles: () => scene.bubbleSnapshot(),
      seats: () => scene.seatSnapshot(),
      isSelfOnScreen: () => scene.isSelfOnScreen(),
      worldToScreen: (x, y) => scene.worldToScreen(x, y),
    };
  },
);
