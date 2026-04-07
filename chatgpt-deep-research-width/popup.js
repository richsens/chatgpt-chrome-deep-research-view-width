const STORAGE_KEY = "reportWidthPreset";
const VALID_PRESETS = new Set(["default", "1.5x", "2x"]);

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("preset-form");
  const status = document.getElementById("status");
  const preset = await loadPreset();
  const input = form.querySelector(`input[value="${preset}"]`);

  if (input) {
    input.checked = true;
  }

  form.addEventListener("change", async (event) => {
    const nextPreset = event.target?.value;

    if (!VALID_PRESETS.has(nextPreset)) {
      return;
    }

    await chrome.storage.sync.set({ [STORAGE_KEY]: nextPreset });
    await applyPresetToActiveTab(nextPreset);
    await notifyActiveTab(nextPreset);
    status.textContent = `已切换到 ${labelFor(nextPreset)}`;
  });
});

async function loadPreset() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return VALID_PRESETS.has(data[STORAGE_KEY]) ? data[STORAGE_KEY] : "default";
}

async function notifyActiveTab(preset) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "chatgptdr:set-preset",
      preset
    });
  } catch {
    // Ignore pages where the content script is not available.
  }
}

async function applyPresetToActiveTab(preset) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !chrome.scripting) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      func: applyPresetInCurrentFrame,
      args: [preset]
    });
  } catch {
    // Fall back to the persistent content script path.
  }
}

function applyPresetInCurrentFrame(preset) {
  const PRESET_SCALE = {
    default: 1,
    "1.5x": 1.5,
    "2x": 2
  };
  const VIEWPORT_PADDING = 32;
  const MIN_FALLBACK_WIDTH = 768;
  const REPORT_BASE_WIDTH = 816;
  const EMBEDDED_STYLE_ID = "chatgptdr-embedded-style";
  const scale = PRESET_SCALE[preset] || 1;

  if (location.hostname.includes("oaiusercontent.com")) {
    applyEmbeddedStyle(document, scale);

    const nestedFrame = document.querySelector("iframe#root");

    if (nestedFrame?.contentDocument) {
      applyEmbeddedStyle(nestedFrame.contentDocument, scale);
    }

    return;
  }

  const iframes = Array.from(
    document.querySelectorAll('iframe[title="internal://deep-research"]')
  );

  document.querySelectorAll('[data-chatgptdr-adjusted="thread-inline"]').forEach((node) => {
    node.style.removeProperty("--thread-content-max-width");
    node.style.removeProperty("max-width");
    delete node.dataset.chatgptdrAdjusted;
  });

  document.querySelectorAll('[data-chatgptdr-adjusted="shell-inline"]').forEach((node) => {
    node.style.removeProperty("width");
    node.style.removeProperty("max-width");
    node.style.removeProperty("left");
    node.style.removeProperty("right");
    node.style.removeProperty("transform");
    delete node.dataset.chatgptdrAdjusted;
  });

  if (!iframes.length || scale === 1) {
    return;
  }

  document.querySelectorAll('[class*="thread-content-max-width"]').forEach((node) => {
    const computedMaxWidth = Number.parseFloat(
      (getComputedStyle(node).maxWidth || "").replace("px", "")
    );
    const baseWidth = computedMaxWidth || MIN_FALLBACK_WIDTH;
    const targetWidth = Math.round(baseWidth * scale);

    node.dataset.chatgptdrAdjusted = "thread-inline";
    node.style.setProperty("--thread-content-max-width", `${targetWidth}px`, "important");
    node.style.setProperty("max-width", `${targetWidth}px`, "important");
  });

  iframes.forEach((iframe) => {
    let shell = iframe.parentElement;

    while (shell && shell !== document.body && getComputedStyle(shell).position !== "fixed") {
      shell = shell.parentElement;
    }

    shell = shell || iframe.parentElement;

    if (!shell) {
      return;
    }

    const rectWidth = shell.getBoundingClientRect().width;
    const computedWidth = Number.parseFloat((getComputedStyle(shell).width || "").replace("px", ""));
    const baseWidth = rectWidth || computedWidth || MIN_FALLBACK_WIDTH;
    const nextWidth = Math.min(
      Math.round(baseWidth * scale),
      Math.max(360, window.innerWidth - VIEWPORT_PADDING)
    );

    shell.dataset.chatgptdrAdjusted = "shell-inline";
    shell.style.setProperty("width", `${nextWidth}px`, "important");
    shell.style.setProperty("max-width", `calc(100vw - ${VIEWPORT_PADDING}px)`, "important");
    shell.style.setProperty("left", "50%", "important");
    shell.style.setProperty("right", "auto", "important");
    shell.style.setProperty("transform", "translateX(-50%)", "important");

    iframe.style.setProperty("width", "100%", "important");
    iframe.style.setProperty("max-width", "100%", "important");
  });

  function applyEmbeddedStyle(targetDocument, targetScale) {
    if (!targetDocument.querySelector('[class*="_reportPage_"]')) {
      return;
    }

    targetDocument.getElementById(EMBEDDED_STYLE_ID)?.remove();

    if (targetScale === 1) {
      return;
    }

    const targetWidth = Math.min(
      Math.round(REPORT_BASE_WIDTH * targetScale),
      Math.max(360, targetDocument.defaultView.innerWidth - VIEWPORT_PADDING * 2)
    );

    const styleTag = targetDocument.createElement("style");
    styleTag.id = EMBEDDED_STYLE_ID;
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
    targetDocument.head.appendChild(styleTag);
  }
}

function labelFor(preset) {
  if (preset === "1.5x") {
    return "1.5 倍";
  }

  if (preset === "2x") {
    return "2 倍";
  }

  return "默认";
}
