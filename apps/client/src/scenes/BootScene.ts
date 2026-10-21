import Phaser from "phaser";
import { ASSETS } from "../assets";

/** 登録済みの絵を読み込んでから、店のシーンを始める */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    for (const asset of Object.values(ASSETS)) {
      if (asset.url) this.load.image(asset.key, asset.url);
    }
  }

  create() {
    this.scene.start("izakaya");
  }
}
