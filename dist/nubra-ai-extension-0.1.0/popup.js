// Popup script for Nubra AI Assistant
function queryActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs && tabs[0]);
    });
  });
}

function sendToggleMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'toggleSidebar' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const popupStatus = document.getElementById('popupStatus');

  const setStatus = (text, type = '') => {
    if (!popupStatus) return;
    popupStatus.textContent = text;
    popupStatus.classList.remove('ok', 'error');
    if (type) popupStatus.classList.add(type);
  };

  if (!openSidebarBtn) {
    console.error('Open sidebar button not found');
    return;
  }

  openSidebarBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    try {
      const activeTab = await queryActiveTab();
      if (!activeTab || typeof activeTab.id !== 'number') {
        throw new Error('No active tab found');
      }

      if (!/^https?:/i.test(activeTab.url || '')) {
        setStatus('Open a regular webpage tab, then try again.', 'error');
        return;
      }

      try {
        await sendToggleMessage(activeTab.id);
      } catch (sendError) {
        if (sendError.message.includes('Receiving end does not exist')) {
          setStatus('This tab is not ready yet. Refresh once and click Go to Chat again.', 'error');
          return;
        }
        throw sendError;
      }

      setStatus('Sidebar opened on current tab.', 'ok');
      window.close();
    } catch (error) {
      console.error('Failed to open sidebar:', error);
      setStatus('Could not open sidebar on this tab.', 'error');
    }
  });
});
