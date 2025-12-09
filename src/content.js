// State
let isWhitelisted = false;

// Initialize
function init() {
  const hostname = window.location.hostname;
  
  chrome.storage.sync.get(['whitelistedSites'], (result) => {
    const whitelistedSites = result.whitelistedSites || [];
    isWhitelisted = whitelistedSites.includes(hostname);
    
    applyMode();
  });
}

// Apply or remove dark mode
function applyMode() {
  const html = document.documentElement;
  
  if (isWhitelisted) {
    html.setAttribute('data-darkify-mode', 'active');
    // Helper to ensure background is filled for full inversion
    if (document.body && getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)') {
       document.documentElement.style.backgroundColor = '#ffffff';
    } else if (!document.body && getComputedStyle(document.documentElement).backgroundColor === 'rgba(0, 0, 0, 0)') {
       document.documentElement.style.backgroundColor = '#ffffff';
    }
  } else {
    html.removeAttribute('data-darkify-mode');
    document.documentElement.style.backgroundColor = '';
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkWhitelist') {
    // Re-read whitelist
    const hostname = window.location.hostname;
    chrome.storage.sync.get(['whitelistedSites'], (result) => {
      const whitelistedSites = result.whitelistedSites || [];
      isWhitelisted = whitelistedSites.includes(hostname);
      applyMode();
    });
  }
});

// Watch for dynamic content changes that might need fixes (e.g. new iframes/canvases)
// The CSS handles most, but sometimes specific style overrides are needed.
const observer = new MutationObserver((mutations) => {
  // If we need to inject specific classes for dynamic elements
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Run init
init();
