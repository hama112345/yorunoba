import { existsSync } from "node:fs";
import path from "node:path";
import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_IZAKAYA } from "@yorunoba/shared";
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

      if (existsSync(CLIENT_DIST)) {
        app.use(express.static(CLIENT_DIST));
        // マッチメイク等のColyseusのルートより後ろで、それ以外はトップページを返す
        app.get(/^\/(?!matchmake\/).*/, (_req, res) => {
          res.sendFile(path.join(CLIENT_DIST, "index.html"));
        });
      }
    },
  });
}
