console.log('Service Worker: Background script loaded');

// Default sites to enable dark mode on when extension is first installed
const DEFAULT_WHITELISTED_SITES = [
  'mail.google.com',
  'docs.google.com',
  'app.contentful.com'
];

// Sites that support per-sub-app toggling via path prefix
const SPLITTABLE_SITES = {
  'docs.google.com': [
    { path: '/document' },
    { path: '/presentation' },
    { path: '/spreadsheets' },
  ]
};

// Set up default whitelist on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed, setting up default whitelist');
    chrome.storage.sync.set({ whitelistedSites: DEFAULT_WHITELISTED_SITES }, () => {
      console.log('Default whitelist set:', DEFAULT_WHITELISTED_SITES);
    });
  }
});

// Returns the most specific site key for a URL.
// For splittable sites returns e.g. "docs.google.com/document"; otherwise returns the hostname.
function getSiteKey(hostname, pathname) {
  const splittable = SPLITTABLE_SITES[hostname];
  if (splittable) {
    for (const app of splittable) {
      if (pathname === app.path || pathname.startsWith(app.path + '/')) {
        return hostname + app.path;
      }
    }
  }
  return hostname;
}

// A site key is whitelisted if it appears directly in the list, or if its
// hostname-only form appears (meaning "all sub-paths on this host are enabled").
function isKeyWhitelisted(siteKey, whitelistedSites) {
  if (whitelistedSites.includes(siteKey)) return true;
  const slashIdx = siteKey.indexOf('/');
  if (slashIdx !== -1) {
    const hostname = siteKey.slice(0, slashIdx);
    if (whitelistedSites.includes(hostname)) return true;
  }
  return false;
}

// Toggle a site key and return the updated list.
// When turning OFF a path-specific key that was covered by a hostname entry,
// it "expands" the hostname into the remaining sub-app keys so they stay enabled.
// When turning ON, if all sub-apps end up enabled it collapses them back to the hostname.
function toggleKey(siteKey, whitelistedSites) {
  const slashIdx = siteKey.indexOf('/');
  const isPathSpecific = slashIdx !== -1;
  const hostname = isPathSpecific ? siteKey.slice(0, slashIdx) : siteKey;
  const isCurrentlyActive = isKeyWhitelisted(siteKey, whitelistedSites);
  let newList = [...whitelistedSites];

  if (isCurrentlyActive) {
    if (isPathSpecific) {
      const hostnameIdx = newList.indexOf(hostname);
      if (hostnameIdx !== -1) {
        // Hostname entry covers this path — expand it, leaving this path disabled
        newList.splice(hostnameIdx, 1);
        const splittable = SPLITTABLE_SITES[hostname] || [];
        for (const app of splittable) {
          const otherKey = hostname + app.path;
          if (otherKey !== siteKey && !newList.includes(otherKey)) {
            newList.push(otherKey);
          }
        }
      } else {
        newList = newList.filter(e => e !== siteKey);
      }
    } else {
      newList = newList.filter(e => e !== siteKey);
    }
  } else {
    if (!newList.includes(siteKey)) newList.push(siteKey);
    // Collapse all sub-app entries back to hostname when all are enabled
    if (isPathSpecific) {
      const splittable = SPLITTABLE_SITES[hostname];
      if (splittable) {
        const allOn = splittable.every(app => newList.includes(hostname + app.path));
        if (allOn) {
          for (const app of splittable) {
            newList = newList.filter(e => e !== hostname + app.path);
          }
          if (!newList.includes(hostname)) newList.push(hostname);
        }
      }
    }
  }

  return newList;
}

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
        if (!url.protocol.startsWith('http')) {
          console.log('Not an http/https URL');
          return;
        }

        const siteKey = getSiteKey(url.hostname, url.pathname);

        chrome.storage.sync.get(['whitelistedSites'], (result) => {
          const whitelistedSites = toggleKey(siteKey, result.whitelistedSites || []);
          console.log('Updated whitelist:', whitelistedSites);

          chrome.storage.sync.set({ whitelistedSites }, () => {
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
