const DATA_URL =
  "https://raw.githubusercontent.com/minghaowang-research/scholar-journal-highlighter/main/data/journals.json";
const CONFIG_URL =
  "https://raw.githubusercontent.com/minghaowang-research/scholar-journal-highlighter/main/data/config.json";
const CACHE_KEY = "journalData";
const CACHE_TS_KEY = "journalDataTimestamp";
const CONFIG_CACHE_KEY = "configData";
const CONFIG_CACHE_TS_KEY = "configDataTimestamp";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const DOI_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const CURRENT_VERSION = 3;
const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";

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

async function fetchConfig() {
  const cached = await chrome.storage.local.get([CONFIG_CACHE_KEY, CONFIG_CACHE_TS_KEY]);
  if (cached[CONFIG_CACHE_KEY] && cached[CONFIG_CACHE_TS_KEY]) {
    if (Date.now() - cached[CONFIG_CACHE_TS_KEY] < CACHE_TTL) {
      return cached[CONFIG_CACHE_KEY];
    }
  }

  try {
    const resp = await fetch(CONFIG_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    await chrome.storage.local.set({
      [CONFIG_CACHE_KEY]: data,
      [CONFIG_CACHE_TS_KEY]: Date.now(),
    });
    return data;
  } catch (err) {
    console.warn("Scholar Journal Highlighter: config fetch failed");
    return cached[CONFIG_CACHE_KEY] || { scihubUrl: "https://www.sci-hub.pub/", defaultProxyUrl: "" };
  }
}

function doiCacheKey(title) {
  return "doi_" + title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 80);
}

async function lookupDOI(title) {
  const key = doiCacheKey(title);
  const tsKey = key + "_ts";
  const cached = await chrome.storage.local.get([key, tsKey]);
  if (cached[key] !== undefined && cached[tsKey] && Date.now() - cached[tsKey] < DOI_CACHE_TTL) {
    return cached[key];
  }
  return fetchDOI(title);
}

async function fetchDOI(title) {
  try {
    const query = encodeURIComponent(title.substring(0, 300));
    const s2Settings = await chrome.storage.sync.get({ s2ApiKey: "" });
    const headers = {};
    if (s2Settings.s2ApiKey) headers["x-api-key"] = s2Settings.s2ApiKey;
    const resp = await fetch(`${S2_API}?query=${query}&fields=externalIds&limit=1`, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    let doi = null;
    if (data.data && data.data.length > 0 && data.data[0].externalIds?.DOI) {
      doi = data.data[0].externalIds.DOI;
    }

    const key = doiCacheKey(title);
    await chrome.storage.local.set({ [key]: doi, [key + "_ts"]: Date.now() });
    return doi;
  } catch (err) {
    console.warn("Scholar Journal Highlighter: DOI lookup failed", err);
    return null;
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
  if (msg.type === "GET_CONFIG") {
    fetchConfig().then(sendResponse);
    return true;
  }
  if (msg.type === "LOOKUP_DOI") {
    lookupDOI(msg.title).then((doi) => sendResponse({ doi }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  fetchJournalData(true);
  fetchConfig();
});
