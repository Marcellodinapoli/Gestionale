const EPS = 0.75;

function makeSpacer(heightPx: number) {
  const spacer = document.createElement("div");
  spacer.setAttribute("data-a4-spacer", "1");
  spacer.style.height = `${Math.max(0, heightPx)}px`;
  spacer.style.width = "100%";
  spacer.style.flexShrink = "0";
  spacer.style.pointerEvents = "none";
  return spacer;
}

function relativeTop(el: HTMLElement, root: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return rect.top - rootRect.top + root.scrollTop;
}

function isAtom(el: HTMLElement) {
  const tag = el.tagName;
  return (
    tag === "TR" ||
    tag === "LI" ||
    tag === "P" ||
    tag === "HEADER" ||
    tag === "DL" ||
    /^H[1-6]$/.test(tag) ||
    el.classList.contains("grid")
  );
}

function collectAtoms(root: HTMLElement) {
  const atoms: HTMLElement[] = [];
  const walk = (el: HTMLElement) => {
    if (el.getAttribute("data-a4-spacer")) return;
    if (isAtom(el)) {
      atoms.push(el);
      return;
    }
    for (const child of Array.from(el.children)) {
      walk(child as HTMLElement);
    }
  };
  walk(root);
  return atoms;
}

function withPrecedingTitle(table: HTMLElement) {
  const wrap =
    table.parentElement && table.parentElement.querySelector("table") === table && table.parentElement.children.length === 1
      ? table.parentElement
      : table;
  const prev = wrap.previousElementSibling as HTMLElement | null;
  if (prev && (prev.tagName === "P" || /^H[1-6]$/.test(prev.tagName))) {
    return prev;
  }
  return wrap;
}

function insertSpacerBefore(el: HTMLElement, heightPx: number) {
  if (heightPx < 1 || !el.parentNode) return;
  el.parentNode.insertBefore(makeSpacer(heightPx), el);
}

function splitTableAtRow(tr: HTMLElement, fillPx: number) {
  const table = tr.closest("table");
  if (!table?.parentNode) return;

  const section = tr.parentElement;
  if (!section) return;

  if (section.tagName === "THEAD") {
    insertSpacerBefore(withPrecedingTitle(table), fillPx);
    return;
  }

  const firstBodyRow = table.querySelector("tbody tr");
  if (tr === firstBodyRow) {
    insertSpacerBefore(withPrecedingTitle(table), fillPx);
    return;
  }

  const nextTable = table.cloneNode(false) as HTMLTableElement;
  const thead = table.querySelector("thead");
  if (thead) nextTable.appendChild(thead.cloneNode(true));

  const nextSection = section.cloneNode(false) as HTMLElement;
  let node: ChildNode | null = tr;
  while (node) {
    const next = node.nextSibling;
    nextSection.appendChild(node);
    node = next;
  }
  nextTable.appendChild(nextSection);

  if (section.tagName === "TBODY") {
    const tfoot = table.querySelector("tfoot");
    if (tfoot) nextTable.appendChild(tfoot);
  }

  if (!section.children.length) section.remove();

  const spacer = makeSpacer(fillPx);
  table.after(spacer);
  spacer.after(nextTable);
}

function pushTarget(el: HTMLElement) {
  if (el.tagName !== "TR") return el;
  const table = el.closest("table");
  if (!table) return el;
  const firstBody = table.querySelector("tbody tr");
  if (el.closest("thead") || el === firstBody) {
    return withPrecedingTitle(table);
  }
  return el;
}

function insertBreaks(root: HTMLElement, pageHeightPx: number) {
  let guard = 0;
  while (guard++ < 400) {
    const atoms = collectAtoms(root);
    let pageStart = 0;
    let moved = false;

    for (const el of atoms) {
      const top = relativeTop(el, root);
      const height = el.getBoundingClientRect().height;
      const bottom = top + height;

      while (top >= pageStart + pageHeightPx - EPS) {
        pageStart += pageHeightPx;
      }

      const pageEnd = pageStart + pageHeightPx;
      if (bottom <= pageEnd + EPS) continue;
      if (height > pageHeightPx + EPS) continue;

      const target = pushTarget(el);
      const targetTop = relativeTop(target, root);
      const fill = pageEnd - targetTop;
      if (fill < 1) continue;

      if (target.tagName === "TR") {
        splitTableAtRow(target, fill);
      } else {
        insertSpacerBefore(target, fill);
      }
      moved = true;
      break;
    }

    if (!moved) break;
  }
}

export function paginateA4(source: HTMLElement, pageHeightPx: number) {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.position = "absolute";
  clone.style.left = "-12000px";
  clone.style.top = "0";
  clone.style.width = getComputedStyle(source).width || "210mm";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = "-1";
  document.body.appendChild(clone);

  try {
    insertBreaks(clone, pageHeightPx);
    const pageCount = Math.max(1, Math.ceil(clone.scrollHeight / pageHeightPx - 0.01));
    return { html: clone.innerHTML, pageCount };
  } finally {
    clone.remove();
  }
}
