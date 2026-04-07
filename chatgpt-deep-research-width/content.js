const STORAGE_KEY = "reportWidthPreset";
const PRESET_SCALE = {
  default: 1,
  "1.5x": 1.5,
  "2x": 2
};
const MIN_FALLBACK_WIDTH = 768;
const VIEWPORT_PADDING = 32;
const REPORT_BASE_WIDTH = 816;
const EMBEDDED_STYLE_ID = "chatgptdr-embedded-style";

let currentPreset = "default";
let applyScheduled = false;

init();

async function init() {
  currentPreset = await loadPreset();
  scheduleApply();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[STORAGE_KEY]) {
      return;
    }

    currentPreset = normalizePreset(changes[STORAGE_KEY].newValue);
    scheduleApply();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "chatgptdr:set-preset") {
      return;
    }

    currentPreset = normalizePreset(message.preset);
    scheduleApply();
    sendResponse({ ok: true });
  });

  const observer = new MutationObserver(() => {
    scheduleApply();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  window.addEventListener("resize", scheduleApply, { passive: true });
}

function scheduleApply() {
  if (applyScheduled) {
    return;
  }

  applyScheduled = true;
  requestAnimationFrame(() => {
    applyScheduled = false;
    applyPreset();
  });
}

function applyPreset() {
  const preset = normalizePreset(currentPreset);
  const scale = PRESET_SCALE[preset];

  if (isEmbeddedReportFrame()) {
    applyEmbeddedReportWidth(document, scale);
    return;
  }

  const nestedReportDocument = getNestedReportDocument();

  if (nestedReportDocument) {
    applyEmbeddedReportWidth(nestedReportDocument, scale);
    return;
  }

  const deepResearchIframes = getDeepResearchIframes();
  const hasDeepResearch = deepResearchIframes.length > 0;

  if (!hasDeepResearch) {
    resetAll();
    return;
  }

  applyThreadWidth(scale);
  applyReportShellWidth(deepResearchIframes, scale);
}

function isEmbeddedReportFrame() {
  return location.hostname.endsWith(".oaiusercontent.com") &&
    (
      document.querySelector('[class*="_reportPage_"]') ||
      document.querySelector('[aria-label="Report table of contents"]')
    );
}

function getNestedReportDocument() {
  if (!location.hostname.endsWith(".oaiusercontent.com")) {
    return null;
  }

  const iframe = document.querySelector("iframe#root");

  if (!iframe) {
    return null;
  }

  try {
    const nestedDocument = iframe.contentDocument;

    if (!nestedDocument?.querySelector('[class*="_reportPage_"]')) {
      return null;
    }

    return nestedDocument;
  } catch {
    return null;
  }
}

function applyEmbeddedReportWidth(targetDocument, scale) {
  const reportPage = targetDocument.querySelector('[class*="_reportPage_"]');

  if (!reportPage) {
    resetEmbeddedReportWidth(targetDocument);
    return;
  }

  const viewportBoundWidth = Math.max(
    360,
    targetDocument.defaultView.innerWidth - VIEWPORT_PADDING * 2
  );
  const targetWidth = Math.min(Math.round(REPORT_BASE_WIDTH * scale), viewportBoundWidth);

  if (scale === 1) {
    resetEmbeddedReportWidth(targetDocument);
    return;
  }

  ensureEmbeddedStyle(targetDocument, targetWidth);
}

function ensureEmbeddedStyle(targetDocument, targetWidth) {
  let styleTag = targetDocument.getElementById(EMBEDDED_STYLE_ID);

  if (!styleTag) {
    styleTag = targetDocument.createElement("style");
    styleTag.id = EMBEDDED_STYLE_ID;
    targetDocument.head.appendChild(styleTag);
  }

  styleTag.textContent = `
    [class*="_reportPage_"] {
      width: ${targetWidth}px !important;
      max-width: ${targetWidth}px !important;
      flex-basis: ${targetWidth}px !important;
      flex-grow: 0 !important;
      flex-shrink: 0 !important;
    }

    div[style*="width: 816px"]:has([class*="_reportPage_"]),
    div[style*="width:816px"]:has([class*="_reportPage_"]) {
      width: ${targetWidth}px !important;
      max-width: ${targetWidth}px !important;
    }

    div[style*="max-width: 816"]:has([class*="_reportPage_"]),
    div[style*="max-width:816"]:has([class*="_reportPage_"]) {
      max-width: ${targetWidth}px !important;
    }
  `;
}

function resetEmbeddedReportWidth(targetDocument) {
  targetDocument.getElementById(EMBEDDED_STYLE_ID)?.remove();
}

function applyThreadWidth(scale) {
  const elements = document.querySelectorAll('[class*="thread-content-max-width"]');

  elements.forEach((element) => {
    const baseWidth = getBaseWidth(element, "chatgptdrBaseThreadWidth");

    if (scale === 1) {
      clearThreadWidth(element);
      return;
    }

    const targetWidth = Math.round(baseWidth * scale);
    element.dataset.chatgptdrAdjusted = "thread";
    element.style.setProperty("--thread-content-max-width", `${targetWidth}px`, "important");
    element.style.setProperty("max-width", `${targetWidth}px`, "important");
  });
}

function applyReportShellWidth(iframes, scale) {
  const activeShells = new Set();

  iframes.forEach((iframe) => {
    const shell = findFixedShell(iframe);

    if (!shell) {
      return;
    }

    activeShells.add(shell);

    if (scale === 1) {
      clearShellWidth(shell, iframe);
      return;
    }

    const baseWidth = getShellBaseWidth(shell);
    const scaledWidth = Math.round(baseWidth * scale);
    const viewportBoundWidth = Math.max(360, window.innerWidth - VIEWPORT_PADDING);
    const nextWidth = Math.min(scaledWidth, viewportBoundWidth);

    shell.dataset.chatgptdrAdjusted = "shell";
    shell.style.setProperty("width", `${nextWidth}px`, "important");
    shell.style.setProperty("max-width", `calc(100vw - ${VIEWPORT_PADDING}px)`, "important");
    shell.style.setProperty("left", "50%", "important");
    shell.style.setProperty("right", "auto", "important");
    shell.style.setProperty("transform", "translateX(-50%)", "important");

    iframe.style.setProperty("width", "100%", "important");
    iframe.style.setProperty("max-width", "100%", "important");
  });

  document.querySelectorAll('[data-chatgptdr-adjusted="shell"]').forEach((shell) => {
    if (activeShells.has(shell)) {
      return;
    }

    const iframe = shell.querySelector('iframe[title="internal://deep-research"]');
    clearShellWidth(shell, iframe);
  });
}

function resetAll() {
  document.querySelectorAll('[data-chatgptdr-adjusted="thread"]').forEach(clearThreadWidth);
  document.querySelectorAll('[data-chatgptdr-adjusted="shell"]').forEach((shell) => {
    const iframe = shell.querySelector('iframe[title="internal://deep-research"]');
    clearShellWidth(shell, iframe);
  });
}

function clearThreadWidth(element) {
  element.style.removeProperty("--thread-content-max-width");
  element.style.removeProperty("max-width");
  delete element.dataset.chatgptdrAdjusted;
}

function clearShellWidth(shell, iframe) {
  shell.style.removeProperty("width");
  shell.style.removeProperty("max-width");
  shell.style.removeProperty("left");
  shell.style.removeProperty("right");
  shell.style.removeProperty("transform");
  delete shell.dataset.chatgptdrAdjusted;

  if (!iframe) {
    return;
  }

  iframe.style.removeProperty("width");
  iframe.style.removeProperty("max-width");
}

function getDeepResearchIframes() {
  return Array.from(
    document.querySelectorAll('iframe[title="internal://deep-research"]')
  );
}

function getBaseWidth(element, datasetKey) {
  const existing = Number.parseFloat(element.dataset[datasetKey] || "");

  if (Number.isFinite(existing) && existing > 0) {
    return existing;
  }

  const computedMaxWidth = pxValue(getComputedStyle(element).maxWidth);
  const fallback = computedMaxWidth || MIN_FALLBACK_WIDTH;

  element.dataset[datasetKey] = String(fallback);
  return fallback;
}

function getShellBaseWidth(shell) {
  const existing = Number.parseFloat(shell.dataset.chatgptdrBaseShellWidth || "");

  if (Number.isFinite(existing) && existing > 0) {
    return existing;
  }

  const rectWidth = shell.getBoundingClientRect().width;
  const computedWidth = pxValue(getComputedStyle(shell).width);
  const fallback = rectWidth || computedWidth || MIN_FALLBACK_WIDTH;

  shell.dataset.chatgptdrBaseShellWidth = String(fallback);
  return fallback;
}

function findFixedShell(iframe) {
  let element = iframe.parentElement;

  while (element && element !== document.body) {
    const style = getComputedStyle(element);

    if (style.position === "fixed") {
      return element;
    }

    element = element.parentElement;
  }

  return iframe.parentElement;
}

function pxValue(value) {
  if (!value || value === "none") {
    return 0;
  }

  const match = value.match(/([\d.]+)px/);
  return match ? Number.parseFloat(match[1]) : 0;
}

function normalizePreset(value) {
  return Object.hasOwn(PRESET_SCALE, value) ? value : "default";
}

async function loadPreset() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return normalizePreset(data[STORAGE_KEY]);
}
