document.addEventListener('DOMContentLoaded', () => {
  const siteToggleBtn = document.getElementById('btn-site-toggle');
  const globalDisableToggle = document.getElementById('toggle-global-disable');
  const statusMessage = document.getElementById('status-message');

  const newSiteInput = document.getElementById('new-site-input');
  const addSiteBtn = document.getElementById('btn-add-site');
  const whitelistContainer = document.getElementById('whitelist-container');
  const subAppSection = document.getElementById('subapp-section');
  const subAppToggles = document.getElementById('subapp-toggles');

  // currentSiteKey is hostname-only for regular sites, or "hostname/path" for sub-apps
  let currentSiteKey = '';
  let currentHostname = '';

  // Sites that support per-sub-app toggling via URL path prefix
  const SPLITTABLE_SITES = {
    'docs.google.com': [
      { path: '/document', label: 'Docs' },
      { path: '/presentation', label: 'Slides' },
      { path: '/spreadsheets', label: 'Sheets' },
    ]
  };

  // Returns "hostname/path" for known sub-apps, otherwise just "hostname"
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

  // Returns the short display label for a path-specific key (e.g. "Slides"), or null
  function getAppLabel(siteKey) {
    const slashIdx = siteKey.indexOf('/');
    if (slashIdx === -1) return null;
    const hostname = siteKey.slice(0, slashIdx);
    const path = siteKey.slice(slashIdx);
    const splittable = SPLITTABLE_SITES[hostname];
    if (!splittable) return null;
    const app = splittable.find(a => a.path === path);
    return app ? app.label : null;
  }

  // A key is whitelisted if it's directly in the list, or its parent hostname is
  function isKeyWhitelisted(siteKey, whitelistedSites) {
    if (whitelistedSites.includes(siteKey)) return true;
    const slashIdx = siteKey.indexOf('/');
    if (slashIdx !== -1) {
      const hostname = siteKey.slice(0, slashIdx);
      if (whitelistedSites.includes(hostname)) return true;
    }
    return false;
  }

  // Toggle a site key and return the updated array.
  // Turning OFF a path covered by a hostname entry expands the hostname into the
  // remaining sibling sub-app keys so they stay enabled.
  // Turning ON collapses all sibling keys back to hostname when all are enabled.
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
          // Hostname entry covers this path — expand it, leaving this path off
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
      // Collapse all sibling sub-app entries to hostname when all are enabled
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

  // Load saved settings
  chrome.storage.sync.get(['whitelistedSites', 'globalDisable'], (result) => {
    const isGlobalDisabled = result.globalDisable === true;
    globalDisableToggle.checked = isGlobalDisabled;

    const whitelistedSites = result.whitelistedSites || [];
    renderWhitelist(whitelistedSites);

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          currentHostname = url.hostname;
          currentSiteKey = getSiteKey(currentHostname, url.pathname);

          updateButtonState(isKeyWhitelisted(currentSiteKey, whitelistedSites));
          renderSubAppSection(whitelistedSites);

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
    const appLabel = getAppLabel(currentSiteKey);
    if (isActive) {
      siteToggleBtn.classList.add('active');
      siteToggleBtn.textContent = appLabel ? `${appLabel} Active` : 'Darkify Active';
    } else {
      siteToggleBtn.classList.remove('active');
      siteToggleBtn.textContent = appLabel ? `Darkify ${appLabel}` : 'Darkify this site';
    }
  }

  function renderSubAppSection(whitelistedSites) {
    const splittable = SPLITTABLE_SITES[currentHostname];
    if (!splittable) {
      subAppSection.style.display = 'none';
      return;
    }

    subAppSection.style.display = 'block';
    subAppToggles.innerHTML = '';

    splittable.forEach(app => {
      const appKey = currentHostname + app.path;
      const isActive = isKeyWhitelisted(appKey, whitelistedSites);
      const isCurrent = currentSiteKey === appKey;

      const row = document.createElement('div');
      row.className = 'subapp-item' + (isCurrent ? ' current' : '');

      const labelSpan = document.createElement('span');
      labelSpan.className = 'subapp-label';
      labelSpan.textContent = app.label;

      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch switch-enable';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isActive;
      checkbox.addEventListener('change', () => {
        chrome.storage.sync.get(['whitelistedSites'], (result) => {
          const newSites = toggleKey(appKey, result.whitelistedSites || []);
          saveWhitelist(newSites);
        });
      });

      const slider = document.createElement('span');
      slider.className = 'slider round';

      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(slider);
      row.appendChild(labelSpan);
      row.appendChild(switchLabel);
      subAppToggles.appendChild(row);
    });
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
      if (currentSiteKey) {
        updateButtonState(isKeyWhitelisted(currentSiteKey, sites));
        renderSubAppSection(sites);
      }
      notifyContentScript();
    });
  }

  function addSite() {
    const site = newSiteInput.value.trim();
    if (!site) return;

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

  addSiteBtn.addEventListener('click', addSite);
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  siteToggleBtn.addEventListener('click', () => {
    if (!currentSiteKey) return;

    chrome.storage.sync.get(['whitelistedSites'], (result) => {
      const newSites = toggleKey(currentSiteKey, result.whitelistedSites || []);
      const isNowActive = isKeyWhitelisted(currentSiteKey, newSites);
      statusMessage.textContent = isNowActive ? 'Site added to Darkify' : 'Site removed from Darkify';
      saveWhitelist(newSites);
      setTimeout(() => statusMessage.textContent = '', 2000);
    });
  });

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
        chrome.tabs.sendMessage(tabs[0].id, { action: 'checkState' }).catch(() => {});
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.whitelistedSites) {
        const newSites = changes.whitelistedSites.newValue || [];
        renderWhitelist(newSites);
        if (currentSiteKey) {
          updateButtonState(isKeyWhitelisted(currentSiteKey, newSites));
          renderSubAppSection(newSites);
        }
      }
      if (changes.globalDisable) {
        globalDisableToggle.checked = changes.globalDisable.newValue === true;
      }
    }
  });
});
