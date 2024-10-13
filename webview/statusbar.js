const statusBar = {
  statuses: {},

  // Register or update a status entry for a consumer
  setStatus(consumerId, text) {
    const statusContainer = document.getElementById('status-container');
    const statusBarElement = document.getElementById('status-bar');
    const isCollapsed = uiSettings.statusBarSettings[consumerId] === true;

    // Update the status text for this consumer
    if (text.trim() === '') {
      this.removeStatus(consumerId);
      return;
    }

    let statusElement = this.statuses[consumerId];

    if (!statusElement) {
      // Create a new status entry
      statusElement = document.createElement('div');
      statusElement.id = `status-${consumerId}`;
      statusElement.classList.add('status-entry');

      // Add a header with a rotated name
      const statusHeader = document.createElement('div');
      statusHeader.classList.add('status-header');
      statusHeader.innerText = consumerId;
      statusHeader.title = consumerId;

      // Create the collapsible content
      const statusContent = document.createElement('div');
      statusContent.classList.add('status-content');
      statusContent.innerHTML = text;

      // Append elements to the status entry
      statusElement.appendChild(statusHeader);
      statusElement.appendChild(statusContent);

      // Store the status element in the statuses object
      this.statuses[consumerId] = statusElement;

      // Set the initial state
      if (isCollapsed) {
        this.collapse(consumerId);
      } else {
        this.expand(consumerId);
      }

      // Add click listener to toggle collapse/expand
      statusHeader.addEventListener('click', event => {
        event.stopPropagation();
        event.preventDefault();
        this.toggleCollapse(consumerId);
      });
    } else {
      // Update the content if the status already exists
      const statusContent = statusElement.querySelector('.status-content');
      statusContent.innerHTML = text;
    }

    // Reorder statuses according to the consumerId order
    this.reorderStatuses();

    // Show the status bar if there are any active statuses
    statusBarElement.style.display = 'block';
  },

  // Function to reorder the statuses by consumerId
  reorderStatuses() {
    const statusContainer = document.getElementById('status-container');
    // Get all consumerIds, sort them alphabetically
    const sortedConsumerIds = Object.keys(this.statuses).sort((a, b) => a.localeCompare(b));

    // Clear the container first
    statusContainer.innerHTML = '';

    // Reinsert the statuses in sorted order
    sortedConsumerIds.forEach(consumerId => {
      if (this.statuses[consumerId]) {
        statusContainer.appendChild(this.statuses[consumerId]);
      }
    });
  },

  // Remove a status entry for a consumer
  removeStatus(consumerId) {
    const statusBarElement = document.getElementById('status-bar');

    if (this.statuses[consumerId]) {
      const statusElement = document.getElementById(`status-${consumerId}`);
      statusElement.remove();
      delete this.statuses[consumerId];
    }

    // Reorder statuses after removal
    this.reorderStatuses();

    // Hide the status bar if no statuses are left
    if (Object.keys(this.statuses).length === 0) {
      statusBarElement.style.display = 'none';
    }
  },

  // Collapse the status (hide content and show simplified non-rotated header)
  collapse(consumerId) {
    const statusElement = this.statuses[consumerId];
    const statusContent = statusElement.querySelector('.status-content');
    const statusHeader = statusElement.querySelector('.status-header');

    // Hide the content and adjust the header to be non-rotated
    statusContent.classList.add('collapsed');
    statusHeader.classList.add('collapsed');

    // Mark the collapsed state in uiSettings
    uiSettings.statusBarSettings[consumerId] = true;
    saveUISettings();
  },

  // Expand the status (show content and rotated header)
  expand(consumerId) {
    const statusElement = this.statuses[consumerId];
    const statusContent = statusElement.querySelector('.status-content');
    const statusHeader = statusElement.querySelector('.status-header');

    // Show the content and rotate the header
    statusContent.classList.remove('collapsed');
    statusHeader.classList.remove('collapsed');

    // Mark the expanded state in uiSettings
    uiSettings.statusBarSettings[consumerId] = false;
    saveUISettings();
  },

  // Toggle the collapsed state of a status
  toggleCollapse(consumerId) {
    const isCollapsed = uiSettings.statusBarSettings[consumerId] === true;
    if (isCollapsed) {
      this.expand(consumerId);
    } else {
      this.collapse(consumerId);
    }
  },

  // Clear all statuses
  clearAll() {
    const statusBarElement = document.getElementById('status-bar');
    const statusContainer = document.getElementById('status-container');

    statusContainer.innerHTML = ''; // Remove all child elements
    this.statuses = {}; // Clear the statuses object

    // Hide the status bar
    statusBarElement.style.display = 'none';
  }
};
