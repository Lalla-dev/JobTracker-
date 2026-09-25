const STORAGE_KEY = "jobApplication";

function detectPage() {
  const { hostname, pathname } = window.location;
  if (hostname.includes("linkedin.com") && pathname.includes("/jobs")) return "linkedin";
  if (hostname.includes("greenhouse.io")) return "greenhouse";
  return null;
}

function textFrom(el) {
  return el ? (el.textContent || el.innerText || "").trim() : "";
}

function getUniversalData() {
  const pageTitle = document.title || "";
  const titleEl = document.querySelector("h1") || document.querySelector("h2");
  const hostParts = window.location.hostname.replace("www.", "").split(".");
  const fallbackCompany = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);

  return {
    title: textFrom(titleEl) || pageTitle.split(/[-–|]/)[0].trim(),
    company: fallbackCompany,
    source: window.location.hostname,
    url: window.location.href
  };
}

function scrapeJob() {
  let data = { title: "", company: "", source: "", url: window.location.href, description: "" };
  const pageType = detectPage();

  if (pageType === "linkedin") {
    const titleEl = document.querySelector(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .scaffold-layout__main h1, h1.t-24, h1");
    const companyEl = document.querySelector(".job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a, a[href*='/company/'], .job-card-container__primary-description, .app-aware-link");

    data.title = textFrom(titleEl);
    data.company = textFrom(companyEl);
    data.source = "linkedin";
  } else if (pageType === "greenhouse") {
    const titleEl = document.querySelector("#header h1, .app-title, h1");
    const companyEl = document.querySelector("#header .company-name, .company-name, #header .logo a, .logo a");

    data.title = textFrom(titleEl);
    data.company = textFrom(companyEl);
    data.source = "greenhouse";
  }

  // If the specific scrapers failed to find anything, force the universal fallback
  if (!data.title || !data.company) {
    const fallback = getUniversalData();
    data.title = data.title || fallback.title;
    data.company = data.company || fallback.company;
    data.source = data.source || fallback.source;
  }

  // Capture the job description text for the AI (limited to 4000 chars for payload size)
  data.description = document.body.innerText.substring(0, 4000);

  // Cache it for the popup (Crucial for LinkedIn's Single Page App architecture)
  chrome.storage.local.set({ [STORAGE_KEY]: data });

  return data;
}

// Listen for the popup asking for data
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "scrapeJob") {
    sendResponse(scrapeJob());
  }
  return true;
});

// Auto-scrape on page load and cache it
scrapeJob();
const observer = new MutationObserver(() => {
  scrapeJob();
});
observer.observe(document.body, { childList: true, subtree: true });