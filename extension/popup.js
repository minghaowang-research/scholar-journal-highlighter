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

// Import / Export
document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const btn = document.getElementById("import-btn");

  try {
    const names = file.name.toLowerCase().endsWith(".csv")
      ? await parseCsvFile(file)
      : await parseXlsxFile(file);

    if (names.length === 0) {
      btn.textContent = "No journals found";
      setTimeout(() => { btn.textContent = "Import"; }, 2000);
      e.target.value = "";
      return;
    }

    chrome.storage.sync.get({ customJournals: [] }, (prefs) => {
      try {
        const existing = new Set((prefs.customJournals || []).map((j) => j.toLowerCase()));
        const newList = [...(prefs.customJournals || [])];
        let added = 0;
        for (const name of names) {
          if (name && !existing.has(name.toLowerCase())) {
            newList.push(name);
            existing.add(name.toLowerCase());
            added++;
          }
        }
        chrome.storage.sync.set({ customJournals: newList }, () => {
          try {
            renderCustomList(newList);
            loadStatus();
            notifyTab("CUSTOM_CHANGED");
            btn.textContent = "+" + added + " added";
            setTimeout(() => { btn.textContent = "Import"; }, 2000);
          } catch (_) {}
        });
      } catch (_) {}
    });
  } catch (err) {
    btn.textContent = "Error";
    setTimeout(() => { btn.textContent = "Import"; }, 2000);
  }

  e.target.value = "";
});

document.getElementById("export-btn").addEventListener("click", () => {
  chrome.storage.sync.get({ customJournals: [] }, (prefs) => {
    try {
      const list = prefs.customJournals || [];
      if (list.length === 0) return;
      const csv = "Journal Name\n" + list.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-journals.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {}
  });
});

async function parseCsvFile(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  return lines.slice(1).map((line) => {
    if (line.startsWith('"')) {
      const end = line.indexOf('"', 1);
      return end > 0 ? line.substring(1, end).trim() : "";
    }
    return line.split(",")[0].trim();
  }).filter((name) => name.length > 0);
}

async function parseXlsxFile(file) {
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);

  const ssEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const sheetEntry = entries.find((e) => e.name === "xl/worksheets/sheet1.xml");
  if (!sheetEntry) return [];

  let strings = [];
  if (ssEntry) {
    const ssXml = await inflateZipEntry(ssEntry, buffer);
    const ssDoc = new DOMParser().parseFromString(ssXml, "text/xml");
    strings = [...ssDoc.getElementsByTagName("si")].map((si) => si.textContent);
  }

  const sheetXml = await inflateZipEntry(sheetEntry, buffer);
  const sheetDoc = new DOMParser().parseFromString(sheetXml, "text/xml");

  const values = [];
  const rows = sheetDoc.getElementsByTagName("row");
  for (const row of rows) {
    const cells = row.getElementsByTagName("c");
    for (const cell of cells) {
      const ref = cell.getAttribute("r") || "";
      if (!/^A\d/.test(ref)) continue;
      const type = cell.getAttribute("t");
      const vEl = cell.getElementsByTagName("v")[0];
      if (type === "s" && vEl) {
        const idx = parseInt(vEl.textContent);
        if (idx < strings.length) values.push(strings[idx]);
      } else if (type === "inlineStr") {
        const tEl = cell.getElementsByTagName("t")[0];
        if (tEl) values.push(tEl.textContent);
      } else if (vEl) {
        values.push(vEl.textContent);
      }
      break;
    }
  }

  return values.slice(1).filter((v) => v && v.trim().length > 0);
}

function parseZipEntries(buffer) {
  const view = new DataView(buffer);
  const entries = [];
  let offset = 0;
  while (offset < buffer.byteLength - 4) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, offset + 30, nameLen));
    const dataOffset = offset + 30 + nameLen + extraLen;
    entries.push({ name, method, compSize, dataOffset });
    offset = dataOffset + compSize;
  }
  return entries;
}

async function inflateZipEntry(entry, buffer) {
  const data = new Uint8Array(buffer, entry.dataOffset, entry.compSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return new TextDecoder().decode(result);
}

// Access settings
document.getElementById("toggle-scihub").addEventListener("change", onAccessChange);
document.getElementById("toggle-proxy").addEventListener("change", onAccessChange);
document.getElementById("scihub-url").addEventListener("change", onAccessChange);
document.getElementById("proxy-url").addEventListener("change", onAccessChange);



// Citation toggle
document.getElementById("toggle-citations").addEventListener("change", onCitationChange);

try { loadPreferences(); loadStatus(); } catch (_) {}
