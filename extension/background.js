const DATA_URL =
  "https://raw.githubusercontent.com/minghaowang-research/scholar-journal-highlighter/main/data/journals.json";
const CACHE_KEY = "journalData";
const CACHE_TS_KEY = "journalDataTimestamp";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const CURRENT_VERSION = 3;

async function loadBundledData() {
  const url = chrome.runtime.getURL("journals.json");
  const resp = await fetch(url);
  return resp.json();
}

async function fetchJournalData(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await chrome.storage.local.get([CACHE_KEY, CACHE_TS_KEY]);
    if (cached[CACHE_KEY] && cached[CACHE_TS_KEY]) {
      if (cached[CACHE_KEY].version === CURRENT_VERSION) {
        const age = Date.now() - cached[CACHE_TS_KEY];
        if (age < CACHE_TTL) {
          return cached[CACHE_KEY];
        }
      }
    }
  }

  try {
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    await chrome.storage.local.set({
      [CACHE_KEY]: data,
      [CACHE_TS_KEY]: Date.now(),
    });
    return data;
  } catch (err) {
    console.warn("Scholar Journal Highlighter: remote fetch failed, using bundled data");
    const bundled = await loadBundledData();
    await chrome.storage.local.set({
      [CACHE_KEY]: bundled,
      [CACHE_TS_KEY]: Date.now(),
    });
    return bundled;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_JOURNALS") {
    fetchJournalData().then(sendResponse);
    return true;
  }
  if (msg.type === "REFRESH_DATA") {
    fetchJournalData(true).then(sendResponse);
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  fetchJournalData(true);
});
