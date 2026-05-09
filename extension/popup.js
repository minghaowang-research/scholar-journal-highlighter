const TOGGLE_KEYS = {
  "toggle-utd24": "showUtd24",
  "toggle-ft50": "showFt50",
  "toggle-sjr": "showSjr",
};

function loadPreferences() {
  chrome.storage.sync.get(
    { showUtd24: true, showFt50: true, showSjr: true, displayMode: "dim" },
    (prefs) => {
      document.getElementById("toggle-utd24").checked = prefs.showUtd24;
      document.getElementById("toggle-ft50").checked = prefs.showFt50;
      document.getElementById("toggle-sjr").checked = prefs.showSjr;

      const modeRadio = document.querySelector(
        `input[name="displayMode"][value="${prefs.displayMode}"]`
      );
      if (modeRadio) modeRadio.checked = true;
    }
  );
}

function loadStatus() {
  chrome.storage.local.get(["journalData", "journalDataTimestamp"], (data) => {
    const statusEl = document.getElementById("data-status");
    if (data.journalData) {
      const count = data.journalData.journals.length;
      const updated = data.journalData.updated || "unknown";
      statusEl.textContent = `${count} journals | Data: ${updated}`;
    } else {
      statusEl.textContent = "No data loaded yet";
    }
  });
}

function notifyTab(msgType) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: msgType });
    }
  });
}

function onToggleChange(e) {
  const key = TOGGLE_KEYS[e.target.id];
  if (!key) return;
  chrome.storage.sync.set({ [key]: e.target.checked }, () => {
    notifyTab("TOGGLE_CHANGED");
  });
}

function onModeChange(e) {
  chrome.storage.sync.set({ displayMode: e.target.value }, () => {
    notifyTab("MODE_CHANGED");
  });
}

Object.keys(TOGGLE_KEYS).forEach((id) => {
  document.getElementById(id).addEventListener("change", onToggleChange);
});

document.querySelectorAll('input[name="displayMode"]').forEach((radio) => {
  radio.addEventListener("change", onModeChange);
});

document.getElementById("refresh-btn").addEventListener("click", () => {
  const btn = document.getElementById("refresh-btn");
  btn.textContent = "Refreshing...";
  btn.disabled = true;
  chrome.runtime.sendMessage({ type: "REFRESH_DATA" }, () => {
    btn.textContent = "Refresh Data";
    btn.disabled = false;
    loadStatus();
  });
});

loadPreferences();
loadStatus();
