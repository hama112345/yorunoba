import Phaser from "phaser";

const WALK_SPEED = 170; // px/秒

/** 客のアバター。サーバーの座標を目標に、歩いて追いかける */
export class Avatar extends Phaser.GameObjects.Container {
  private target: Phaser.Math.Vector2;
  private body_: Phaser.GameObjects.Ellipse;
  private bob = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, color: number, isSelf: boolean) {
    super(scene, x, y);
    this.target = new Phaser.Math.Vector2(x, y);

    const shadow = scene.add.ellipse(0, 14, 30, 10, 0x000000, 0.3);
    this.body_ = scene.add.ellipse(0, 0, 30, 34, color).setStrokeStyle(2, 0x1a1220, 0.9);
    const eyes = [
      scene.add.circle(-6, -4, 2.6, 0x1a1220),
      scene.add.circle(6, -4, 2.6, 0x1a1220),
    ];
    const cheeks = [
      scene.add.circle(-10, 3, 3.2, 0xff8fa3, 0.55),
      scene.add.circle(10, 3, 3.2, 0xff8fa3, 0.55),
    ];
    const label = scene.add
      .text(0, -32, name, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: isSelf ? "#ffd27a" : "#f6eadb",
        stroke: "#1a1220",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);

    this.add([shadow, this.body_, ...cheeks, ...eyes, label]);
    if (isSelf) {
      this.add(scene.add.triangle(0, -50, 0, 0, 10, 0, 5, 7, 0xffd27a).setOrigin(0.5));
    }
    this.setDepth(y);
    scene.add.existing(this);
  }

  walkTo(x: number, y: number) {
    this.target.set(x, y);
  }

  step(deltaMs: number) {
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const maxStep = (WALK_SPEED * deltaMs) / 1000;

    if (dist <= maxStep) {
      this.setPosition(this.target.x, this.target.y);
      this.bob = 0;
    } else {
      this.setPosition(this.x + (dx / dist) * maxStep, this.y + (dy / dist) * maxStep);
      this.bob += deltaMs / 90;
    }
    this.body_.setScale(1, 1 - Math.abs(Math.sin(this.bob)) * 0.06);
    this.setDepth(this.y);
  }
}
