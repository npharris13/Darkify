document.addEventListener('DOMContentLoaded', () => {
  const siteToggleBtn = document.getElementById('btn-site-toggle');
  const globalDisableToggle = document.getElementById('toggle-global-disable');
  const statusMessage = document.getElementById('status-message');
  
  const newSiteInput = document.getElementById('new-site-input');
  const addSiteBtn = document.getElementById('btn-add-site');
  const whitelistContainer = document.getElementById('whitelist-container');

  let currentHostname = '';

  // Load saved settings
  chrome.storage.sync.get(['whitelistedSites', 'globalDisable'], (result) => {
    // 1. Handle Global Disable State
    const isGlobalDisabled = result.globalDisable === true;
    globalDisableToggle.checked = isGlobalDisabled;
    
    const whitelistedSites = result.whitelistedSites || [];
    
    // 2. Render Whitelist
    renderWhitelist(whitelistedSites);

    // 3. Handle Site Whitelist State for Current Tab
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          currentHostname = url.hostname;
          
          updateButtonState(whitelistedSites.includes(currentHostname));
          
          // Disable button if protocol is not http/https
          if (!url.protocol.startsWith('http')) {
            siteToggleBtn.disabled = true;
            siteToggleBtn.style.opacity = '0.5';
            siteToggleBtn.textContent = 'Not available';
          }
        } catch (e) {
          console.error("Invalid URL", e);
        }
      }
    });
  });

  function updateButtonState(isActive) {
    if (isActive) {
      siteToggleBtn.classList.add('active');
      siteToggleBtn.textContent = 'Darkify Active';
    } else {
      siteToggleBtn.classList.remove('active');
      siteToggleBtn.textContent = 'Darkify this site';
    }
  }

  function renderWhitelist(sites) {
    whitelistContainer.innerHTML = '';
    sites.forEach(site => {
      const li = document.createElement('li');
      li.className = 'whitelist-item';
      
      const span = document.createElement('span');
      span.textContent = site;
      
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-site-btn';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Remove';
      delBtn.onclick = () => removeSite(site);

      li.appendChild(span);
      li.appendChild(delBtn);
      whitelistContainer.appendChild(li);
    });
  }

  function saveWhitelist(sites) {
    chrome.storage.sync.set({ whitelistedSites: sites }, () => {
      renderWhitelist(sites);
      // If the modified site is the current one, update button state
      if (currentHostname) {
        updateButtonState(sites.includes(currentHostname));
      }
      notifyContentScript();
    });
  }

  function addSite() {
    const site = newSiteInput.value.trim();
    if (!site) return;

    // Simple hostname validation/cleanup could go here
    // For now, just taking the value
    
    chrome.storage.sync.get(['whitelistedSites'], (result) => {
      const whitelistedSites = result.whitelistedSites || [];
      if (!whitelistedSites.includes(site)) {
        whitelistedSites.push(site);
        saveWhitelist(whitelistedSites);
        statusMessage.textContent = 'Site added';
        setTimeout(() => statusMessage.textContent = '', 2000);
      } else {
        statusMessage.textContent = 'Site already in list';
        setTimeout(() => statusMessage.textContent = '', 2000);
      }
      newSiteInput.value = '';
    });
  }

  function removeSite(siteToRemove) {
    chrome.storage.sync.get(['whitelistedSites'], (result) => {
      let whitelistedSites = result.whitelistedSites || [];
      whitelistedSites = whitelistedSites.filter(site => site !== siteToRemove);
      saveWhitelist(whitelistedSites);
    });
  }

  // Add Site Listeners
  addSiteBtn.addEventListener('click', addSite);
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  // Site Toggle Button Click Listener
  siteToggleBtn.addEventListener('click', () => {
    if (!currentHostname) return;

    chrome.storage.sync.get(['whitelistedSites'], (result) => {
      let whitelistedSites = result.whitelistedSites || [];
      const index = whitelistedSites.indexOf(currentHostname);
      const isCurrentlyActive = index !== -1;

      if (isCurrentlyActive) {
        // Turn OFF
        whitelistedSites.splice(index, 1);
        statusMessage.textContent = 'Site removed from Darkify';
      } else {
        // Turn ON
        whitelistedSites.push(currentHostname);
        statusMessage.textContent = 'Site added to Darkify';
      }
      
      saveWhitelist(whitelistedSites);
      setTimeout(() => statusMessage.textContent = '', 2000);
    });
  });

  // Global Disable Toggle Listener
  globalDisableToggle.addEventListener('change', () => {
    const isGlobalDisabled = globalDisableToggle.checked;
    
    chrome.storage.sync.set({ globalDisable: isGlobalDisabled }, () => {
      statusMessage.textContent = isGlobalDisabled ? 'Extension Disabled Globally' : 'Extension Enabled';
      setTimeout(() => statusMessage.textContent = '', 2000);
      notifyContentScript();
    });
  });

  function notifyContentScript() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].id) {
         // Using catch to avoid error if script not injected
         chrome.tabs.sendMessage(tabs[0].id, { action: 'checkState' }).catch(() => {});
      }
    });
  }

  // Listen for storage changes to update UI in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.whitelistedSites) {
        const newSites = changes.whitelistedSites.newValue || [];
        renderWhitelist(newSites);
        if (currentHostname) {
          updateButtonState(newSites.includes(currentHostname));
        }
      }
      if (changes.globalDisable) {
        globalDisableToggle.checked = changes.globalDisable.newValue === true;
      }
    }
  });
});
