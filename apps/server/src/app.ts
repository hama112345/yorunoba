import { existsSync } from "node:fs";
import path from "node:path";
import { defineRoom, defineServer, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_IZAKAYA, type ShopStatus } from "@yorunoba/shared";
import express from "express";
import { IzakayaRoom } from "./rooms/IzakayaRoom.js";

/** ビルド済みクライアント（apps/client/dist）。本番ではこのサーバーが配信する */
const CLIENT_DIST = path.resolve(import.meta.dirname, "../../client/dist");

export function createServer() {
  return defineServer({
    greet: false,
    transport: new WebSocketTransport(),
    rooms: {
      [ROOM_IZAKAYA]: defineRoom(IzakayaRoom),
    },
    express: (app) => {
      app.get("/healthz", (_req, res) => {
        res.json({ ok: true });
      });

      // 入店画面の「いま○人が飲んでる」用。人数だけを返す（名前などは出さない）
      app.get("/api/status", async (_req, res) => {
        res.set("Access-Control-Allow-Origin", "*"); // 開発中は画面(5173)とサーバー(2567)のポートが違うため
        const rooms = await matchMaker.query({ name: ROOM_IZAKAYA });
        const status: ShopStatus = { guests: rooms.reduce((sum, room) => sum + room.clients, 0) };
        res.json(status);
      });

      if (existsSync(CLIENT_DIST)) {
        app.use(express.static(CLIENT_DIST));
        // マッチメイク等のColyseusのルートより後ろで、それ以外はトップページを返す
        app.get(/^\/(?!matchmake\/|api\/).*/, (_req, res) => {
          res.sendFile(path.join(CLIENT_DIST, "index.html"));
        });
      }
    },
  });
}
