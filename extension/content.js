let journalData = null;
let exactMap = new Map();
let aliasMap = new Map();
let userCustom = [];
let prefs = {
  showUtd24: true, showFt50: true, showAbdc: true, showCustom: true,
  displayMode: "highlight",
  enableScihub: false, enableProxy: false, scihubUrl: "", proxyUrl: "",
  showCitations: true,
};
let configData = null;
let profileData = null;
let profileFetchInProgress = false;
let activeFilter = null;
let filterExpanding = false;

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[:.,'"\(\)\[\]]/g, " ")
    .replace(/…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLookup(journals) {
  exactMap.clear();
  aliasMap.clear();
  for (const j of journals) {
    exactMap.set(j.normalized, j);
    if (j.aliases) {
      for (const a of j.aliases) {
        aliasMap.set(a.toLowerCase(), j);
      }
    }
  }
  for (const name of userCustom) {
    const norm = normalize(name);
    if (!exactMap.has(norm)) {
      exactMap.set(norm, {
        name: name,
        normalized: norm,
        aliases: [],
        lists: ["custom"],
        abdc: null,
      });
    } else {
      const entry = exactMap.get(norm);
      if (!entry.lists.includes("custom")) {
        entry.lists = [...entry.lists, "custom"];
      }
    }
  }
}

function matchJournal(extractedName) {
  const norm = normalize(extractedName);
  if (!norm || norm.length < 3) return null;

  if (exactMap.has(norm)) return exactMap.get(norm);
  if (aliasMap.has(norm)) return aliasMap.get(norm);

  return null;
}

function extractJournalFromSearchResult(gsaEl) {
  const text = gsaEl.textContent;
  const parts = text.split(/\s[-–—]\s/);
  if (parts.length < 2) return null;

  const journalName = cleanProfileJournalText(parts[1]);
  if (!journalName) return null;
  if (journalName.includes(".com") || journalName.includes(".org")) return null;

  return journalName;
}

function cleanProfileJournalText(text) {
  const journalName = text.replace(/\s*\d.*$/, "").replace(/[,.\s]+$/, "");
  if (!journalName) return null;
  return journalName;
}

function extractJournalFromProfile(gsGrayEl) {
  return cleanProfileJournalText(gsGrayEl.textContent);
}

function getHighestTier(lists) {
  if (lists.includes("utd24")) return "utd24";
  if (lists.includes("ft50")) return "ft50";
  if (lists.includes("abdc")) return "abdc";
  if (lists.includes("custom")) return "custom";
  return "custom";
}

function isJournalVisible(journal) {
  return journal.lists.some((l) => {
    if (l === "utd24") return prefs.showUtd24;
    if (l === "ft50") return prefs.showFt50;
    if (l === "abdc") return prefs.showAbdc;
    if (l === "custom") return prefs.showCustom;
    return false;
  });
}

function processSearchResult(resultEl) {
  const gsaEl = resultEl.querySelector(".gs_a");
  if (!gsaEl) return;

  const journalName = extractJournalFromSearchResult(gsaEl);
  if (!journalName) {
    applyNonMatch(resultEl);
    return;
  }

  const journal = matchJournal(journalName);
  if (!journal || !isJournalVisible(journal)) {
    applyNonMatch(resultEl);
    return;
  }

  applyMatch(resultEl, gsaEl, journal);
}

function processProfileResult(rowEl) {
  const tdEl = rowEl.querySelector(".gsc_a_t");
  if (!tdEl) { rowEl._sjhJournal = null; return; }

  const grayDivs = tdEl.querySelectorAll(".gs_gray");
  if (grayDivs.length < 2) { rowEl._sjhJournal = null; return; }

  const journalGray = grayDivs[1];
  const journalName = extractJournalFromProfile(journalGray);
  if (!journalName) {
    rowEl._sjhJournal = null;
    applyNonMatch(rowEl, true);
    return;
  }

  const journal = matchJournal(journalName);
  if (!journal || !isJournalVisible(journal)) {
    rowEl._sjhJournal = null;
    applyNonMatch(rowEl, true);
    return;
  }

  rowEl._sjhJournal = journal;
  applyMatchProfile(rowEl, journalGray, journal);
}

function buildBadge(journal, tier, visibleLists) {
  const wrapper = document.createElement("span");
  wrapper.className = "sjh-tags";

  const items = [];
  if (visibleLists.includes("utd24")) items.push({ label: "UTD24", cls: "sjh-tag-utd24" });
  if (visibleLists.includes("ft50")) items.push({ label: "FT50", cls: "sjh-tag-ft50" });
  if (visibleLists.includes("abdc")) {
    const r = journal.abdc || "";
    items.push({ label: r ? `ABDC ${r}` : "ABDC", cls: "sjh-tag-abdc" });
  }
  if (visibleLists.includes("custom")) items.push({ label: "My List", cls: "sjh-tag-custom" });

  for (const item of items) {
    const tag = document.createElement("span");
    tag.className = `sjh-tag ${item.cls}`;
    tag.textContent = item.label;
    wrapper.appendChild(tag);
  }

  return wrapper;
}

function getVisibleLists(journal) {
  return journal.lists.filter((l) => {
    if (l === "utd24") return prefs.showUtd24;
    if (l === "ft50") return prefs.showFt50;
    if (l === "abdc") return prefs.showAbdc;
    if (l === "custom") return prefs.showCustom;
    return false;
  });
}

function applyMatch(resultEl, gsaEl, journal) {
  const container = resultEl.closest(".gs_r") || resultEl;
  container.classList.add("sjh-processed");

  const visibleLists = getVisibleLists(journal);
  const tier = getHighestTier(visibleLists);
  container.classList.add("sjh-match", `sjh-${tier}`);

  gsaEl.appendChild(buildBadge(journal, tier, visibleLists));
}

function applyMatchProfile(rowEl, journalGray, journal) {
  rowEl.classList.add("sjh-processed");

  const visibleLists = getVisibleLists(journal);
  const tier = getHighestTier(visibleLists);
  rowEl.classList.add("sjh-match", `sjh-${tier}`);

  journalGray.appendChild(buildBadge(journal, tier, visibleLists));
}

function applyNonMatch(el, isProfile) {
  const container = isProfile ? el : el.closest(".gs_r") || el;
  container.classList.add("sjh-processed", "sjh-nomatch");

  if (prefs.displayMode === "dim") {
    container.classList.add("sjh-dimmed");
  } else if (prefs.displayMode === "hide") {
    container.classList.add("sjh-hidden");
  }
}

function isProfilePage() {
  return window.location.pathname.includes("/citations");
}

function injectSummaryBar(data) {
  document.querySelectorAll(".sjh-summary-bar").forEach((el) => el.remove());

  const total = data.total;
  const counts = { utd24: 0, ft50: 0, abdcStar: 0, abdcA: 0, custom: 0 };
  const cites = { utd24: 0, ft50: 0, abdcStar: 0, abdcA: 0, custom: 0 };
  for (const pub of data.publications) {
    const journalName = cleanProfileJournalText(pub.name);
    if (!journalName) continue;
    const journal = matchJournal(journalName);
    if (!journal) continue;
    const c = pub.cites || 0;
    const vl = getVisibleLists(journal);
    if (vl.includes("utd24")) { counts.utd24++; cites.utd24 += c; }
    if (vl.includes("ft50")) { counts.ft50++; cites.ft50 += c; }
    if (vl.includes("abdc")) {
      if (journal.abdc === "A*") { counts.abdcStar++; cites.abdcStar += c; }
      else { counts.abdcA++; cites.abdcA += c; }
    }
    if (vl.includes("custom")) { counts.custom++; cites.custom += c; }
  }

  const parts = [];
  if (prefs.showUtd24 && counts.utd24)
    parts.push({ count: counts.utd24, cites: cites.utd24, label: "UTD24", cls: "sjh-sum-utd24", filterKey: "utd24" });
  if (prefs.showFt50 && counts.ft50)
    parts.push({ count: counts.ft50, cites: cites.ft50, label: "FT50", cls: "sjh-sum-ft50", filterKey: "ft50" });
  if (prefs.showAbdc && counts.abdcStar)
    parts.push({ count: counts.abdcStar, cites: cites.abdcStar, label: "ABDC A*", cls: "sjh-sum-abdc", filterKey: "abdcStar" });
  if (prefs.showAbdc && counts.abdcA)
    parts.push({ count: counts.abdcA, cites: cites.abdcA, label: "ABDC A", cls: "sjh-sum-abdc", filterKey: "abdcA" });
  if (prefs.showCustom && counts.custom)
    parts.push({ count: counts.custom, cites: cites.custom, label: "My List", cls: "sjh-sum-custom", filterKey: "custom" });

  const bar = document.createElement("div");
  bar.className = "sjh-summary-bar";

  for (let i = 0; i < parts.length; i++) {
    const pct = total > 0 ? Math.round((parts[i].count / total) * 100) : 0;
    const item = document.createElement("span");
    item.className = "sjh-sum-item sjh-sum-clickable " + parts[i].cls;
    if (activeFilter === parts[i].filterKey) item.classList.add("sjh-sum-active");
    item.textContent = parts[i].count + " " + parts[i].label + " (" + pct + "%, " + parts[i].cites.toLocaleString() + " cites)";
    item.title = "Click to show only " + parts[i].label + " papers";
    const fk = parts[i].filterKey;
    item.addEventListener("click", () => handleFilterClick(fk));
    bar.appendChild(item);
    if (i < parts.length - 1) {
      const sep = document.createElement("span");
      sep.className = "sjh-sum-sep";
      sep.textContent = "|";
      bar.appendChild(sep);
    }
  }

  if (parts.length > 0) {
    const sep = document.createElement("span");
    sep.className = "sjh-sum-sep";
    sep.textContent = "|";
    bar.appendChild(sep);
  }
  const totalItem = document.createElement("span");
  totalItem.className = "sjh-sum-item sjh-sum-total";
  totalItem.textContent = total + " in Scholar profile";
  bar.appendChild(totalItem);

  if (!activeFilter && parts.length > 0) {
    const hint = document.createElement("span");
    hint.className = "sjh-sum-hint";
    hint.textContent = "click to filter";
    bar.appendChild(hint);
  }

  if (activeFilter) {
    const sep2 = document.createElement("span");
    sep2.className = "sjh-sum-sep";
    sep2.textContent = "|";
    bar.appendChild(sep2);
    const showAll = document.createElement("span");
    showAll.className = "sjh-sum-item sjh-sum-show-all";
    showAll.textContent = "Show All";
    showAll.addEventListener("click", () => {
      activeFilter = null;
      filterExpanding = false;
      applyActiveFilter();
      injectSummaryBar(profileData);
    });
    bar.appendChild(showAll);
  }

  const table = document.querySelector(".gsc_a_tr")?.closest("table");
  if (table) {
    table.parentNode.insertBefore(bar, table);
  }
}

function injectLoadingSummaryBar() {
  document.querySelectorAll(".sjh-summary-bar").forEach((el) => el.remove());
  const bar = document.createElement("div");
  bar.className = "sjh-summary-bar";
  const loading = document.createElement("span");
  loading.className = "sjh-sum-loading";
  loading.textContent = "Counting all publications...";
  bar.appendChild(loading);
  const table = document.querySelector(".gsc_a_tr")?.closest("table");
  if (table) {
    table.parentNode.insertBefore(bar, table);
  }
}

// --- Access buttons (Sci-Hub + Library Proxy) ---

function ensureUrl(url) {
  if (!url) return "";
  url = url.trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  if (url && !url.endsWith("/") && !url.includes("?")) url += "/";
  return url;
}

function getScihubBase() {
  return ensureUrl(prefs.scihubUrl) || ensureUrl(configData && configData.scihubUrl) || "https://www.sci-hub.pub/";
}

function getProxyBase() {
  return ensureUrl(prefs.proxyUrl) || ensureUrl(configData && configData.defaultProxyUrl) || "";
}

function extractDOIFromUrl(url) {
  const match = url.match(/\b(10\.\d{4,}\/[^\s?#]+)/);
  if (match) return match[1].replace(/[.,;:)\]]+$/, "");
  return null;
}

function stripQueryParams(url) {
  try { return url.split("?")[0]; } catch (_) { return url; }
}

function makeBtn(cls, label) {
  const btn = document.createElement("a");
  btn.className = "sjh-btn " + cls;
  btn.textContent = label;
  btn.target = "_blank";
  btn.rel = "noopener";
  return btn;
}

function injectAccessButtons(resultEl) {
  if (isProfilePage()) {
    injectAccessButtonsProfile(resultEl);
    return;
  }

  const titleLink = resultEl.querySelector(".gs_rt a");
  if (!titleLink) return;

  const container = resultEl.closest(".gs_r") || resultEl;
  if (container.querySelector(".sjh-access-btns")) return;

  const paperUrl = titleLink.href;
  if (!paperUrl || paperUrl.startsWith("javascript:")) return;

  const btnContainer = document.createElement("span");
  btnContainer.className = "sjh-access-btns";

  if (prefs.enableProxy && getProxyBase()) {
    const btn = makeBtn("sjh-btn-proxy", "Library");
    btn.href = getProxyBase() + stripQueryParams(paperUrl);
    btnContainer.appendChild(btn);
  }

  if (prefs.enableScihub) {
    const btn = makeBtn("sjh-btn-scihub", "Sci-Hub");
    btnContainer.appendChild(btn);

    const urlDoi = extractDOIFromUrl(paperUrl);
    if (urlDoi) {
      btn.href = getScihubBase() + urlDoi;
    } else {
      btn.href = getScihubBase() + stripQueryParams(paperUrl);
      const title = titleLink.textContent.trim();
      chrome.runtime.sendMessage({ type: "LOOKUP_DOI", title }, (result) => {
        if (chrome.runtime.lastError || !result || !result.doi) return;
        btn.href = getScihubBase() + result.doi;
      });
    }
  }

  const titleContainer = resultEl.querySelector(".gs_rt");
  if (titleContainer) {
    titleContainer.appendChild(btnContainer);
  }
}

function injectAccessButtonsProfile(rowEl) {
  const tdEl = rowEl.querySelector(".gsc_a_t");
  if (!tdEl) return;
  if (rowEl.querySelector(".sjh-access-btns")) return;

  const titleLink = tdEl.querySelector("a");
  if (!titleLink) return;

  const title = titleLink.textContent.trim();
  if (!title) return;

  const btnContainer = document.createElement("span");
  btnContainer.className = "sjh-access-btns";

  const citationUrl = titleLink.href;
  let cached = null;

  async function resolve() {
    if (cached) return cached;
    cached = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_PAPER_ACCESS", citationUrl, title }, resolve);
    });
    return cached || {};
  }

  if (prefs.enableProxy && getProxyBase()) {
    const btn = makeBtn("sjh-btn-proxy", "Library");
    btn.href = "#";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const newTab = window.open("about:blank", "_blank");
      if (newTab) { try { newTab.document.title = "Redirecting via library proxy..."; newTab.document.body.innerText = "Looking up paper URL... This may take a few seconds."; } catch (_) {} }
      btn.textContent = "...";
      const result = await resolve();
      btn.textContent = "Library";
      const url = result.publisherUrl || (result.doi ? "https://doi.org/" + result.doi : null);
      if (url && newTab) {
        newTab.location.href = getProxyBase() + url;
      } else {
        if (newTab) newTab.close();
        btn.textContent = "Not found";
        setTimeout(() => { btn.textContent = "Library"; }, 2000);
      }
    });
    btnContainer.appendChild(btn);
  }

  if (prefs.enableScihub) {
    const btn = makeBtn("sjh-btn-scihub", "Sci-Hub");
    btn.href = "#";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const newTab = window.open("about:blank", "_blank");
      if (newTab) { try { newTab.document.title = "Redirecting via Sci-Hub..."; newTab.document.body.innerText = "Looking up paper DOI... This may take a few seconds."; } catch (_) {} }
      btn.textContent = "...";

      const result = await resolve();
      const target = result.doi || result.publisherUrl;
      if (target && newTab) {
        newTab.location.href = getScihubBase() + target;
        if (result.doi) {
          btn.textContent = "Sci-Hub";
        } else if (result.error === "rate_limited") {
          btn.textContent = "No DOI (API limit)";
          setTimeout(() => { btn.textContent = "Sci-Hub"; cached = null; }, 5000);
        } else {
          btn.textContent = "No DOI (via URL)";
        }
      } else {
        if (newTab) newTab.close();
        if (result.error === "rate_limited") {
          btn.textContent = "API limit";
          setTimeout(() => { btn.textContent = "Sci-Hub"; cached = null; }, 5000);
        } else {
          btn.textContent = result.error === "no_result" ? "No DOI found" : "Not found";
        }
      }
    });
    btnContainer.appendChild(btn);
  }

  if (btnContainer.children.length === 0) return;

  const grayDivs = tdEl.querySelectorAll(".gs_gray");
  if (grayDivs.length > 0) {
    grayDivs[grayDivs.length - 1].appendChild(btnContainer);
  } else {
    tdEl.appendChild(btnContainer);
  }
}

// --- Citation highlighting ---

function highlightCitations(resultEl) {
  if (!prefs.showCitations) return;

  if (isProfilePage()) {
    const citeCell = resultEl.querySelector(".gsc_a_c");
    if (!citeCell) return;
    const citeTarget = citeCell.querySelector("a") || citeCell;
    const text = citeTarget.textContent.trim();
    if (!text) return;
    const count = parseInt(text.replace(/,/g, ""));
    if (isNaN(count)) return;
    if (count >= 1000) citeTarget.classList.add("sjh-cite-1k");
    else if (count >= 500) citeTarget.classList.add("sjh-cite-500");
    else if (count >= 100) citeTarget.classList.add("sjh-cite-100");
    return;
  }

  const flEl = resultEl.querySelector(".gs_fl");
  if (!flEl) return;

  const links = flEl.querySelectorAll("a");
  for (const link of links) {
    const match = link.textContent.match(/Cited by\s+([\d,]+)/);
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ""));
      if (count >= 1000) link.classList.add("sjh-cite-1k");
      else if (count >= 500) link.classList.add("sjh-cite-500");
      else if (count >= 100) link.classList.add("sjh-cite-100");
      break;
    }
  }
}

// --- Processing ---

function processAllResults() {
  if (isProfilePage()) {
    document.querySelectorAll(".gsc_a_tr").forEach((el) => {
      processProfileResult(el);
      injectAccessButtonsProfile(el);
      highlightCitations(el);
    });
    if (activeFilter) applyActiveFilter();
    if (prefs.showProfileSummary) {
      if (profileData) {
        injectSummaryBar(profileData);
      } else {
        injectLoadingSummaryBar();
        if (!profileFetchInProgress) {
          profileFetchInProgress = true;
          chrome.runtime.sendMessage(
            { type: "FETCH_PROFILE_COUNTS", profileUrl: window.location.href },
            (data) => {
              profileFetchInProgress = false;
              if (chrome.runtime.lastError || !data) return;
              profileData = data;
              if (prefs.showProfileSummary) injectSummaryBar(data);
            }
          );
        }
      }
    }
  } else {
    document.querySelectorAll(".gs_ri").forEach((el) => {
      processSearchResult(el);
      injectAccessButtons(el);
      highlightCitations(el);
    });
  }
}

function clearHighlights() {
  document.querySelectorAll(".sjh-processed").forEach((el) => {
    el.classList.remove(
      "sjh-processed",
      "sjh-match",
      "sjh-nomatch",
      "sjh-dimmed",
      "sjh-hidden",
      "sjh-utd24",
      "sjh-ft50",
      "sjh-abdc",
      "sjh-custom"
    );
  });
  document.querySelectorAll(".sjh-tags").forEach((el) => el.remove());
  document.querySelectorAll(".sjh-access-btns").forEach((el) => el.remove());
  document.querySelectorAll(".sjh-cite-100, .sjh-cite-500, .sjh-cite-1k").forEach((el) => {
    el.classList.remove("sjh-cite-100", "sjh-cite-500", "sjh-cite-1k");
  });
  document.querySelectorAll(".sjh-summary-bar").forEach((el) => el.remove());
}

function rowMatchesFilter(rowEl) {
  const journal = rowEl._sjhJournal;
  if (!journal) return false;
  if (activeFilter === "utd24") return journal.lists.includes("utd24");
  if (activeFilter === "ft50") return journal.lists.includes("ft50");
  if (activeFilter === "abdcStar") return journal.lists.includes("abdc") && journal.abdc === "A*";
  if (activeFilter === "abdcA") return journal.lists.includes("abdc") && journal.abdc === "A";
  if (activeFilter === "custom") return journal.lists.includes("custom");
  return false;
}

function applyActiveFilter() {
  if (!activeFilter) {
    document.querySelectorAll(".sjh-filtered-out").forEach((el) => el.classList.remove("sjh-filtered-out"));
    return;
  }
  document.querySelectorAll(".gsc_a_tr").forEach((rowEl) => {
    if (rowMatchesFilter(rowEl)) {
      rowEl.classList.remove("sjh-filtered-out");
    } else {
      rowEl.classList.add("sjh-filtered-out");
    }
  });
}

async function expandAllPublications() {
  const btn = document.getElementById("gsc_bpf_more");
  if (!btn || btn.disabled) return;

  let maxAttempts = 50;
  while (!btn.disabled && maxAttempts-- > 0) {
    const before = document.querySelectorAll(".gsc_a_tr").length;
    btn.click();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (btn.disabled || document.querySelectorAll(".gsc_a_tr").length > before) break;
    }
  }
}

async function handleFilterClick(filterKey) {
  if (filterExpanding) return;

  if (activeFilter === filterKey) {
    activeFilter = null;
    applyActiveFilter();
    if (profileData) injectSummaryBar(profileData);
    return;
  }

  activeFilter = filterKey;
  applyActiveFilter();
  if (profileData) injectSummaryBar(profileData);

  filterExpanding = true;
  await expandAllPublications();
  filterExpanding = false;
  applyActiveFilter();
  if (profileData) injectSummaryBar(profileData);
}

function loadPrefsAndProcess() {
  chrome.storage.sync.get(
    {
      showUtd24: true, showFt50: true, showAbdc: true, showCustom: true,
      displayMode: "highlight", customJournals: [],
      enableScihub: false, enableProxy: false, scihubUrl: "", proxyUrl: "",
      showCitations: true, showProfileSummary: true,
    },
    (p) => {
      prefs = p;
      userCustom = p.customJournals || [];
      if (journalData) {
        buildLookup(journalData.journals);
      }
      clearHighlights();
      processAllResults();
    }
  );
}

function init() {
  chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (config) => {
    if (!chrome.runtime.lastError && config) {
      configData = config;
    }
  });

  chrome.runtime.sendMessage({ type: "GET_JOURNALS" }, (data) => {
    if (chrome.runtime.lastError) {
      console.warn("Scholar Journal Highlighter:", chrome.runtime.lastError.message);
      return;
    }
    if (!data || !data.journals) {
      console.warn("Scholar Journal Highlighter: no journal data available");
      return;
    }

    journalData = data;
    console.log(`Scholar Journal Highlighter: ${data.journals.length} journals loaded`);
    loadPrefsAndProcess();

    const targetSelector = isProfilePage() ? ".gsc_a_tr" : ".gs_ri";
    const observer = new MutationObserver((mutations) => {
      let hasNew = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            (node.matches && node.matches(targetSelector)) ||
            (node.querySelector && node.querySelector(targetSelector))
          ) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) break;
      }
      if (hasNew) {
        loadPrefsAndProcess();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TOGGLE_CHANGED" || msg.type === "MODE_CHANGED" ||
      msg.type === "CUSTOM_CHANGED" || msg.type === "ACCESS_CHANGED" ||
      msg.type === "CITATION_CHANGED") {
    activeFilter = null;
    filterExpanding = false;
    document.querySelectorAll(".sjh-filtered-out").forEach((el) => el.classList.remove("sjh-filtered-out"));
    loadPrefsAndProcess();
  }
});

init();
