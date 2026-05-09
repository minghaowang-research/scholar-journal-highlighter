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
  chrome.storage.local.get(["journalData"], (data) => {
    const statusEl = document.getElementById("data-status");
    if (data.journalData && data.journalData.journals) {
      const journals = data.journalData.journals;
      const updated = data.journalData.updated || "unknown";

      const utd = journals.filter((j) => j.lists.includes("utd24")).length;
      const ft = journals.filter((j) => j.lists.includes("ft50")).length;
      const sjr = journals.filter((j) => j.lists.includes("sjr")).length;

      document.getElementById("count-utd24").textContent = utd;
      document.getElementById("count-ft50").textContent = ft;
      document.getElementById("count-sjr").textContent = sjr;

      statusEl.textContent = `${journals.length} journals total | Data: ${updated}`;
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

loadPreferences();
loadStatus();
