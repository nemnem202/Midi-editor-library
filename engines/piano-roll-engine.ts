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
import { logger } from "../lib/logger";
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

export type Strategy = "Player" | "Midi";

export abstract class PianoRollEngine {
  protected app = new Application();
  protected actionsDirtyFlags = new Set<Action>();
  protected eventsDirtyFlags = new Set<Event>();
  protected hasInitialized = false;

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

  protected soundEngine!: SoundEngine;

  constructor(
    protected root_div: HTMLDivElement,
    public strategy: Strategy
  ) {
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

  public async init() {
    try {
      await this.app.init({
        backgroundAlpha: 1,
        resizeTo: this.root_div,
        antialias: false,
        backgroundColor: "#000000",
        preference: "webgl",
      });

      if (this.root_div) {
        this.root_div.appendChild(this.app.canvas);
      }

      this.soundEngine = SoundEngine.get();

      this.app.stage.eventMode = "static";
      this.app.stage.hitArea = this.app.screen;

      this.initRenderers();
      this.app.stage.addChild(this.layoutRenderer.container);

      this.hasInitialized = true;
      this.drawAll();

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
    this.pianoKeyboardRenderer.draw();
    logger.info("Draw all", Date.now() - now);
  }

  protected onTickUpdate() {
    if (!this.hasInitialized || !this.app.renderer) return;

    if (this.state.config.isPlaying && this.soundEngine) {
      try {
        const currentTick = this.soundEngine.currentTicks;
        this.onSoundEngineTickUpdate(currentTick);
      } catch (e) {
        // Le SoundEngine n'est peut-être pas encore prêt
      }
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

  protected abstract onSoundEngineTickUpdate(tick: number): void;

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
      this.soundEngine.updateMidiEvents();
    }
    if ([...actions].some((a) => a === Action.CHANGE_CURRENT_TRACK)) {
      this.grayedNotesRenderer.draw();
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
    }

    if (actions.has(Action.TOGGLE_PLAY)) {
      if (!this.state.config.isPlaying) {
        this.playheadRenderer.hidePlayhead();
      }
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
  }

  protected handleResize() {
    logger.info("Resize");
    this.backgroundRenderer.draw();
    this.gridRenderer.draw();
  }

  protected abstract attachListeners(): void;

  // public destroy(): void {
  //   this.hasInitialized = false;

  //   // --- AJUSTEMENT ICI ---
  //   // SURTOUT PAS : this.soundEngine.pause();
  //   // On veut que le son continue si on change juste de Tab (Chords/PianoRoll)
  //   // ----------------------

  //   this.pointerHandler?.destroy();

  //   if (this.app) {
  //     this.app.ticker.stop();

  //     if (this.app.canvas?.parentNode) {
  //       this.app.canvas.remove();
  //     }

  //     this.app.destroy(true, {
  //       children: true,
  //       texture: true,
  //     });
  //   }

  //   logger.info("Renderer Engine destroyed (but Sound continues)");
  // }

  public destroy(): void {
    this.hasInitialized = false;

    this.pointerHandler?.destroy();

    // On vérifie si app existe ET si le renderer n'est pas déjà détruit
    if (this.app?.renderer) {
      try {
        // Utilisation du chaînage optionnel ?. pour le ticker
        this.app.ticker?.stop();

        if (this.app.canvas?.parentNode) {
          this.app.canvas.remove();
        }

        // On entoure le destroy d'un try/catch car Pixi peut être capricieux
        // si on le détruit deux fois de suite
        this.app.destroy(true, {
          children: true,
          texture: true,
        });
      } catch (error) {
        console.warn("Pixi destruction warning:", error);
      }
    }

    logger.info("Renderer Engine destroyed (but Sound continues)");
  }
}

export class PlayerEngine extends PianoRollEngine {
  constructor(root_div: HTMLDivElement) {
    super(root_div, "Player");
  }

  protected override attachListeners(): void {
    this.app.renderer.on("resize", (width, height) => {
      if (this.lastRenderWidth < width || this.lastRenderHeight < height) {
        this.lastRenderWidth = width;
        this.lastRenderHeight = height;
        this.handleResize();
      }
    });

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

  protected onSoundEngineTickUpdate(tick: number): void {
    this.playheadRenderer.updatePlayhead(tick);
    this.gridRenderer.draw();
  }
}

export class EditorEngine extends PianoRollEngine {
  constructor(root_div: HTMLDivElement) {
    super(root_div, "Midi");
  }

  protected override attachListeners(): void {
    this.app.renderer.on("resize", (width, height) => {
      if (this.lastRenderWidth < width || this.lastRenderHeight < height) {
        this.lastRenderWidth = width;
        this.lastRenderHeight = height;
        this.handleResize();
      }
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

  protected onSoundEngineTickUpdate(tick: number): void {
    this.playheadRenderer.updatePlayhead(tick);
  }
}
