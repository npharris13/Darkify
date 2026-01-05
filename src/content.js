// State
let isWhitelisted = false;
let isGlobalDisabled = false;
let emojiProcessingEnabled = false;

// Emoji regex pattern - matches most emojis including compound/ZWJ sequences
const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji}\u200D\p{Emoji})+/gu;

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
  // Using #c8c8c8 so it inverts to dark grey (#373737) instead of pitch black
  if (document.body && getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)') {
     document.documentElement.style.backgroundColor = '#c8c8c8';
  } else if (!document.body && getComputedStyle(document.documentElement).backgroundColor === 'rgba(0, 0, 0, 0)') {
     document.documentElement.style.backgroundColor = '#c8c8c8';
  }
  
  // Enable emoji processing and do initial pass
  if (!emojiProcessingEnabled) {
    emojiProcessingEnabled = true;
    processEmojisInDocument();
  }
}

// Wrap emojis in a span so they can be re-inverted to preserve original colors
function wrapEmojisInTextNode(textNode) {
  const text = textNode.textContent;
  if (!emojiRegex.test(text)) return;
  
  // Reset regex state
  emojiRegex.lastIndex = 0;
  
  // Skip if already inside our emoji wrapper
  if (textNode.parentElement?.classList.contains('darkify-emoji')) return;
  
  // Skip script and style elements
  const parentTag = textNode.parentElement?.tagName;
  if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || parentTag === 'INPUT') return;
  
  // Create a document fragment to hold the new nodes
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match;
  
  emojiRegex.lastIndex = 0;
  while ((match = emojiRegex.exec(text)) !== null) {
    // Add text before the emoji
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    
    // Wrap the emoji in a span
    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'darkify-emoji';
    emojiSpan.textContent = match[0];
    fragment.appendChild(emojiSpan);
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last emoji
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  
  // Replace the original text node with the fragment
  textNode.parentNode.replaceChild(fragment, textNode);
}

// Walk through all text nodes in an element
function processEmojisInElement(element) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip empty text nodes
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        // Skip nodes already in emoji wrappers
        if (node.parentElement?.classList.contains('darkify-emoji')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  
  // Process collected nodes (we collect first to avoid modifying during traversal)
  textNodes.forEach(wrapEmojisInTextNode);
}

// Process the entire document for emojis
function processEmojisInDocument() {
  if (document.body) {
    processEmojisInElement(document.body);
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
// Also process emojis in newly added content
const observer = new MutationObserver((mutations) => {
  if (!emojiProcessingEnabled) return;
  
  for (const mutation of mutations) {
    // Process added nodes for emojis
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip our own emoji wrapper spans to avoid infinite loops
        if (node.classList?.contains('darkify-emoji')) continue;
        processEmojisInElement(node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        wrapEmojisInTextNode(node);
      }
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

// Run init
init();
