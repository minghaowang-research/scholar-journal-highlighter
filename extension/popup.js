const TOGGLE_KEYS = {
  "toggle-utd24": "showUtd24",
  "toggle-ft50": "showFt50",
  "toggle-abdc": "showAbdc",
  "toggle-custom": "showCustom",
};

const DEFAULTS = {
  showUtd24: true, showFt50: true, showAbdc: true, showCustom: true,
  displayMode: "highlight", customJournals: [],
  enableScihub: false, enableProxy: false, scihubUrl: "", proxyUrl: "",
  showCitations: true,
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

      document.getElementById("toggle-scihub").checked = prefs.enableScihub;
      document.getElementById("toggle-proxy").checked = prefs.enableProxy;
      document.getElementById("scihub-url").value = prefs.scihubUrl;
      document.getElementById("proxy-url").value = prefs.proxyUrl;
      document.getElementById("toggle-citations").checked = prefs.showCitations;


      updateUrlRowVisibility();
    } catch (_) {}
  });
}

function updateUrlRowVisibility() {
  const scihubOn = document.getElementById("toggle-scihub").checked;
  const proxyOn = document.getElementById("toggle-proxy").checked;
  document.getElementById("scihub-url-row").style.display = scihubOn ? "block" : "none";
  document.getElementById("proxy-url-row").style.display = proxyOn ? "block" : "none";
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
            statusEl.textContent = `Data: ${updated}`;
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

function onAccessChange() {
  const settings = {
    enableScihub: document.getElementById("toggle-scihub").checked,
    enableProxy: document.getElementById("toggle-proxy").checked,
    scihubUrl: document.getElementById("scihub-url").value.trim(),
    proxyUrl: document.getElementById("proxy-url").value.trim(),
  };
  updateUrlRowVisibility();
  chrome.storage.sync.set(settings, () => notifyTab("ACCESS_CHANGED"));
}

function onCitationChange() {
  const showCitations = document.getElementById("toggle-citations").checked;
  chrome.storage.sync.set({ showCitations }, () => notifyTab("CITATION_CHANGED"));
}

// Journal list toggles
Object.keys(TOGGLE_KEYS).forEach((id) => {
  document.getElementById(id).addEventListener("change", onToggleChange);
});

// Display mode radios
document.querySelectorAll('input[name="displayMode"]').forEach((radio) => {
  radio.addEventListener("change", onModeChange);
});

// Custom journal management
document.getElementById("manage-btn").addEventListener("click", () => {
  const section = document.getElementById("custom-section");
  section.style.display = section.style.display === "none" ? "block" : "none";
});
document.getElementById("custom-add-btn").addEventListener("click", addCustomJournal);
document.getElementById("custom-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCustomJournal();
});

// Access settings
document.getElementById("toggle-scihub").addEventListener("change", onAccessChange);
document.getElementById("toggle-proxy").addEventListener("change", onAccessChange);
document.getElementById("scihub-url").addEventListener("change", onAccessChange);
document.getElementById("proxy-url").addEventListener("change", onAccessChange);



// Citation toggle
document.getElementById("toggle-citations").addEventListener("change", onCitationChange);

try { loadPreferences(); loadStatus(); } catch (_) {}
