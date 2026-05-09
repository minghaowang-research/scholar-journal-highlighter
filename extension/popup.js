const TOGGLE_KEYS = {
  "toggle-utd24": "showUtd24",
  "toggle-ft50": "showFt50",
  "toggle-abdc": "showAbdc",
  "toggle-sjr": "showSjr",
  "toggle-custom": "showCustom",
};

const DEFAULTS = { showUtd24: true, showFt50: true, showAbdc: true, showSjr: true, showCustom: true, displayMode: "dim" };

function loadPreferences() {
  chrome.storage.sync.get(DEFAULTS, (prefs) => {
    Object.entries(TOGGLE_KEYS).forEach(([id, key]) => {
      document.getElementById(id).checked = prefs[key];
    });

    const modeRadio = document.querySelector(
      `input[name="displayMode"][value="${prefs.displayMode}"]`
    );
    if (modeRadio) modeRadio.checked = true;
  });
}

function loadStatus() {
  chrome.storage.local.get(["journalData"], (data) => {
    const statusEl = document.getElementById("data-status");
    if (data.journalData && data.journalData.journals) {
      const journals = data.journalData.journals;
      const updated = data.journalData.updated || "unknown";

      const counts = { utd24: 0, ft50: 0, abdc: 0, sjr: 0, custom: 0 };
      for (const j of journals) {
        for (const l of j.lists) {
          if (counts[l] !== undefined) counts[l]++;
        }
      }

      for (const [key, val] of Object.entries(counts)) {
        const el = document.getElementById(`count-${key}`);
        if (el) el.textContent = val;
      }

      statusEl.textContent = `${journals.length} journals total | Data: ${updated}`;
    } else {
      statusEl.textContent = "No data loaded yet";
    }
  });
}

async function notifyTab(msgType) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url && tabs[0].url.includes("scholar.google.com")) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: msgType });
    }
  } catch (_) {}
}

function onToggleChange(e) {
  const key = TOGGLE_KEYS[e.target.id];
  if (!key) return;
  chrome.storage.sync.set({ [key]: e.target.checked }, () => notifyTab("TOGGLE_CHANGED"));
}

function onModeChange(e) {
  chrome.storage.sync.set({ displayMode: e.target.value }, () => notifyTab("MODE_CHANGED"));
}

Object.keys(TOGGLE_KEYS).forEach((id) => {
  document.getElementById(id).addEventListener("change", onToggleChange);
});

document.querySelectorAll('input[name="displayMode"]').forEach((radio) => {
  radio.addEventListener("change", onModeChange);
});

loadPreferences();
loadStatus();
