import Phaser from "phaser";
import { CHARACTERS, registerCharacterAnims, textureKey } from "../art/characters";
import { ASSETS } from "../assets";

/** 背景とキャラの絵を読み込んでから、店のシーンを始める */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    for (const asset of Object.values(ASSETS)) {
      if (asset.url) this.load.image(asset.key, asset.url);
    }
    for (const c of CHARACTERS) {
      this.load.spritesheet(textureKey(c.id), c.url, { frameWidth: c.frameWidth, frameHeight: c.frameHeight });
    }
    // 絵が1枚読めなくても店は開ける（そのキャラは丸いアバター、背景は仮の絵になる）
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`絵を読み込めませんでした: ${file.src}`);
    });
  }

  create() {
    registerCharacterAnims(this);
    this.scene.start("izakaya");
  }
}
