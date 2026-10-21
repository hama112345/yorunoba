// 店内のざわめき・グラスの音・吹き出しの「ポン」。音の素材は使わず、ブラウザの中で合成する。
// 人が多いほど、ざわめきが大きく・グラスの音が多くなる。

const MUTE_KEY = "yorunoba:muted";

export interface Ambience {
  setGuests(count: number): void;
  pop(): void;
  toggleMute(): boolean;
  readonly muted: boolean;
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** ブラウザの決まりで、音は「タップなどの操作の直後」にしか鳴らせない。入店ボタンを押したときに呼ぶ */
export function startAmbience(): Ambience {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let muted = loadMuted();
  if (!AudioCtx) return { setGuests() {}, pop() {}, toggleMute: () => (muted = !muted), get muted() { return muted; } };

  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  // ざわめき：ノイズを人の声の高さ（300〜1000Hz）に絞り、ゆっくり大きさを揺らす
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // ブラウンノイズ寄りのやわらかい音
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 550;
  band.Q.value = 0.7;
  const murmur = ctx.createGain();
  murmur.gain.value = 0;
  noise.connect(band).connect(murmur).connect(master);
  noise.start();

  // 話し声の「波」：大きさをゆっくり揺らす
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.35;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.25;
  lfo.connect(lfoDepth).connect(murmur.gain);
  lfo.start();
  void ctx.resume();

  let guests = 1;
  let clinkTimer: number | undefined;

  const clink = () => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 2400 + Math.random() * 1600;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + 0.4);
  };

  const scheduleClink = () => {
    // 1人なら15〜30秒に1回、10人なら3〜6秒に1回くらい
    const base = 30_000 / Math.min(10, Math.max(1, guests));
    clinkTimer = window.setTimeout(() => {
      if (!muted && ctx.state === "running") clink();
      scheduleClink();
    }, base * (0.5 + Math.random()));
  };
  scheduleClink();

  const applyGuests = () => {
    // ひとりでも静かすぎないように。人が増えるほど大きく（上限あり）
    const level = 0.12 + Math.min(10, guests) * 0.035;
    murmur.gain.setTargetAtTime(level, ctx.currentTime, 1.5);
    lfoDepth.gain.setTargetAtTime(level * 0.45, ctx.currentTime, 1.5);
  };
  applyGuests();

  // タブを裏に回したら止め、戻ったら再開する（電池のため）
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });

  return {
    setGuests(count) {
      guests = count;
      applyGuests();
      window.clearTimeout(clinkTimer);
      scheduleClink();
    },
    pop() {
      if (muted) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(990, t + 0.06);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(env).connect(master);
      osc.start(t);
      osc.stop(t + 0.2);
    },
    toggleMute() {
      muted = !muted;
      master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch {
        // 保存できなくても切り替えはできる
      }
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
