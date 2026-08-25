"use client";

import { useState } from "react";

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

  const btn =
    "h-9 rounded text-sm font-semibold border border-[var(--line)] bg-[#f0f4f8] text-[var(--navy)] hover:bg-white";
  const btnOp =
    "h-9 rounded text-sm font-semibold bg-[#1a4f7a] text-white hover:bg-[#163f61]";

  return (
    <div className="mx-auto w-[220px] space-y-2 px-3 py-3">
      <div className="rounded border border-[var(--line)] bg-[#132033] px-3 py-2 text-right font-mono text-xl tabular-nums text-white">
        {display.replace(".", ",")}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" className={btnOp} onClick={clearAll}>
          C
        </button>
        <button type="button" className={btnOp} onClick={() => applyOp("÷")}>
          ÷
        </button>
        <button type="button" className={btnOp} onClick={() => applyOp("×")}>
          ×
        </button>
        <button type="button" className={btnOp} onClick={() => applyOp("-")}>
          −
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("7")}>
          7
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("8")}>
          8
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("9")}>
          9
        </button>
        <button type="button" className={btnOp} onClick={() => applyOp("+")}>
          +
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("4")}>
          4
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("5")}>
          5
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("6")}>
          6
        </button>
        <button type="button" className={`${btnOp} row-span-2 h-auto`} onClick={equals}>
          =
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("1")}>
          1
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("2")}>
          2
        </button>
        <button type="button" className={btn} onClick={() => inputDigit("3")}>
          3
        </button>
        <button type="button" className={`${btn} col-span-2`} onClick={() => inputDigit("0")}>
          0
        </button>
        <button type="button" className={btn} onClick={inputDot}>
          ,
        </button>
      </div>
    </div>
  );
}
