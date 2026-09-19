const API_URL = "http://localhost:5678/webhook-test/log-job";
const STORAGE_KEY = "jobApplication";
let jobDescription = ""; // Stores the scraped text

document.addEventListener("DOMContentLoaded", async () => {
  const titleInput = document.getElementById("jobTitle");
  const companyInput = document.getElementById("companyName");
  const statusDiv = document.getElementById("status");
  const saveBtn = document.getElementById("saveBtn");

  // 1. Ask active tab for live DOM scrape
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "scrapeJob" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Fall back to cached local storage
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          const cached = res[STORAGE_KEY];
          if (cached) {
            titleInput.value = cached.title || "";
            companyInput.value = cached.company || "";
            jobDescription = cached.description || "";
          }
        });
        return;
      }
      titleInput.value = response.title || "";
      companyInput.value = response.company || "";
      jobDescription = response.description || "";
    });
  }

  // 2. Handle Submission
  saveBtn.addEventListener("click", async () => {
    const payload = {
      title: titleInput.value.trim(),
      company: companyInput.value.trim(),
      url: tab?.url || "",
      description: jobDescription, // Send the text to n8n
      savedAt: new Date().toISOString()
    };

    if (!payload.title || !payload.company) {
      statusDiv.style.color = "#f59e0b";
      statusDiv.textContent = "Please fill in both fields.";
      return;
    }

    statusDiv.style.color = "#94a3b8";
    statusDiv.textContent = "Sending to n8n + AI...";

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Network response error");

      statusDiv.style.color = "#10b981";
      statusDiv.textContent = "Saved successfully!";
      setTimeout(() => window.close(), 1000);
    } catch (err) {
      statusDiv.style.color = "#ef4444";
      statusDiv.textContent = "Failed to save.";
      console.error(err);
    }
  });
});