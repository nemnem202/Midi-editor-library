import { Application } from "pixi.js";
import type GridRenderer from "../renderers/grid-renderer";
import { EditorGridRenderer, PlayerGridRenderer } from "../renderers/grid-renderer";
import LayoutRenderer from "../renderers/layout-renderer";
import LoopRenderer from "../renderers/loop-renderer";
import type NotesRenderer from "../renderers/notes-renderer";
import { EditorNotesRenderer, PlayerNotesRenderer } from "../renderers/notes-renderer";
import type PianoKeyboardRenderer from "../renderers/piano-keyboard-renderer";
import {
  HorizontalPianoKeyboardRenderer,
  VerticalPianoKeyboardRenderer,
} from "../renderers/piano-keyboard-renderer";
import SelectionRenderer from "../renderers/selection-renderer";
import type PlayheadRenderer from "../renderers/playhead-renderer";
import { EditorPlayheadRenderer, PlayerTacklistRenderer } from "../renderers/playhead-renderer";
import type ViewportRenderer from "../renderers/viewport-renderer";
import { EditorViewportRenderer, PlayerViewportRenderer } from "../renderers/viewport-renderer";
import type { State } from "../types/instance";
import type backgroundRenderer from "../renderers/background-renderer";
import {
  EditorBackgroundRenderer,
  PlayerBackgroundRenderer,
} from "../renderers/background-renderer";
import {
  GRID_ACTIONS,
  LAYOUT_ACTIONS,
  LOOP_ACTIONS,
  MIDI_EVENT_CHANGE_ACTIONS,
  NOTE_ACTIONS,
  PIANO_KEYBOARD_ACTIONS,
} from "../lib/action-map";
import MenuRenderer from "../renderers/menu-renderer";
import { PointerActionHandler } from "../controllers/pointerActionHandler";
import { Action } from "../types/actions";
import { useMidiStore } from "../stores/use-midi-store";
import { Event } from "../types/events";
import CursorRenderer from "../renderers/cursor-renderer";
import SoundEngine from "./sound-engine";
import type GrayedNotesRenderer from "../renderers/grayed-notes-renderer";
import {
  EditorGrayedNotesRenderer,
  PlayerGrayedNotesRenderer,
} from "../renderers/grayed-notes-renderer";
import { logger } from "../lib/logger";
import type { PianoRollConfig } from "../types/general";
import { convertSecondsToTick } from "../lib/utils";

export type Strategy = "Player" | "Midi";

export abstract class PianoRollEngine {
  protected app = new Application();
  protected root_div: HTMLDivElement;
  protected actionsDirtyFlags = new Set<Action>();
  protected eventsDirtyFlags = new Set<Event>();
  protected hasInitialized = false;
  private _isDestroyed = false;
  private _resizeObserver!: ResizeObserver;
  protected pointerHandler!: PointerActionHandler;
  protected gridRenderer!: GridRenderer;
  protected backgroundRenderer!: backgroundRenderer;
  protected notesRenderer!: NotesRenderer;
  protected grayedNotesRenderer!: GrayedNotesRenderer;
  protected playheadRenderer!: PlayheadRenderer;
  protected selectionRenderer!: SelectionRenderer;
  protected loopRenderer!: LoopRenderer;
  protected viewportRenderer!: ViewportRenderer;
  protected layoutRenderer!: LayoutRenderer;
  protected pianoKeyboardRenderer!: PianoKeyboardRenderer;
  protected menuRenderer!: MenuRenderer;
  protected cursorRenderer!: CursorRenderer;

  protected lastRenderWidth = 0;
  protected lastRenderHeight = 0;

  public state: State;

  protected soundEngine: SoundEngine | null = null;

  public pianoKeyboardSize: number;

  public colors: PianoRollConfig["colors"];

  public strategy: Strategy;

  protected isMobile: boolean;

  constructor({ ...props }: PianoRollConfig) {
    this.root_div = props.root_div;
    this.pianoKeyboardSize = props.pianoKeyboardSize;
    this.colors = props.colors;
    this.strategy = props.strategy;
    this.isMobile = props.isMobile;
    this.state = useMidiStore.getState().state;

    useMidiStore.subscribe((store) => {
      this.state = store.state;

      if (this.state.queuedActions.size > 0) {
        this.state.queuedActions.forEach((a) => {
          this.actionsDirtyFlags.add(a);
        });
      }
    });
  }

  get _viewport(): ViewportRenderer {
    return this.viewportRenderer;
  }

  public markEventDirtyFlag(event: Event) {
    this.eventsDirtyFlags.add(event);
  }

  public setIsMobile(isMobile: boolean) {
    if (isMobile !== this.isMobile) {
      this.isMobile = isMobile;
      this.setupResizeLogic();
      this.attachListeners();
      this.viewportRenderer.findOptimizedZoom();
      logger.info(`Switching roll engine to: ${isMobile ? "Mobile" : "Desktop"}`);
    }
  }

  public async init() {
    logger.warn("Player initialisation");
    try {
      this._isDestroyed = false;
      await this.app.init({
        backgroundAlpha: 1,
        resizeTo: this.root_div,
        antialias: false,
        backgroundColor: "#000000",
        preference: "webgl",
      });

      // @ts-expect-error
      globalThis.__PIXI_APP__ = this.app;

      if (this._isDestroyed) {
        this.app.destroy(true, { children: true, texture: true });
        return;
      }

      if (this.root_div && this.app.canvas) {
        this.root_div.appendChild(this.app.canvas);
      } else {
        return;
      }

      try {
        this.soundEngine = SoundEngine.get();
      } catch (e) {
        logger.info("PianoRoll: SoundEngine wait for user interaction.");
      }

      this.app.stage.eventMode = "static";
      this.app.stage.hitArea = this.app.screen;

      this.initRenderers();
      this.app.stage.addChild(this.layoutRenderer.container);

      this.hasInitialized = true;

      if (this.isMobile) {
        this.drawAll();
      } else {
        this._resizeObserver = new ResizeObserver((entries) => {
          logger.info("Resize observer triggerred");
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              this.app.renderer.resize(width, height);
            }
          }
        });
        this._resizeObserver.observe(this.root_div);
        this.viewportRenderer.findOptimizedZoom();
      }

      this.app.ticker.add(() => this.onTickUpdate());
      this.attachListeners();
    } catch (error) {
      console.error("PIXI Init Error:", error);
    }
  }

  get _hasInitialized(): boolean {
    return this.hasInitialized;
  }

  protected abstract initRenderers(): void;

  protected drawAll() {
    const now = Date.now();
    this.gridRenderer.draw();
    this.backgroundRenderer.draw();
    this.notesRenderer.draw();
    this.grayedNotesRenderer.draw();
    this.playheadRenderer.drawTracklist();
    this.loopRenderer.draw();
    this.viewportRenderer.draw();
    if (this.isMobile) this.viewportRenderer.findOptimizedZoom();
    this.pianoKeyboardRenderer.draw();
    logger.draw("All", Date.now() - now);
  }

  protected onTickUpdate() {
    if (!this.hasInitialized || !this.app.renderer) return;

    if (SoundEngine.get()?.isPlaying) {
      this.onSoundEngineTickUpdate();
    }

    if (this.eventsDirtyFlags.size > 0) {
      this.processEvents();
      this.eventsDirtyFlags.clear();
    }

    if (this.actionsDirtyFlags.size > 0) {
      this.processActions();
      this.actionsDirtyFlags.clear();
    }
  }

  protected abstract onSoundEngineTickUpdate(): void;

  protected processActions() {
    const actions = this.actionsDirtyFlags;
    if (this.actionsDirtyFlags.has(Action.RENDER_ALL)) {
      this.drawAll();
      return;
    }

    if ([...actions].some((a) => NOTE_ACTIONS.includes(a))) {
      this.notesRenderer.draw();
    }
    if ([...actions].some((a) => MIDI_EVENT_CHANGE_ACTIONS.includes(a))) {
      this.soundEngine?.updateMidiEvents();
    }
    if ([...actions].some((a) => a === Action.CHANGE_CURRENT_TRACK)) {
      this.grayedNotesRenderer.draw();
      this.pianoKeyboardRenderer.draw();
    }
    if ([...actions].some((a) => GRID_ACTIONS.includes(a))) {
      this.gridRenderer.draw();
    }
    if ([...actions].some((a) => LAYOUT_ACTIONS.includes(a))) {
      this.viewportRenderer.draw();
    }
    if ([...actions].some((a) => LOOP_ACTIONS.includes(a))) {
      this.loopRenderer.draw();
    }
    if ([...actions].some((a) => PIANO_KEYBOARD_ACTIONS.includes(a))) {
      this.pianoKeyboardRenderer.draw();
    }

    if (actions.has(Action.SET_TRANSPORT_START)) {
      const { start } = this.state.transport;

      this.playheadRenderer.drawTracklist();
      this.pianoKeyboardRenderer.draw();
    }

    if (actions.has(Action.TOGGLE_PLAY)) {
      if (!SoundEngine.get()?.isPlaying) {
        this.onSoundEngineTickUpdate();
        this.playheadRenderer.hidePlayhead();
      }
    }

    if (actions.has(Action.STOP)) {
      this.onSoundEngineTickUpdate();
    }
  }

  protected processEvents() {
    if (this.eventsDirtyFlags.has(Event.Selection)) {
      this.selectionRenderer.draw();
    }
    if (this.eventsDirtyFlags.has(Event.Viewport)) {
      this.viewportRenderer.draw();
    }
    if (this.eventsDirtyFlags.has(Event.NotesDrag)) {
      this.notesRenderer.updateDrag();
    }
    if (this.eventsDirtyFlags.has(Event.Cursor)) {
      this.cursorRenderer.draw();
    }
    if (this.eventsDirtyFlags.has(Event.Resize)) {
      this.handleResize();
    }
  }

  protected handleResize() {
    if (!this.hasInitialized) return;
    this.viewportRenderer.draw();
    logger.info("Resize");
    this.drawAll();
  }

  protected abstract attachListeners(): void;

  public destroy(): void {
    this._isDestroyed = true;
    this.hasInitialized = false;

    if (typeof window !== "undefined") {
      try {
        this.pointerHandler?.destroy();
      } catch (e) {
        console.warn("PointerHandler destruction error", e);
      }
    }

    try {
      this.app?.ticker?.stop();
    } catch (e) {}

    const renderer = this.app?.renderer;

    if (renderer) {
      const canvas = this.app.canvas;
      if (canvas?.parentNode) {
        try {
          this._resizeObserver.disconnect();
          canvas.parentNode.removeChild(canvas);
        } catch (error) {
          logger.warn("Could not remove canvas from DOM", error);
        }
      }

      try {
        this.app.destroy(true, {
          children: true,
          texture: true,
        });
      } catch (error) {
        logger.warn("Pixi app.destroy error:", error);
      }
    } else {
      try {
        this.app?.destroy(false);
      } catch (e) {}
    }

    logger.info("Renderer Engine destroyed (but Sound continues)");
  }

  private setupResizeLogic() {
    this.cleanupResizeLogic();

    if (this.isMobile) {
      this.drawAll();
    } else {
      this._resizeObserver = new ResizeObserver((entries) => {
        logger.info("Resize observer triggered");
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.app.renderer.resize(width, height);
          }
        }
      });
      this._resizeObserver.observe(this.root_div);
    }
  }

  private cleanupResizeLogic() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null!;
    }
  }
}

export class PlayerEngine extends PianoRollEngine {
  constructor({ ...props }: Omit<PianoRollConfig, "strategy">) {
    super({ ...props, strategy: "Player" });
  }

  protected override attachListeners(): void {
    this.app.renderer.off("resize");

    if (this.pointerHandler) {
      this.pointerHandler.destroy();
    }

    this.app.renderer.on("resize", () => {
      this.eventsDirtyFlags.add(Event.Resize);
    });

    if (!this.isMobile) {
      this.pointerHandler = new PointerActionHandler(
        this.app,

        {
          default: {
            onAnyPointerEvent: () => this.cursorRenderer.setCursor("default"),
            onAltDrag: {
              onStart: () => this.cursorRenderer.setCursor("grabbing").lock("drag"),
              onMove: (e) => this.viewportRenderer.tryPan(e.original, e.lastPos),
              onEnd: (_e) => {
                document.body.style.cursor = "default";
              },
            },
            onLeftClick: (e) => {
              this.selectionRenderer.unselectAll();
              this.notesRenderer.addNote(e.original);
              this.playheadRenderer.setStart(e.original);
            },
            onRightClick: (e) => {
              this.menuRenderer.drawMenu(e.original);
            },

            onWheelUp: (e) => {
              this.viewportRenderer.handleZoom(e.original);
            },
            onWheelDown: (e) => {
              this.viewportRenderer.handleZoom(e.original);
            },
            onCtrlWheelUp: (e) => {
              this.viewportRenderer.handleZoom(e.original);
            },
            onCtrlWheelDown: (e) => {
              this.viewportRenderer.handleZoom(e.original);
            },
          },

          Note: {},

          Keyboard: {},
        },
        { dragThreshold: 10 }
      );
    }
  }

  protected initRenderers(): void {
    this.backgroundRenderer = new PlayerBackgroundRenderer({
      app: this.app,
      engine: this,
    });

    this.loopRenderer = new LoopRenderer({ app: this.app, engine: this });
    this.pianoKeyboardRenderer = new HorizontalPianoKeyboardRenderer({
      app: this.app,
      engine: this,
    });

    this.gridRenderer = new PlayerGridRenderer({
      app: this.app,
      engine: this,
      state: this.state,
    });

    this.viewportRenderer = new PlayerViewportRenderer({
      app: this.app,
      pianoKeyboardRenderer: this.pianoKeyboardRenderer,
      backgroundRenderer: this.backgroundRenderer,
      notesRenderer: this.notesRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
      gridRenderer: this.gridRenderer,
      state: this.state,
    });

    this.notesRenderer = new PlayerNotesRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
    });

    this.grayedNotesRenderer = new PlayerGrayedNotesRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
    });

    this.playheadRenderer = new PlayerTacklistRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
    });
    this.selectionRenderer = new SelectionRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
    });
    this.menuRenderer = new MenuRenderer({ app: this.app, engine: this });
    this.layoutRenderer = new LayoutRenderer({
      app: this.app,
      gridRenderer: this.gridRenderer,
      backgroundRenderer: this.backgroundRenderer,
      notesRenderer: this.notesRenderer,
      grayedNotesRenderer: this.grayedNotesRenderer,
      playheadRenderer: this.playheadRenderer,
      selectionRenderer: this.selectionRenderer,
      loopRenderer: this.loopRenderer,
      viewportRenderer: this.viewportRenderer,
      pianoKeyboardRenderer: this.pianoKeyboardRenderer,
      menuRenderer: this.menuRenderer,
      engine: this,
    });
    this.cursorRenderer = new CursorRenderer({ app: this.app, engine: this });
  }

  protected onSoundEngineTickUpdate() {
    if (!this.soundEngine) this.soundEngine = SoundEngine.get();
    if (!this.soundEngine) return logger.error("no sound engine");
    const { currentTime, currentTempo, notesOn, notesOff } = this.soundEngine;

    const { config, currentTrackId, tracks } = this.state;
    const currentTick = convertSecondsToTick(currentTime, currentTempo, config.ppq);

    this.playheadRenderer.updatePlayhead(currentTick);

    const notesOnCurrentTrack = Array.from(notesOn).filter(
      (note) => note.channel === tracks[currentTrackId].channel
    );
    const notesOffCurrentTrack = Array.from(notesOff).filter(
      (note) => note.channel === tracks[currentTrackId].channel
    );

    this.pianoKeyboardRenderer.colorNotes(notesOnCurrentTrack, notesOffCurrentTrack);
    this.soundEngine.clearNotesOn();
    this.soundEngine.clearNotesOff();
  }
}

export class EditorEngine extends PianoRollEngine {
  constructor({ ...props }: Omit<PianoRollConfig, "strategy">) {
    super({ ...props, strategy: "Midi" });
  }

  protected override attachListeners(): void {
    this.app.renderer.on("resize", (width, height) => {
      this.handleResize();
    });

    this.pointerHandler = new PointerActionHandler(
      this.app,

      {
        default: {
          onAnyPointerEvent: () => this.cursorRenderer.setCursor("default"),
          onDrag: {
            onStart: () => this.cursorRenderer.setCursor("grabbing").lock("drag"),
            onMove: (e) => {
              this.selectionRenderer.handleDrag(e.original, e.dragOrigin);
            },
            onEnd: (e) => {
              this.selectionRenderer.handleDragEnd(e.original, e.dragOrigin);
              this.cursorRenderer.unlock("drag");
            },
          },
          onAltDrag: {
            onStart: () => this.cursorRenderer.setCursor("grabbing").lock("drag"),
            onMove: (e) => this.viewportRenderer.tryPan(e.original, e.lastPos),
            onEnd: (_e) => {
              document.body.style.cursor = "default";
            },
          },
          onLeftClick: (e) => {
            this.selectionRenderer.unselectAll();
            this.notesRenderer.addNote(e.original);
            this.playheadRenderer.setStart(e.original);
          },
          onRightClick: (e) => {
            this.menuRenderer.drawMenu(e.original);
          },

          onWheelUp: (e) => {
            this.viewportRenderer.handleZoom(e.original);
          },
          onWheelDown: (e) => {
            this.viewportRenderer.handleZoom(e.original);
          },
          onCtrlWheelUp: (e) => {
            this.viewportRenderer.handleZoom(e.original);
          },
          onCtrlWheelDown: (e) => {
            this.viewportRenderer.handleZoom(e.original);
          },
        },

        Note: {
          onPointerDown: (e) => {
            this.cursorRenderer.setCursor("grabbing").lock("note");
            this.notesRenderer.startNoteDrag(e.original);
          },
          onDrag: {
            onMove: (e) => this.notesRenderer.handleNoteDrag(e.original),
            onEnd: () => {
              this.notesRenderer.endNoteDrag();
              this.cursorRenderer.unlock("note");
            },
          },

          onPointerUp: () => this.cursorRenderer.unlock("note"),

          onDoubleClick: (e) => this.notesRenderer.deleteNote(e.original),

          onPointerMove: () => this.cursorRenderer.setCursor("move"),

          onWheelUp: () => this.cursorRenderer.setCursor("n-resize"),
          onWheelDown: () => this.cursorRenderer.setCursor("s-resize"),
        },

        Keyboard: {},
      },
      { dragThreshold: 10 }
    );
  }

  protected initRenderers(): void {
    this.backgroundRenderer = new EditorBackgroundRenderer({
      app: this.app,
      engine: this,
    });

    this.loopRenderer = new LoopRenderer({ app: this.app, engine: this });
    this.pianoKeyboardRenderer = new VerticalPianoKeyboardRenderer({
      app: this.app,
      engine: this,
    });

    this.gridRenderer = new EditorGridRenderer({
      app: this.app,
      engine: this,
      state: this.state,
    });

    this.viewportRenderer = new EditorViewportRenderer({
      app: this.app,
      pianoKeyboardRenderer: this.pianoKeyboardRenderer,
      backgroundRenderer: this.backgroundRenderer,
      notesRenderer: this.notesRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
      gridRenderer: this.gridRenderer,
      state: this.state,
    });

    this.notesRenderer = new EditorNotesRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
    });

    this.grayedNotesRenderer = new EditorGrayedNotesRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
    });

    this.playheadRenderer = new EditorPlayheadRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
    });
    this.selectionRenderer = new SelectionRenderer({
      app: this.app,
      viewportRenderer: this.viewportRenderer,
      engine: this,
      eventsDirtyFlags: this.eventsDirtyFlags,
    });
    this.menuRenderer = new MenuRenderer({ app: this.app, engine: this });
    this.layoutRenderer = new LayoutRenderer({
      app: this.app,
      gridRenderer: this.gridRenderer,
      backgroundRenderer: this.backgroundRenderer,
      notesRenderer: this.notesRenderer,
      grayedNotesRenderer: this.grayedNotesRenderer,
      playheadRenderer: this.playheadRenderer,
      selectionRenderer: this.selectionRenderer,
      loopRenderer: this.loopRenderer,
      viewportRenderer: this.viewportRenderer,
      pianoKeyboardRenderer: this.pianoKeyboardRenderer,
      menuRenderer: this.menuRenderer,
      engine: this,
    });
    this.cursorRenderer = new CursorRenderer({ app: this.app, engine: this });
  }

  protected onSoundEngineTickUpdate(): void {
    // this.playheadRenderer.updatePlayhead(tick);
  }
}
