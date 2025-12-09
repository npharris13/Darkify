document.addEventListener('DOMContentLoaded', () => {
  const globalToggle = document.getElementById('toggle-global');
  const siteToggle = document.getElementById('toggle-site');
  const statusMessage = document.getElementById('status-message');

  // Load saved settings
  chrome.storage.sync.get(['enabled', 'excludedSites'], (result) => {
    globalToggle.checked = result.enabled !== false; // Default to true
    
    // Check if current site is excluded
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        const excludedSites = result.excludedSites || [];
        siteToggle.checked = excludedSites.includes(hostname);
      }
    });
  });

  // Global toggle listener
  globalToggle.addEventListener('change', () => {
    const enabled = globalToggle.checked;
    chrome.storage.sync.set({ enabled: enabled }, () => {
      statusMessage.textContent = enabled ? 'Enabled' : 'Disabled';
      setTimeout(() => statusMessage.textContent = '', 2000);
      
      // Notify content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle', enabled: enabled });
        }
      });
    });
  });

  // Site toggle listener
  siteToggle.addEventListener('change', () => {
    const isExcluded = siteToggle.checked;
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        
        chrome.storage.sync.get(['excludedSites'], (result) => {
          let excludedSites = result.excludedSites || [];
          
          if (isExcluded) {
            if (!excludedSites.includes(hostname)) {
              excludedSites.push(hostname);
            }
          } else {
            excludedSites = excludedSites.filter(site => site !== hostname);
          }
          
          chrome.storage.sync.set({ excludedSites: excludedSites }, () => {
             // Notify content script to re-check
             chrome.tabs.sendMessage(tabs[0].id, { action: 'checkExclusion' });
          });
        });
      }
    });
  });
});

