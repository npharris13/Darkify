console.log('Service Worker: Background script loaded');

chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  if (command === 'toggle-dark-mode') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.log('No active tab or URL found');
        return;
      }
      
      console.log('Toggling for URL:', tab.url);

      try {
        const url = new URL(tab.url);
        // Only work on http/https
        if (!url.protocol.startsWith('http')) {
          console.log('Not an http/https URL');
          return;
        }

        const hostname = url.hostname;

        chrome.storage.sync.get(['whitelistedSites'], (result) => {
          let whitelistedSites = result.whitelistedSites || [];
          const index = whitelistedSites.indexOf(hostname);

          if (index !== -1) {
            // Remove
            whitelistedSites.splice(index, 1);
            console.log('Removed from whitelist:', hostname);
          } else {
            // Add
            whitelistedSites.push(hostname);
            console.log('Added to whitelist:', hostname);
          }

          chrome.storage.sync.set({ whitelistedSites: whitelistedSites }, () => {
            // Notify content script to update immediately
            // We use catch here in case the content script isn't loaded (e.g. restricted page)
            chrome.tabs.sendMessage(tab.id, { action: 'checkState' }).catch((err) => {
                console.log('Could not send message to content script (may not be loaded):', err);
            });
          });
        });
      } catch (e) {
        console.error("Invalid URL", e);
      }
    });
  }
});
