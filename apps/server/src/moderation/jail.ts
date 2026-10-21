// 留置所（一定時間の入店禁止）と通報の記録。どちらもメモリ上だけで持ち、再起動で消える。

/** 端末IDやIPをキーに、「いつまで入店禁止か」を覚えておく */
export class JailList {
  private until = new Map<string, number>();

  jail(keys: (string | undefined)[], ms: number, now = Date.now()) {
    for (const key of keys) if (key) this.until.set(key, now + ms);
    return now + ms;
  }

  /** まだ入店禁止なら、戻れる時刻を返す。禁止でなければ 0 */
  releaseAt(keys: (string | undefined)[], now = Date.now()): number {
    let latest = 0;
    for (const key of keys) {
      if (!key) continue;
      const t = this.until.get(key) ?? 0;
      if (t <= now) this.until.delete(key);
      else latest = Math.max(latest, t);
    }
    return latest;
  }
}

/** 通報の記録。同じ人の通報は1回と数え、古いものは数えない */
export class ReportBook {
  private reports = new Map<string, Map<string, number>>(); // 通報された人 → (通報した人 → 時刻)

  constructor(private readonly windowMs: number) {}

  /** 通報を記録し、期間内に通報した「別々の人」の数を返す */
  add(target: string, reporter: string, now = Date.now()): number {
    const byReporter = this.reports.get(target) ?? new Map<string, number>();
    byReporter.set(reporter, now);
    for (const [who, at] of byReporter) if (now - at > this.windowMs) byReporter.delete(who);
    this.reports.set(target, byReporter);
    return byReporter.size;
  }

  forget(target: string) {
    this.reports.delete(target);
  }
}

/** 店全体（全部屋）で共有する入店禁止リスト */
export const jailList = new JailList();
