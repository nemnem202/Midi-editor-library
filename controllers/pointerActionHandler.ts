import type {
	FederatedPointerEvent,
	FederatedWheelEvent,
	Application,
} from "pixi.js";

export interface PointerActionEvent {
	original: FederatedPointerEvent;
	x: number;
	y: number;
	dragOrigin: { x: number; y: number };
	lastPos: { x: number; y: number };
}

export interface WheelActionEvent {
	original: FederatedWheelEvent;
	delta: number;
}

export interface PointerMoveEvent {
	original: FederatedPointerEvent;
	x: number;
	y: number;
}

export interface PointerActionHandlerOptions {
	dragThreshold?: number;
	longPressDelay?: number;
}

type DragActionCallback = (e: PointerActionEvent) => void;
type WheelActionCallback = (e: WheelActionEvent) => void;
type ClickActionCallback = (e: PointerActionEvent) => void;
type MoveActionCallback = (e: PointerMoveEvent) => void;

interface DragAction {
	onStart?: DragActionCallback;
	onMove?: DragActionCallback;
	onEnd?: DragActionCallback;
}

export interface PointerActionMap {
	onDrag?: DragAction;
	onAltDrag?: DragAction;
	onCtrlDrag?: DragAction;
	onShiftDrag?: DragAction;

	onAnyPointerEvent?: (e: FederatedPointerEvent | FederatedWheelEvent) => void;

	onPointerDown?: ClickActionCallback;
	onPointerUp?: MoveActionCallback;
	onLeftClick?: ClickActionCallback;
	onRightClick?: ClickActionCallback;
	onMiddleClick?: ClickActionCallback;
	onDoubleClick?: ClickActionCallback;
	onLongPress?: ClickActionCallback;

	onPointerMove?: MoveActionCallback;
	onPointerEnter?: MoveActionCallback;
	onPointerLeave?: MoveActionCallback;

	onWheelUp?: WheelActionCallback;
	onWheelDown?: WheelActionCallback;
	onCtrlWheelUp?: WheelActionCallback;
	onCtrlWheelDown?: WheelActionCallback;
	onShiftWheelUp?: WheelActionCallback;
	onShiftWheelDown?: WheelActionCallback;
	onAltWheelUp?: WheelActionCallback;
	onAltWheelDown?: WheelActionCallback;
}

export type PointerContextMap = {
	default: PointerActionMap;
	[context: string]: PointerActionMap;
};

export class PointerActionHandler {
	private isDragging = false;
	private dragStartX = 0;
	private dragStartY = 0;
	private lastMoveX = 0;
	private lastMoveY = 0;
	private isPointerDown = false;
	private activeDragAction: DragAction | null = null;
	private activeContext: PointerActionMap | null = null;

	private longPressTimer: ReturnType<typeof setTimeout> | null = null;
	private longPressEvent: FederatedPointerEvent | null = null;
	private longPressFired = false;

	private pendingDownEvent: FederatedPointerEvent | null = null;

	private readonly dragThreshold: number;
	private readonly longPressDelay: number;

	constructor(
		private readonly app: Application,
		private readonly contexts: PointerContextMap,
		options: PointerActionHandlerOptions = {},
	) {
		this.dragThreshold = options.dragThreshold ?? 4;
		this.longPressDelay = options.longPressDelay ?? 500;
		this.attach();
	}

	private attach(): void {
		const s = this.app.stage;
		s.on("pointerdown", this.onPointerDown);
		s.on("pointerup", this.onPointerUp);
		s.on("globalpointermove", this.onPointerMove);
		s.on("pointerup", this.onPointerUp);
		s.on("pointerupoutside", this.onPointerUp);
		s.on("dblclick", this.onDblClick);
		s.on("rightclick", this.onRightClick);
		s.on("wheel", this.onWheel);
		s.on("pointerenter", this.onPointerEnter);
		s.on("pointerleave", this.onPointerLeave);
	}

	public destroy(): void {
		const s = this.app.stage;
		s.off("pointerdown", this.onPointerDown);
		s.off("globalpointermove", this.onPointerMove);
		s.off("pointerup", this.onPointerUp);
		s.off("pointerupoutside", this.onPointerUp);
		s.off("dblclick", this.onDblClick);
		s.off("rightclick", this.onRightClick);
		s.off("wheel", this.onWheel);
		s.off("pointerenter", this.onPointerEnter);
		s.off("pointerleave", this.onPointerLeave);
		this.clearLongPressTimer();
	}

	private resolveContext(
		e: FederatedPointerEvent | FederatedWheelEvent,
	): PointerActionMap {
		const label = (e.target as any)?.label as string | undefined;
		return (label && this.contexts[label]) || this.contexts.default;
	}

	private makeDragPayload(e: FederatedPointerEvent): PointerActionEvent {
		return {
			original: e,
			x: e.globalX,
			y: e.globalY,
			dragOrigin: { x: this.dragStartX, y: this.dragStartY },
			lastPos: { x: this.lastMoveX, y: this.lastMoveY },
		};
	}

	private makeClickPayload(e: FederatedPointerEvent): PointerActionEvent {
		return {
			original: e,
			x: e.globalX,
			y: e.globalY,
			dragOrigin: { x: this.dragStartX, y: this.dragStartY },
			lastPos: { x: this.lastMoveX, y: this.lastMoveY },
		};
	}

	private resolveDragAction(e: FederatedPointerEvent): DragAction | undefined {
		if (!this.activeContext) return undefined;
		if (e.altKey) return this.activeContext.onAltDrag;
		if (e.shiftKey) return this.activeContext.onShiftDrag;
		if (e.ctrlKey || e.metaKey) return this.activeContext.onCtrlDrag;
		return this.activeContext.onDrag;
	}

	private clearLongPressTimer(): void {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
	}

	private onPointerDown = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		if (e.button === 1) {
			const ctx = this.resolveContext(e);
			ctx.onMiddleClick?.(this.makeClickPayload(e));
			return;
		}

		if (e.button !== 0) return;

		this.isPointerDown = true;
		this.isDragging = false;
		this.longPressFired = false;
		this.dragStartX = e.globalX;
		this.dragStartY = e.globalY;
		this.lastMoveX = e.globalX;
		this.lastMoveY = e.globalY;
		this.activeDragAction = null;
		this.activeContext = this.resolveContext(e);
		this.pendingDownEvent = e;

		this.activeContext.onPointerDown?.(this.makeClickPayload(e));

		if (this.activeContext.onLongPress) {
			this.longPressEvent = e;
			this.longPressTimer = setTimeout(() => {
				if (this.isPointerDown && !this.isDragging && this.longPressEvent) {
					this.longPressFired = true;
					this.activeContext!.onLongPress!(
						this.makeClickPayload(this.longPressEvent),
					);
				}
			}, this.longPressDelay);
		}
	};

	private onPointerMove = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		if (!this.isPointerDown) {
			this.resolveContext(e).onPointerMove?.({
				original: e,
				x: e.globalX,
				y: e.globalY,
			});
			return;
		}

		const dx = e.globalX - this.dragStartX;
		const dy = e.globalY - this.dragStartY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (!this.isDragging && dist < this.dragThreshold) return;

		if (!this.isDragging) {
			this.isDragging = true;
			this.clearLongPressTimer();
			this.activeDragAction = this.resolveDragAction(e) ?? null;

			if (this.pendingDownEvent && this.activeDragAction?.onStart) {
				this.activeDragAction.onStart(
					this.makeDragPayload(this.pendingDownEvent),
				);
			}
			this.pendingDownEvent = null;
		}

		this.activeDragAction?.onMove?.(this.makeDragPayload(e));

		this.lastMoveX = e.globalX;
		this.lastMoveY = e.globalY;
	};

	private onPointerUp = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		this.clearLongPressTimer();
		this.pendingDownEvent = null;

		if (this.isDragging && this.activeDragAction?.onEnd) {
			this.activeDragAction.onEnd(this.makeDragPayload(e));
		}

		if (!this.isDragging && !this.longPressFired && e.button === 0) {
			this.activeContext?.onLeftClick?.(this.makeClickPayload(e));
		}

		this.activeContext?.onPointerUp?.({
			original: e,
			x: e.globalX,
			y: e.globalY,
		});

		this.isPointerDown = false;
		this.isDragging = false;
		this.longPressFired = false;
		this.activeDragAction = null;
		this.activeContext = null;
	};

	private onDblClick = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		this.resolveContext(e).onDoubleClick?.(this.makeClickPayload(e));
	};

	private onRightClick = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		this.resolveContext(e).onRightClick?.(this.makeClickPayload(e));
	};

	private onPointerEnter = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		this.resolveContext(e).onPointerEnter?.({
			original: e,
			x: e.globalX,
			y: e.globalY,
		});
	};

	private onPointerLeave = (e: FederatedPointerEvent): void => {
		this.contexts.default.onAnyPointerEvent?.(e);
		this.resolveContext(e).onPointerLeave?.({
			original: e,
			x: e.globalX,
			y: e.globalY,
		});
	};

	private onWheel = (e: FederatedWheelEvent) => {
		this.contexts.default.onAnyPointerEvent?.(e);
		const ctx = this.resolveContext(e);
		const payload: WheelActionEvent = { original: e, delta: e.deltaY };
		const isUp = e.deltaY < 0;

		if (e.ctrlKey || e.metaKey) {
			return isUp
				? ctx.onCtrlWheelUp?.(payload)
				: ctx.onCtrlWheelDown?.(payload);
		}
		if (e.shiftKey) {
			return isUp
				? ctx.onShiftWheelUp?.(payload)
				: ctx.onShiftWheelDown?.(payload);
		}
		if (e.altKey) {
			return isUp ? ctx.onAltWheelUp?.(payload) : ctx.onAltWheelDown?.(payload);
		}

		isUp ? ctx.onWheelUp?.(payload) : ctx.onWheelDown?.(payload);
	};
}
