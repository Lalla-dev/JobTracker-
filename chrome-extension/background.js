const DEFAULT_SUCCESS_URL = "http://localhost:5678/webhook-test/job-success";
const SESSION_KEY = "supabase_session";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Standard success URLs across major job portals (Greenhouse, Lever, LinkedIn, Workday, etc.)
    const successKeywords = [
      "/thanks",
      "/thank-you",
      "/application-submitted",
      "/success",
      "submitted=true",
      "status=submitted",
      "/confirmation"
    ];
    const isSuccessPage = successKeywords.some(keyword => tab.url.toLowerCase().includes(keyword));

    if (isSuccessPage) {
      chrome.storage.local.get(["activeJobId", SESSION_KEY], async (res) => {
        if (res.activeJobId) {
          const jobId = res.activeJobId;
          const session = res[SESSION_KEY];

          // Retrieve custom success webhook URL from chrome.storage.sync
          const config = await chrome.storage.sync.get([
            "n8nSuccessWebhookUrl",
            "n8nBaseUrl"
          ]);

          let targetUrl = config.n8nSuccessWebhookUrl;
          if (!targetUrl && config.n8nBaseUrl) {
            targetUrl = `${config.n8nBaseUrl.replace(/\/+$/, "")}/webhook-test/job-success`;
          } else if (!targetUrl) {
            targetUrl = DEFAULT_SUCCESS_URL;
          }

          const headers = {
            "Content-Type": "application/json"
          };
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          // Fire the second n8n webhook silently to update Supabase status to 'Applied'
          try {
            const response = await fetch(targetUrl, {
              method: "POST",
              headers: headers,
              body: JSON.stringify({
                job_id: jobId,
                user_id: session?.user?.id,
                submitted_at: new Date().toISOString(),
                source_url: tab.url
              })
            });

            if (response.ok) {
              console.log(`[JobTracker] Successfully marked job ${jobId} as Applied via ${targetUrl}`);
              // Clear the ID so it doesn't trigger repeatedly on reloads
              chrome.storage.local.remove("activeJobId");
            } else {
              console.warn(`[JobTracker] Success webhook returned status ${response.status}`);
            }
          } catch (err) {
            console.error("[JobTracker] Failed to dispatch job-success webhook:", err);
          }
        }
      });
    }
  }
});