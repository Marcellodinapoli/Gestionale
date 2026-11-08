"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DragOffset = { x: number; y: number };

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDragOffset({ x: 0, y: 0 });
      dragRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function endDrag() {
      dragRef.current = null;
    }
    function onPointerMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      setDragOffset({
        x: d.originX + (e.clientX - d.startX),
        y: d.originY + (e.clientY - d.startY),
      });
    }
    function onPointerUp(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      endDrag();
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [open]);

  function onTitlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,a,input,select,textarea,label")) {
      return;
    }
    e.preventDefault();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-lg"
        }`}
        style={{
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 cursor-grab items-center justify-between gap-3 border-b border-[var(--line)] bg-[#dce4ec] px-4 py-2.5 active:cursor-grabbing select-none touch-none"
          onPointerDown={onTitlePointerDown}
          title="Trascina per spostare"
        >
          <h2 className="text-sm font-bold text-[var(--navy)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border border-[var(--line)] bg-white p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
            title="Chiudi (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
