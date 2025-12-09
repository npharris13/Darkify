document.addEventListener('DOMContentLoaded', () => {
  const siteToggle = document.getElementById('toggle-site');
  const statusMessage = document.getElementById('status-message');

  // Load saved settings
  chrome.storage.sync.get(['whitelistedSites'], (result) => {
    // Check if current site is whitelisted
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        const whitelistedSites = result.whitelistedSites || [];
        siteToggle.checked = whitelistedSites.includes(hostname);
      }
    });
  });

  // Site toggle listener
  siteToggle.addEventListener('change', () => {
    const isWhitelisted = siteToggle.checked;
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        
        chrome.storage.sync.get(['whitelistedSites'], (result) => {
          let whitelistedSites = result.whitelistedSites || [];
          
          if (isWhitelisted) {
            if (!whitelistedSites.includes(hostname)) {
              whitelistedSites.push(hostname);
            }
            statusMessage.textContent = 'Enabled';
          } else {
            whitelistedSites = whitelistedSites.filter(site => site !== hostname);
            statusMessage.textContent = 'Disabled';
          }
          
          chrome.storage.sync.set({ whitelistedSites: whitelistedSites }, () => {
             // Notify content script to re-check
             setTimeout(() => statusMessage.textContent = '', 2000);
             chrome.tabs.sendMessage(tabs[0].id, { action: 'checkWhitelist' });
          });
        });
      }
    });
  });
});
