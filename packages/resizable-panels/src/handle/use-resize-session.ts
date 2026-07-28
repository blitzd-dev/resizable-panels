"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  acquirePointerLease,
  releasePointerLease,
} from "../shared/document-lease.js";

type ResizeSessionHandlers<Session> = {
  cursor?: string;
  globalCursor?: boolean;
  onStart: (event: PointerEvent, owner: object) => Session | null;
  onMove: (session: Session, event: PointerEvent) => void;
  /** `canceled` is false only for a normal pointer release; cancel, lost
   * capture, blur, unmount, and exception endings report true. */
  onEnd: (session: Session, canceled: boolean, event?: PointerEvent) => void;
};

/** Pointer-capture interaction session shared by all resize handles.
 * Supports mouse, touch, and pen; coalesces moves to one callback per frame;
 * and restores the exact body styles that existed before the interaction. */
export function useResizeSession<Session>(
  handlers: ResizeSessionHandlers<Session>,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const activeSessionRef = useRef<{
    owner: object;
    session: Session;
    element: HTMLElement;
    /** The element's document at session start. Body-style mutation, the
     * pointer lease, and the restore all target this document so sessions
     * inside iframes never touch the top document's body. */
    document: Document;
    pointerId: number;
    previousBodyStyle: { cursor: string; userSelect: string };
    finishing: boolean;
  } | null>(null);
  const pendingEventRef = useRef<PointerEvent | null>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(false);
  const [active, setActive] = useState(false);

  const finish = useCallback(
    (
      owner: object,
      event?: PointerEvent,
      flushPending = true,
      canceled = true,
    ) => {
      const activeSession = activeSessionRef.current;
      if (
        !activeSession ||
        activeSession.owner !== owner ||
        activeSession.finishing
      ) {
        return;
      }
      activeSession.finishing = true;
      if (event) pendingEventRef.current = event;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;

      let failure: unknown;
      if (flushPending) {
        const pending = pendingEventRef.current;
        pendingEventRef.current = null;
        if (pending) {
          try {
            handlersRef.current.onMove(activeSession.session, pending);
          } catch (error) {
            failure = error;
          }
        }
      } else {
        pendingEventRef.current = null;
      }

      // Clear ownership before invoking completion. Re-entrant or stale
      // pointer events are no-ops even if consumer callbacks throw.
      activeSessionRef.current = null;
      try {
        // An exception from the final move flush also cancels the session.
        handlersRef.current.onEnd(
          activeSession.session,
          canceled || failure !== undefined,
          event,
        );
      } catch (error) {
        failure ??= error;
      } finally {
        const sessionBody = activeSession.document.body;
        if (sessionBody) {
          sessionBody.style.cursor = activeSession.previousBodyStyle.cursor;
          sessionBody.style.userSelect =
            activeSession.previousBodyStyle.userSelect;
        }
        releasePointerLease(activeSession.document, activeSession.owner);
        try {
          if (
            activeSession.element.hasPointerCapture(activeSession.pointerId)
          ) {
            activeSession.element.releasePointerCapture(
              activeSession.pointerId,
            );
          }
        } catch {
          // The element may have unmounted or the browser may already have
          // released capture for pointerup/cancel.
        }
        if (mountedRef.current) setActive(false);
      }

      if (failure !== undefined) throw failure;
    },
    [],
  );

  const flushMove = useCallback(() => {
    rafRef.current = 0;
    const activeSession = activeSessionRef.current;
    const event = pendingEventRef.current;
    pendingEventRef.current = null;
    if (!activeSession || !event) return;
    try {
      handlersRef.current.onMove(activeSession.session, event);
    } catch (error) {
      finish(activeSession.owner, undefined, false);
      throw error;
    }
  }, [finish]);

  useEffect(() => {
    if (!active) return;
    const onBlur = () => {
      const current = activeSessionRef.current;
      if (current) finish(current.owner);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [active, finish]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const current = activeSessionRef.current;
      if (current) finish(current.owner);
    };
  }, [finish]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (activeSessionRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const owner = {};
      const element = event.currentTarget;
      const ownerDocument = element.ownerDocument;
      // The document-wide lease must precede everything else: it is what
      // keeps a session in another provider (implicit or explicit) from
      // interleaving its body-style save/restore with ours (§14).
      if (!acquirePointerLease(ownerDocument, owner)) return;
      let session: Session | null = null;
      try {
        session = handlersRef.current.onStart(event.nativeEvent, owner);
      } finally {
        if (!session) releasePointerLease(ownerDocument, owner);
      }
      if (!session) return;

      // Canceling the armed press's default action keeps the gesture from
      // anchoring a text selection or starting a native drag under the
      // element, and suppresses the touch compatibility mouse events. It
      // ALSO suppresses the browser's native click-gives-focus (R-27) —
      // this hook stays focus-agnostic, so a consumer whose element is a
      // focusable control must restore focus itself when `onStart` arms a
      // session (PanelResizeHandle focuses the separator in its onStart).
      event.preventDefault();
      const body = ownerDocument.body;
      const previousBodyStyle = {
        cursor: body.style.cursor,
        userSelect: body.style.userSelect,
      };
      activeSessionRef.current = {
        owner,
        session,
        element,
        document: ownerDocument,
        pointerId: event.pointerId,
        previousBodyStyle,
        finishing: false,
      };
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic test events do not represent an active browser pointer.
        // Real mouse/touch/pen pointers still use capture normally.
      }

      try {
        if (handlersRef.current.globalCursor && handlersRef.current.cursor) {
          body.style.cursor = handlersRef.current.cursor;
        }
        body.style.userSelect = "none";
        setActive(true);
      } catch (error) {
        finish(owner, undefined, false);
        throw error;
      }
    },
    [finish],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = activeSessionRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      pendingEventRef.current = event.nativeEvent;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flushMove);
    },
    [flushMove],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = activeSessionRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finish(current.owner, event.nativeEvent, true, false);
    },
    [finish],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = activeSessionRef.current;
      if (current && event.pointerId === current.pointerId) {
        finish(current.owner, event.nativeEvent);
      }
    },
    [finish],
  );

  const onLostPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = activeSessionRef.current;
      if (current && event.pointerId === current.pointerId) {
        finish(current.owner, event.nativeEvent);
      }
    },
    [finish],
  );

  return {
    active,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };
}
