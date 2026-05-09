let journalData = null;
let exactMap = new Map();
let aliasMap = new Map();
let prefs = { showUtd24: true, showFt50: true, showSjr: true, displayMode: "dim" };

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
}

function matchJournal(extractedName) {
  const norm = normalize(extractedName);
  if (!norm || norm.length < 3) return null;

  if (exactMap.has(norm)) return exactMap.get(norm);
  if (aliasMap.has(norm)) return aliasMap.get(norm);

  for (const [key, journal] of exactMap) {
    if (norm.includes(key) || key.includes(norm)) {
      const ratio =
        Math.min(norm.length, key.length) / Math.max(norm.length, key.length);
      if (ratio > 0.55) return journal;
    }
  }

  return null;
}

// For search results pages: extract from "Authors - Journal, Year - publisher" format
function extractJournalFromSearchResult(gsaEl) {
  const text = gsaEl.textContent;
  const parts = text.split(/\s[-–—]\s/);
  if (parts.length < 2) return null;

  const journalYearPart = parts[1];
  const journalName = journalYearPart.replace(/,?\s*\d{4}.*$/, "").trim();

  if (!journalName || /^\d+$/.test(journalName)) return null;
  if (journalName.includes(".com") || journalName.includes(".org")) return null;

  return journalName;
}

// For profile/citation pages: extract from second .gs_gray div ("Journal vol (issue), pages, year")
function extractJournalFromProfile(gsGrayEl) {
  const text = gsGrayEl.textContent;
  // Strip volume/issue/pages/year: "Journal Name 70 (1), 3-14, 2006" -> "Journal Name"
  const journalName = text
    .replace(/\d+\s*\([\d\-]+\).*$/, "")
    .replace(/,?\s*\d{4}.*$/, "")
    .replace(/\d+,\s*\d+[-–]\d+.*$/, "")
    .trim();

  if (!journalName || /^\d+$/.test(journalName)) return null;
  return journalName;
}

function getHighestTier(lists) {
  if (lists.includes("utd24")) return "utd24";
  if (lists.includes("ft50")) return "ft50";
  if (lists.includes("sjr")) return "sjr";
  return "sjr";
}

function getQuartileClass(journal) {
  if (!journal.sjr || !journal.sjr.quartile) return "";
  return "sjh-" + journal.sjr.quartile.toLowerCase();
}

function isJournalVisible(journal) {
  return journal.lists.some((l) => {
    if (l === "utd24") return prefs.showUtd24;
    if (l === "ft50") return prefs.showFt50;
    if (l === "sjr") return prefs.showSjr;
    return false;
  });
}

// Process a search results page entry (.gs_ri)
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

// Process a profile/citation page entry (tr.gsc_a_tr)
function processProfileResult(rowEl) {
  const tdEl = rowEl.querySelector(".gsc_a_t");
  if (!tdEl) return;

  // Second .gs_gray div has the journal info
  const grayDivs = tdEl.querySelectorAll(".gs_gray");
  if (grayDivs.length < 2) return;

  const journalGray = grayDivs[1];
  const journalName = extractJournalFromProfile(journalGray);
  if (!journalName) {
    applyNonMatch(rowEl, true);
    return;
  }

  const journal = matchJournal(journalName);
  if (!journal || !isJournalVisible(journal)) {
    applyNonMatch(rowEl, true);
    return;
  }

  applyMatchProfile(rowEl, journalGray, journal);
}

function buildBadge(journal, tier, visibleLists) {
  const wrapper = document.createElement("span");
  wrapper.className = "sjh-tags";

  if (journal.sjr) {
    wrapper.title = `SJR: ${journal.sjr.score}, H-index: ${journal.sjr.hIndex}, Rank: #${journal.sjr.rank}`;
  }

  const items = [];
  if (visibleLists.includes("utd24")) items.push({ label: "UTD24", cls: "sjh-tag-utd24" });
  if (visibleLists.includes("ft50")) items.push({ label: "FT50", cls: "sjh-tag-ft50" });
  if (visibleLists.includes("sjr")) {
    const q = journal.sjr ? journal.sjr.quartile : "";
    items.push({ label: q ? `SJR ${q}` : "SJR", cls: "sjh-tag-sjr" });
  }

  for (const item of items) {
    const tag = document.createElement("span");
    tag.className = `sjh-tag ${item.cls}`;
    tag.textContent = item.label;
    wrapper.appendChild(tag);
  }

  return wrapper;
}

function buildQuartilePill(journal) {
  if (!journal.sjr || !journal.sjr.quartile) return null;
  const qPill = document.createElement("span");
  qPill.className = `sjh-quartile ${getQuartileClass(journal)}`;
  qPill.textContent = journal.sjr.quartile;
  qPill.title = `SJR Score: ${journal.sjr.score}`;
  return qPill;
}

function getVisibleLists(journal) {
  return journal.lists.filter((l) => {
    if (l === "utd24") return prefs.showUtd24;
    if (l === "ft50") return prefs.showFt50;
    if (l === "sjr") return prefs.showSjr;
    return false;
  });
}

// Highlight a search results page entry
function applyMatch(resultEl, gsaEl, journal) {
  const container = resultEl.closest(".gs_r") || resultEl;
  container.classList.add("sjh-processed");

  const visibleLists = getVisibleLists(journal);
  const tier = getHighestTier(visibleLists);
  container.classList.add("sjh-match", `sjh-${tier}`);

  const qPill = buildQuartilePill(journal);
  if (qPill) gsaEl.appendChild(qPill);
  gsaEl.appendChild(buildBadge(journal, tier, visibleLists));
}

// Highlight a profile page entry
function applyMatchProfile(rowEl, journalGray, journal) {
  rowEl.classList.add("sjh-processed");

  const visibleLists = getVisibleLists(journal);
  const tier = getHighestTier(visibleLists);
  rowEl.classList.add("sjh-match", `sjh-${tier}`);

  const qPill = buildQuartilePill(journal);
  if (qPill) journalGray.appendChild(qPill);
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

function processAllResults() {
  if (isProfilePage()) {
    document.querySelectorAll(".gsc_a_tr").forEach(processProfileResult);
  } else {
    document.querySelectorAll(".gs_ri").forEach(processSearchResult);
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
      "sjh-sjr"
    );
  });
  document.querySelectorAll(".sjh-badge, .sjh-quartile").forEach((el) => el.remove());
}

function loadPrefsAndProcess() {
  chrome.storage.sync.get(
    { showUtd24: true, showFt50: true, showSjr: true, displayMode: "dim" },
    (p) => {
      prefs = p;
      clearHighlights();
      processAllResults();
    }
  );
}

function init() {
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
    buildLookup(data.journals);
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
  if (msg.type === "TOGGLE_CHANGED" || msg.type === "MODE_CHANGED") {
    loadPrefsAndProcess();
  }
});

init();
