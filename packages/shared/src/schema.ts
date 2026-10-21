// Colyseusで同期する店内の状態。サーバーが書き込み、クライアントは読むだけ。
import { schema, t, type SchemaType } from "@colyseus/schema";

/** 店内にいる客1人ぶんの同期データ。発言はここに入れない（ログを残さない方針） */
export const Player = schema(
  {
    name: t.string().default(""),
    color: t.uint32().default(0),
    x: t.int16().default(0),
    y: t.int16().default(0),
    /** ひとこと札（TOPIC_TAGS の中から最大2つ、カンマ区切り） */
    tags: t.string().default(""),
    /** 座っている席のID（layout.ts の SEATS）。立っていれば "" */
    seat: t.string().default(""),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

export const IzakayaState = schema(
  {
    /** key = sessionId */
    players: t.map(Player),
  },
  "IzakayaState",
);
export type IzakayaState = SchemaType<typeof IzakayaState>;
