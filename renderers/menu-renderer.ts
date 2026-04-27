import { Container, type FederatedPointerEvent, Graphics, Text, TextStyle } from "pixi.js";
import Renderer, { type RendererDeps } from "./renderer";

export interface MenuRendererDeps extends RendererDeps {}

interface MenuItem {
  label: string;
  action: () => void;
}

export default class MenuRenderer extends Renderer<MenuRendererDeps> {
  private readonly MENU_WIDTH = 150;
  private readonly ITEM_HEIGHT = 30;
  private menuItems: MenuItem[] = [
    {
      label: "Automatic generation",
      action: () => {
        console.log("auto");
      },
    },
    {
      label: "Humanize",
      action: () => {
        console.log("humanize");
      },
    },
    {
      label: "Quantize",
      action: () => {
        console.log("quantize");
      },
    },
    {
      label: "Add chord",
      action: () => {
        console.log("add chord");
      },
    },
  ];
  constructor(deps: MenuRendererDeps) {
    super(deps);
    const { app } = this.deps;
    const { x, y, width, height } = app.screen;

    this.container = new Container({ label: "Menu", x, y, width, height });
  }

  drawMenu(e: FederatedPointerEvent) {
    this.clearMenu();
    const { app } = this.deps;
    const { width, height } = app.screen;
    this.container = new Container({
      label: "Menu",
      x: app.screen.x,
      y: app.screen.y,
      width,
      height,
    });
    let x = Math.round(e.globalX);
    let y = Math.round(e.globalY);

    const bg = new Graphics({ label: "Menu background" });
    const totalHeight = this.menuItems.length * this.ITEM_HEIGHT;

    bg.rect(0, 0, this.MENU_WIDTH, totalHeight)
      .fill({ color: "#2c2c2c", alpha: 0.95 })
      .stroke({ color: "#444444", width: 1 });

    this.container.addChild(bg);

    this.menuItems.forEach((item, index) => {
      const itemContainer = this.createMenuItem(item, index);
      this.container!.addChild(itemContainer);
    });

    const screen = this.deps.app.screen;
    if (x + this.MENU_WIDTH > screen.width) x -= this.MENU_WIDTH;
    if (y + totalHeight > screen.height) y -= totalHeight;

    this.container.position.set(x, y);

    this.deps.app.stage.addChild(this.container);

    this.deps.app.stage.once("pointerdown", () => this.clearMenu());
  }

  private createMenuItem(item: MenuItem, index: number): Container {
    const container = new Container({ label: "Menu item" });
    container.y = index * this.ITEM_HEIGHT;
    container.eventMode = "static";
    container.cursor = "pointer";

    const hoverBg = new Graphics({ label: "Menu item background" })
      .rect(0, 0, this.MENU_WIDTH, this.ITEM_HEIGHT)
      .fill({ color: "#444444", alpha: 0 });

    const label = new Text({
      text: item.label,
      style: new TextStyle({
        fill: "#ffffff",
        fontSize: 12,
        fontFamily: "Arial",
      }),
    });
    label.position.set(10, Math.round((this.ITEM_HEIGHT - label.height) / 2));

    container.addChild(hoverBg, label);

    container.on("pointerover", () =>
      hoverBg.clear().rect(0, 0, this.MENU_WIDTH, this.ITEM_HEIGHT).fill("#555555"),
    );
    container.on("pointerout", () =>
      hoverBg
        .clear()
        .rect(0, 0, this.MENU_WIDTH, this.ITEM_HEIGHT)
        .fill({ color: "#444444", alpha: 0 }),
    );
    container.on("pointerdown", (e) => {
      e.stopPropagation();
      item.action();
      this.clearMenu();
    });

    return container;
  }

  clearMenu() {
    if (this.container) {
      this.deps.app.stage.removeChild(this.container);
      this.container.destroy({ children: true });
    }
  }
}
