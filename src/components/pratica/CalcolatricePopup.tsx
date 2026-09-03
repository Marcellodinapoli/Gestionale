"use client";

import { useEffect, useState } from "react";

type Op = "+" | "-" | "×" | "÷" | null;

function formatDisplay(n: number) {
  if (!Number.isFinite(n)) return "Err";
  const s = String(Math.round(n * 1e10) / 1e10);
  return s.length > 12 ? n.toPrecision(8) : s;
}

export function CalcolatricePopup() {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);

  function inputDigit(d: string) {
    setDisplay((cur) => {
      if (fresh || cur === "0") return d;
      if (cur.length >= 14) return cur;
      return cur + d;
    });
    setFresh(false);
  }

  function inputDot() {
    setDisplay((cur) => {
      if (fresh) return "0.";
      if (cur.includes(".")) return cur;
      return cur + ".";
    });
    setFresh(false);
  }

  function clearAll() {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  function backspace() {
    if (fresh) return;
    if (display.length <= 1) {
      setDisplay("0");
      setFresh(true);
      return;
    }
    setDisplay(display.slice(0, -1));
  }

  function compute(a: number, b: number, operation: NonNullable<Op>) {
    switch (operation) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
    }
  }

  function applyOp(next: Op) {
    const cur = Number(display);
    if (acc !== null && op && !fresh) {
      const r = compute(acc, cur, op);
      setAcc(r);
      setDisplay(formatDisplay(r));
    } else {
      setAcc(cur);
    }
    setOp(next);
    setFresh(true);
  }

  function equals() {
    if (acc === null || !op) return;
    const cur = Number(display);
    const r = compute(acc, cur, op);
    setDisplay(formatDisplay(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        inputDigit(key);
        return;
      }
      if (key === "," || key === ".") {
        e.preventDefault();
        inputDot();
        return;
      }
      if (key === "+") {
        e.preventDefault();
        applyOp("+");
        return;
      }
      if (key === "-") {
        e.preventDefault();
        applyOp("-");
        return;
      }
      if (key === "*" || key === "x" || key === "X") {
        e.preventDefault();
        applyOp("×");
        return;
      }
      if (key === "/") {
        e.preventDefault();
        applyOp("÷");
        return;
      }
      if (key === "Enter" || key === "=") {
        e.preventDefault();
        equals();
        return;
      }
      if (key === "Backspace") {
        e.preventDefault();
        backspace();
        return;
      }
      if (key === "c" || key === "C" || key === "Delete") {
        e.preventDefault();
        clearAll();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [display, acc, op, fresh]);


  const num =
    "flex h-11 items-center justify-center rounded-md bg-[#e8ecf0] text-base font-semibold text-[#2a2f36] shadow-sm hover:bg-[#dde3ea] active:bg-[#d0d7e0]";
  const act =
    "flex h-11 items-center justify-center rounded-md bg-[#1a3355] text-base font-semibold text-white shadow-sm hover:bg-[#152a47] active:bg-[#101f36]";
  const actActive =
    "flex h-11 items-center justify-center rounded-md bg-[#3d6fa8] text-base font-semibold text-white shadow-sm ring-2 ring-white/50";

  function opBtn(symbol: NonNullable<Op>, label?: string) {
    const active = op === symbol;
    return (
      <button
        type="button"
        className={active ? actActive : act}
        onClick={() => applyOp(symbol)}
      >
        {label ?? symbol}
      </button>
    );
  }

  const opLabel = op === "-" ? "−" : op;
  const exprLeft =
    acc !== null && op ? formatDisplay(acc).replace(".", ",") : null;

  return (
    <div className="mx-auto w-[248px] space-y-2.5 px-3 py-3">
      <div className="rounded-md bg-[#1a3355] px-3 py-2 text-right text-white">
        <div className="min-h-[1.1rem] font-mono text-xs tabular-nums tracking-wide text-white/70">
          {exprLeft != null ? (
            <>
              {exprLeft} {opLabel}
              {!fresh ? ` ${display.replace(".", ",")}` : ""}
            </>
          ) : (
            "\u00a0"
          )}
        </div>
        <div className="font-mono text-2xl tabular-nums tracking-wide">
          {display.replace(".", ",")}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={act} onClick={clearAll}>
          C
        </button>
        {opBtn("÷")}
        {opBtn("×")}
        {opBtn("-", "−")}

        <button type="button" className={num} onClick={() => inputDigit("7")}>
          7
        </button>
        <button type="button" className={num} onClick={() => inputDigit("8")}>
          8
        </button>
        <button type="button" className={num} onClick={() => inputDigit("9")}>
          9
        </button>
        <button
          type="button"
          className={`${op === "+" ? actActive : act} row-span-2 h-auto min-h-[5.75rem]`}
          onClick={() => applyOp("+")}
        >
          +
        </button>

        <button type="button" className={num} onClick={() => inputDigit("4")}>
          4
        </button>
        <button type="button" className={num} onClick={() => inputDigit("5")}>
          5
        </button>
        <button type="button" className={num} onClick={() => inputDigit("6")}>
          6
        </button>

        <button type="button" className={num} onClick={() => inputDigit("1")}>
          1
        </button>
        <button type="button" className={num} onClick={() => inputDigit("2")}>
          2
        </button>
        <button type="button" className={num} onClick={() => inputDigit("3")}>
          3
        </button>
        <button
          type="button"
          className={`${act} row-span-2 h-auto min-h-[5.75rem]`}
          onClick={equals}
        >
          =
        </button>

        <button
          type="button"
          className={`${num} col-span-2`}
          onClick={() => inputDigit("0")}
        >
          0
        </button>
        <button type="button" className={num} onClick={inputDot}>
          ,
        </button>
      </div>
    </div>
  );
}
