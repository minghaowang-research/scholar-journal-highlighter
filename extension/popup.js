const TOGGLE_KEYS = {
  "toggle-utd24": "showUtd24",
  "toggle-ft50": "showFt50",
  "toggle-abdc": "showAbdc",
  "toggle-custom": "showCustom",
};

const DEFAULTS = {
  showUtd24: true, showFt50: true, showAbdc: true, showCustom: true,
  displayMode: "dim", customJournals: [],
};

function loadPreferences() {
  chrome.storage.sync.get(DEFAULTS, (prefs) => {
    try {
      Object.entries(TOGGLE_KEYS).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.checked = prefs[key];
      });
      const modeRadio = document.querySelector(
        `input[name="displayMode"][value="${prefs.displayMode}"]`
      );
      if (modeRadio) modeRadio.checked = true;
      renderCustomList(prefs.customJournals || []);
    } catch (_) {}
  });
}

function loadStatus() {
  chrome.storage.local.get(["journalData"], (data) => {
    try {
      const statusEl = document.getElementById("data-status");
      if (!statusEl) return;
      if (data.journalData && data.journalData.journals) {
        const journals = data.journalData.journals;
        const updated = data.journalData.updated || "unknown";

        const counts = { utd24: 0, ft50: 0, abdc: 0, custom: 0 };
        for (const j of journals) {
          if (!j.lists) continue;
          for (const l of j.lists) {
            if (counts[l] !== undefined) counts[l]++;
          }
        }

        chrome.storage.sync.get({ customJournals: [] }, (prefs) => {
          try {
            counts.custom += (prefs.customJournals || []).length;

            for (const [key, val] of Object.entries(counts)) {
              const el = document.getElementById(`count-${key}`);
              if (el) el.textContent = val;
            }
            statusEl.textContent = `${journals.length} journals | Data: ${updated}`;
          } catch (_) {}
        });
      } else {
        statusEl.textContent = "No data loaded yet";
      }
    } catch (_) {}
  });
}

function renderCustomList(journals) {
  const container = document.getElementById("custom-list");
  container.innerHTML = "";
  for (const name of journals) {
    const row = document.createElement("div");
    row.className = "custom-item";

    const label = document.createElement("span");
    label.className = "custom-name";
    label.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "custom-remove";
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", () => removeCustomJournal(name));

    row.appendChild(label);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }
}

function addCustomJournal() {
  const input = document.getElementById("custom-input");
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  chrome.storage.sync.get({ customJournals: [] }, (prefs) => {
    try {
      const list = prefs.customJournals || [];
      if (!list.some((j) => j.toLowerCase() === name.toLowerCase())) {
        list.push(name);
        chrome.storage.sync.set({ customJournals: list }, () => {
          try {
            input.value = "";
            renderCustomList(list);
            loadStatus();
            notifyTab("CUSTOM_CHANGED");
          } catch (_) {}
        });
      }
    } catch (_) {}
  });
}

function removeCustomJournal(name) {
  chrome.storage.sync.get({ customJournals: [] }, (prefs) => {
    try {
      const list = (prefs.customJournals || []).filter((j) => j !== name);
      chrome.storage.sync.set({ customJournals: list }, () => {
        try {
          renderCustomList(list);
          loadStatus();
          notifyTab("CUSTOM_CHANGED");
        } catch (_) {}
      });
    } catch (_) {}
  });
}

function notifyTab(msgType) {
  chrome.tabs.query({ active: true, currentWindow: true })
    .then((tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes("scholar.google.com")) {
        chrome.tabs.sendMessage(tabs[0].id, { type: msgType }).catch(() => {});
      }
    })
    .catch(() => {});
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

document.getElementById("manage-btn").addEventListener("click", () => {
  const section = document.getElementById("custom-section");
  section.style.display = section.style.display === "none" ? "block" : "none";
});

document.getElementById("custom-add-btn").addEventListener("click", addCustomJournal);
document.getElementById("custom-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCustomJournal();
});

try { loadPreferences(); loadStatus(); } catch (_) {}
