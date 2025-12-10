// State
let isWhitelisted = false;
let isGlobalDisabled = false;

// Initialize
function init() {
  checkState();
}

function checkState() {
  const hostname = window.location.hostname;
  
  chrome.storage.sync.get(['whitelistedSites', 'globalDisable'], (result) => {
    const whitelistedSites = result.whitelistedSites || [];
    isGlobalDisabled = result.globalDisable === true;
    isWhitelisted = whitelistedSites.includes(hostname);
    
    applyMode();
  });
}

// Apply or remove dark mode
function applyMode() {
  const html = document.documentElement;
  
  // If globally disabled, remove dark mode regardless of whitelist
  if (isGlobalDisabled) {
    removeDarkMode(html);
    return;
  }

  if (isWhitelisted) {
    addDarkMode(html);
  } else {
    removeDarkMode(html);
  }
}

function addDarkMode(html) {
  html.setAttribute('data-darkify-mode', 'active');
  // Helper to ensure background is filled for full inversion
  if (document.body && getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)') {
     document.documentElement.style.backgroundColor = '#ffffff';
  } else if (!document.body && getComputedStyle(document.documentElement).backgroundColor === 'rgba(0, 0, 0, 0)') {
     document.documentElement.style.backgroundColor = '#ffffff';
  }
}

function removeDarkMode(html) {
  html.removeAttribute('data-darkify-mode');
  document.documentElement.style.backgroundColor = '';
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkState') {
    checkState();
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
