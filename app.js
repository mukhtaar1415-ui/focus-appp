// Focus Application Controller
// Handles UI rendering, event listeners, modal triggers, inline editing, and custom HTML5 drag-and-drop placeholder rendering.

import store from './store.js';

// DOM Elements cache
const kanbanBoardCanvas = document.getElementById('kanban-board-canvas');
const activeBoardName = document.getElementById('active-board-name');
const boardSelectorBtn = document.getElementById('board-selector-btn');
const pomodoroWidgetBtn = document.getElementById('pomodoro-widget-btn');
const pomodoroDisplayTime = document.getElementById('pomodoro-display-time');
const btnSidebarNewTask = document.getElementById('btn-sidebar-new-task');
const btnFloatingNewTask = document.getElementById('btn-floating-new-task');
const btnSettings = document.getElementById('btn-settings');
const toastNotificationContainer = document.getElementById('toast-notification-container');

// Modals
const modalCardDetail = document.getElementById('modal-card-detail');
const modalBoardManager = document.getElementById('modal-board-manager');
const modalPomodoroController = document.getElementById('modal-pomodoro-controller');

// Modal Elements
const cardDetailForm = document.getElementById('card-detail-form');
const cardIdInput = document.getElementById('modal-card-id');
const cardTitleInput = document.getElementById('modal-task-title');
const cardTagInput = document.getElementById('modal-task-tag');
const cardDescInput = document.getElementById('modal-task-desc');
const cardMembersList = document.getElementById('modal-members-list');
const stopwatchStatusLabel = document.getElementById('stopwatch-status-label');
const stopwatchDisplay = document.getElementById('modal-stopwatch-display');
const btnModalStopwatchToggle = document.getElementById('btn-modal-stopwatch-toggle');
const btnModalStopwatchAdd = document.getElementById('btn-modal-stopwatch-add');
const btnModalStopwatchSub = document.getElementById('btn-modal-stopwatch-sub');
const modalHistoryLogs = document.getElementById('modal-history-logs');
const btnModalDeleteCard = document.getElementById('btn-modal-delete-card');

// Board Manager Elements
const formCreateBoard = document.getElementById('form-create-board');
const newBoardNameInput = document.getElementById('new-board-name');
const boardSelectionList = document.getElementById('board-selection-list');

// Pomodoro Manager Elements
const pomodoroLargeTime = document.getElementById('pomodoro-large-time');
const pomodoroModeLabel = document.getElementById('pomodoro-mode-label');
const btnPomodoroPlay = document.getElementById('btn-pomodoro-play');
const iconPomodoroPlay = document.getElementById('icon-pomodoro-play');
const btnPomodoroReset = document.getElementById('btn-pomodoro-reset');
const pomodoroLinkSelect = document.getElementById('pomodoro-link-select');
const pomodoroSettingsForm = document.getElementById('pomodoro-settings-form');
const settingWorkTime = document.getElementById('setting-work-time');
const settingBreakTime = document.getElementById('setting-break-time');

// Local variables to keep track of dragging and editing state
let dragSrcColumnId = null;

// Helpers: Time formatting
function formatTimeSpent(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m`;
  }
  return `${secs}s`;
}

function formatStopwatchTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  return `${hrs}h ${pad(mins)}m ${pad(secs)}s`;
}

// Helpers: Show Toasts
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  toastNotificationContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// Modal Toggle Handlers
function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
  // Re-render UI to clear active modals or save changes
  render();
}

// Subscribe close event to all buttons marked with [data-close-modal]
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(btn.closest('.modal-overlay'));
  });
});

// Close modal if clicked on overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay);
    }
  });
});

// Render the application components
function render() {
  const state = store.state;
  const board = store.getActiveBoard();
  const members = store.getMembers();

  // 1. Header Board Info
  activeBoardName.innerText = board ? board.name : "MY BOARD";

  // 2. Render Board Columns
  kanbanBoardCanvas.innerHTML = '';
  
  if (board && board.columns) {
    board.columns.forEach((column) => {
      const columnEl = document.createElement('div');
      columnEl.className = 'board-column';
      columnEl.setAttribute('data-column-id', column.id);

      columnEl.innerHTML = `
        <div class="column-header">
          <div class="column-title-container">
            <span class="column-title" data-col-title-id="${column.id}">${column.name}</span>
            <span class="column-count">${column.cards.length}</span>
          </div>
          <button class="column-menu-btn" data-col-menu-id="${column.id}">
            <i data-lucide="more-horizontal" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
        <div class="cards-container" data-col-id="${column.id}">
          <!-- Cards injected here -->
        </div>
        <button class="btn-add-task-placeholder" data-col-add-id="${column.id}">
          <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
          <span>Add Task</span>
        </button>
      `;

      const cardsContainer = columnEl.querySelector('.cards-container');

      // Render column cards
      column.cards.forEach((card) => {
        const isLinkedToPomodoro = state.pomodoro.linkedCardId === card.id;
        const isPomodoroRunning = state.pomodoro.isRunning;
        const isStopwatchRunning = state.activeStopwatchCardId === card.id;
        const activeTimer = isStopwatchRunning || (isLinkedToPomodoro && isPomodoroRunning && !state.pomodoro.isBreak);
        
        const cardEl = document.createElement('div');
        cardEl.className = `task-card ${activeTimer ? 'active-timer' : ''}`;
        cardEl.setAttribute('draggable', 'true');
        cardEl.setAttribute('data-card-id', card.id);

        // Compute tag display
        const tagClass = `tag-${card.tagColor || 'planning'}`;
        const indicatorClass = card.completed ? 'indicator-completed' : `indicator-${card.tagColor || 'planning'}`;

        // Avatars HTML
        let avatarsHTML = '';
        card.members.forEach(memberKey => {
          const m = members[memberKey];
          if (m) {
            // Apply active ring to member if they are working on the active Pomodoro card
            const activeRing = (isLinkedToPomodoro && isPomodoroRunning && memberKey === 'bob') ? 'card-avatar-active-ring' : '';
            avatarsHTML += `
              <div class="card-avatar-item ${activeRing}" title="${m.name}">
                <img src="${m.avatar}" alt="${m.name}">
              </div>
            `;
          }
        });

        // Time display
        let timeBadgeHTML = '';
        if (isLinkedToPomodoro && isPomodoroRunning && !state.pomodoro.isBreak) {
          const remMin = Math.floor(state.pomodoro.timer / 60);
          const remSec = state.pomodoro.timer % 60;
          const leftStr = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')} left`;
          timeBadgeHTML = `
            <div class="card-time-badge active-card-timer">
              <i data-lucide="clock"></i>
              <span>${leftStr}</span>
            </div>
          `;
        } else if (isStopwatchRunning) {
          timeBadgeHTML = `
            <div class="card-time-badge active-card-timer" style="color: var(--color-accent-orange);">
              <i data-lucide="play" style="fill: var(--color-accent-orange); stroke: none;"></i>
              <span>Active Track</span>
            </div>
          `;
        } else if (card.completed) {
          timeBadgeHTML = `
            <div class="card-time-badge">
              <i data-lucide="check-circle" style="color: #10B981;"></i>
              <span>Done</span>
            </div>
          `;
        } else {
          timeBadgeHTML = `
            <div class="card-time-badge">
              <i data-lucide="clock"></i>
              <span>${formatTimeSpent(card.timeSpent)}</span>
            </div>
          `;
        }

        // Tag and Dot/Checkmark Indicator
        let cardTopRightBadge = `<div class="card-indicator ${indicatorClass}"></div>`;
        if (card.completed) {
          cardTopRightBadge = `<i data-lucide="check-circle-2" class="completed-check-icon"></i>`;
        }

        // Active session progress bar inside DOING task
        let progressBarHTML = '';
        if (isLinkedToPomodoro && isPomodoroRunning && !state.pomodoro.isBreak) {
          const progressPercent = ((state.pomodoro.duration - state.pomodoro.timer) / state.pomodoro.duration) * 100;
          progressBarHTML = `
            <div class="card-progress-bar-container">
              <div class="card-progress-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
          `;
        }

        cardEl.innerHTML = `
          <div class="task-card-header">
            <span class="card-tag ${tagClass}">${card.tag}</span>
            ${cardTopRightBadge}
          </div>
          <h4 class="task-card-title">${card.title}</h4>
          ${card.description ? `<p class="task-card-desc">${card.description}</p>` : ''}
          ${progressBarHTML}
          <div class="task-card-footer">
            ${timeBadgeHTML}
            <div class="card-avatars">
              ${avatarsHTML}
            </div>
          </div>
        `;

        // Card Click handler (except double-clicks or dragging)
        cardEl.addEventListener('click', (e) => {
          // Avoid clicking modal on drag
          if (e.target.closest('.card-time-badge') && isStopwatchRunning) {
            store.toggleStopwatch(card.id);
            return;
          }
          openCardDetailModal(card.id);
        });

        cardsContainer.appendChild(cardEl);
      });

      kanbanBoardCanvas.appendChild(columnEl);
    });
  }

  // Render add-column helper at the end
  const addColCard = document.createElement('button');
  addColCard.className = 'btn-add-column-card';
  addColCard.id = 'btn-board-add-column';
  addColCard.innerHTML = `
    <i data-lucide="plus" style="width: 18px; height: 18px;"></i>
    <span>Add Column</span>
  `;
  kanbanBoardCanvas.appendChild(addColCard);

  // 3. Update Pomodoro Widget Header displays
  const minutes = Math.floor(state.pomodoro.timer / 60);
  const seconds = state.pomodoro.timer % 60;
  const timerString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  pomodoroDisplayTime.innerText = timerString;
  if (state.pomodoro.isRunning) {
    pomodoroWidgetBtn.classList.add('running');
  } else {
    pomodoroWidgetBtn.classList.remove('running');
  }

  // 4. Update the Pomodoro Control Modal if active
  if (modalPomodoroController.classList.contains('active')) {
    updatePomodoroControlModalDisplay();
  }

  // 5. Update the Card Detail Modal if active
  if (modalCardDetail.classList.contains('active')) {
    updateCardDetailModalDisplay();
  }

  // Re-bind click actions for newly generated elements
  bindDynamicEvents();
  lucide.createIcons();
}

// Bind events to dynamically rendered nodes
function bindDynamicEvents() {
  // Columns Inline Title Renaming
  document.querySelectorAll('.column-title').forEach(titleSpan => {
    titleSpan.addEventListener('dblclick', function() {
      const colId = this.getAttribute('data-col-title-id');
      const currentText = this.innerText;
      
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'inline-edit-input';
      input.value = currentText;
      
      this.replaceWith(input);
      input.focus();

      const saveRename = () => {
        const val = input.value.trim();
        if (val) {
          store.renameColumn(colId, val);
          showToast(`Column renamed to "${val}"`);
        } else {
          render(); // Revert
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') render();
      });
      input.addEventListener('blur', saveRename);
    });
  });

  // Column Menu delete triggers
  document.querySelectorAll('.column-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const colId = btn.getAttribute('data-col-menu-id');
      const board = store.getActiveBoard();
      const col = board.columns.find(c => c.id === colId);
      
      if (confirm(`Are you sure you want to delete column "${col.name}" and all its tasks?`)) {
        store.deleteColumn(colId);
        showToast(`Column "${col.name}" deleted.`);
      }
    });
  });

  // Column Add task placeholder buttons
  document.querySelectorAll('.btn-add-task-placeholder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const colId = btn.getAttribute('data-col-add-id');
      const newCard = store.addCard(colId, { title: "New Task", tag: "PLANNING", tagColor: "planning" });
      if (newCard) {
        openCardDetailModal(newCard.id);
      }
    });
  });

  // Main canvas Add Column button
  const btnAddCol = document.getElementById('btn-board-add-column');
  if (btnAddCol) {
    btnAddCol.addEventListener('click', () => {
      const name = prompt("Enter new column name:");
      if (name && name.trim()) {
        store.addColumn(name.trim());
        showToast(`Column "${name.trim()}" added.`);
      }
    });
  }

  // Drag and Drop implementation
  setupDragAndDrop();
}

// Drag and drop helper engine
function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card');
  const containers = document.querySelectorAll('.cards-container');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.getAttribute('data-card-id'));
      dragSrcColumnId = card.closest('.cards-container').getAttribute('data-col-id');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      // Clear placeholder indicators
      document.querySelectorAll('.drag-placeholder').forEach(p => p.remove());
      document.querySelectorAll('.cards-container').forEach(c => c.classList.remove('drag-over'));
    });
  });

  containers.forEach(container => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');

      // Create or reposition placeholder element
      let placeholder = container.querySelector('.drag-placeholder');
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
      }

      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(placeholder);
      } else {
        container.insertBefore(placeholder, afterElement);
      }
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
      const placeholder = container.querySelector('.drag-placeholder');
      if (placeholder) placeholder.remove();
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      
      const cardId = e.dataTransfer.getData('text/plain');
      const targetColId = container.getAttribute('data-col-id');
      
      // Calculate drops index
      const placeholder = container.querySelector('.drag-placeholder');
      const childArray = [...container.querySelectorAll('.task-card:not(.dragging)')];
      let targetIndex = childArray.length;

      if (placeholder) {
        const placeholderIdx = [...container.children].indexOf(placeholder);
        // Map placeholder position index back to index relative only to other cards
        let idxCounter = 0;
        for (let i = 0; i < placeholderIdx; i++) {
          if (container.children[i].classList.contains('task-card') && !container.children[i].classList.contains('dragging')) {
            idxCounter++;
          }
        }
        targetIndex = idxCounter;
        placeholder.remove();
      }

      if (cardId) {
        store.moveCard(cardId, targetColId, targetIndex);
        showToast("Task updated.");
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ==========================================
// CARD DETAILS MODAL ACTION BINDINGS
// ==========================================
function openCardDetailModal(cardId) {
  cardIdInput.value = cardId;
  openModal(modalCardDetail);
}

function updateCardDetailModalDisplay() {
  const cardId = cardIdInput.value;
  if (!cardId) return;

  const board = store.getActiveBoard();
  let card = null;
  for (let col of board.columns) {
    card = col.cards.find(c => c.id === cardId);
    if (card) break;
  }

  if (!card) {
    closeModal(modalCardDetail);
    return;
  }

  // Title, category, details
  cardTitleInput.value = card.title;
  cardTagInput.value = card.tag;
  cardDescInput.value = card.description || '';

  // Render members selection list
  const allMembers = store.getMembers();
  cardMembersList.innerHTML = '';
  Object.keys(allMembers).forEach(memberKey => {
    const isSelected = card.members.includes(memberKey);
    const pill = document.createElement('div');
    pill.className = `member-select-pill ${isSelected ? 'selected' : ''}`;
    pill.innerHTML = `
      <div class="member-select-avatar">
        <img src="${allMembers[memberKey].avatar}" alt="${allMembers[memberKey].name}">
      </div>
      <span>${allMembers[memberKey].name}</span>
    `;

    pill.addEventListener('click', () => {
      let updatedMembers = [...card.members];
      if (isSelected) {
        updatedMembers = updatedMembers.filter(m => m !== memberKey);
      } else {
        updatedMembers.push(memberKey);
      }
      store.updateCard(cardId, { members: updatedMembers });
    });

    cardMembersList.appendChild(pill);
  });

  // Stopwatch panel sync
  const isActiveStopwatch = store.state.activeStopwatchCardId === cardId;
  stopwatchStatusLabel.innerText = isActiveStopwatch ? "Stopwatch Active" : "Stopwatch Paused";
  stopwatchDisplay.innerText = formatStopwatchTime(card.timeSpent);
  
  const iconPlay = document.getElementById('icon-modal-stopwatch-play');
  if (isActiveStopwatch) {
    iconPlay.setAttribute('data-lucide', 'pause');
    btnModalStopwatchToggle.classList.add('active-running');
  } else {
    iconPlay.setAttribute('data-lucide', 'play');
    btnModalStopwatchToggle.classList.remove('active-running');
  }
  lucide.createIcons();

  // Render History log lists
  modalHistoryLogs.innerHTML = '';
  if (card.history && card.history.length > 0) {
    // Show newest first
    [...card.history].reverse().forEach(log => {
      const logEl = document.createElement('div');
      logEl.className = `history-log-item ${log.type === 'pomodoro' ? 'pomodoro-log' : log.type === 'manual' ? 'manual-log' : ''}`;
      
      const formatedDate = new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      logEl.innerHTML = `
        <span class="history-log-note">${log.note}</span>
        <span class="history-log-date">${formatedDate}</span>
      `;
      modalHistoryLogs.appendChild(logEl);
    });
  } else {
    modalHistoryLogs.innerHTML = `<p style="font-size: 13px; color: var(--color-text-muted);">No tracked sessions yet.</p>`;
  }
}

// Card details Stopwatch controllers
btnModalStopwatchToggle.addEventListener('click', (e) => {
  e.preventDefault();
  const cardId = cardIdInput.value;
  if (cardId) {
    store.toggleStopwatch(cardId);
    showToast(store.state.activeStopwatchCardId ? "Stopwatch tracker started." : "Stopwatch paused.");
  }
});

btnModalStopwatchAdd.addEventListener('click', (e) => {
  e.preventDefault();
  const cardId = cardIdInput.value;
  if (cardId) {
    store.addTimeToCard(cardId, 15 * 60, 'manual'); // Add 15 mins
    showToast("Added 15 minutes manual work.");
  }
});

btnModalStopwatchSub.addEventListener('click', (e) => {
  e.preventDefault();
  const cardId = cardIdInput.value;
  if (cardId) {
    store.addTimeToCard(cardId, -15 * 60, 'manual'); // Subtract 15 mins
    showToast("Subtracted 15 minutes manual work.");
  }
});

// Card details Form Submission saves Title, Description, and Tag
cardDetailForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const cardId = cardIdInput.value;
  if (!cardId) return;

  const newTitle = cardTitleInput.value.trim();
  const newTag = cardTagInput.value;
  const newDesc = cardDescInput.value.trim();
  
  // Custom Tag color matches selector
  let newTagColor = 'planning';
  if (newTag === 'DESIGN') newTagColor = 'design';
  if (newTag === 'RESEARCH') newTagColor = 'research';
  if (newTag === 'DEV') newTagColor = 'dev';

  store.updateCard(cardId, {
    title: newTitle || "New Task",
    tag: newTag,
    tagColor: newTagColor,
    description: newDesc
  });
  
  showToast("Task updated successfully.");
  closeModal(modalCardDetail);
});

// Delete Card Button inside Detail Modal
btnModalDeleteCard.addEventListener('click', (e) => {
  e.preventDefault();
  const cardId = cardIdInput.value;
  if (cardId && confirm("Are you sure you want to delete this task?")) {
    store.deleteCard(cardId);
    showToast("Task deleted.");
    closeModal(modalCardDetail);
  }
});


// ==========================================
// BOARD MANAGER ACTIONS
// ==========================================
boardSelectorBtn.addEventListener('click', () => {
  openModal(modalBoardManager);
  renderBoardManagerList();
});

function renderBoardManagerList() {
  const state = store.state;
  boardSelectionList.innerHTML = '';
  
  state.boards.forEach(b => {
    const isCurrent = b.id === state.activeBoardId;
    const row = document.createElement('div');
    row.style = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 12px;
      background: ${isCurrent ? '#FCE7F3' : 'rgba(255, 255, 255, 0.5)'};
      border: 1px solid ${isCurrent ? 'var(--color-primary-pink)' : 'rgba(74, 62, 61, 0.1)'};
    `;

    row.innerHTML = `
      <div style="cursor: pointer; flex: 1; font-weight: ${isCurrent ? '600' : '400'};" class="board-select-row-name">
        ${b.name}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-icon-control btn-rename-board" style="width: 28px; height: 28px;" title="Rename Board">
          <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i>
        </button>
        <button class="btn-icon-control btn-delete-board" style="width: 28px; height: 28px; color: #DC2626;" title="Delete Board">
          <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;

    // Click to select board
    row.querySelector('.board-select-row-name').addEventListener('click', () => {
      store.setActiveBoard(b.id);
      showToast(`Switched workspace to "${b.name}"`);
      closeModal(modalBoardManager);
    });

    // Click to rename
    row.querySelector('.btn-rename-board').addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = prompt(`Rename board "${b.name}" to:`, b.name);
      if (newName && newName.trim()) {
        store.renameBoard(b.id, newName.trim());
        showToast(`Board renamed to "${newName.trim()}"`);
        renderBoardManagerList();
      }
    });

    // Click to delete
    row.querySelector('.btn-delete-board').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete board "${b.name}"? This action is permanent and deletes all columns and tasks inside.`)) {
        store.deleteBoard(b.id);
        showToast("Board deleted.");
        renderBoardManagerList();
      }
    });

    boardSelectionList.appendChild(row);
  });
  lucide.createIcons();
}

formCreateBoard.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = newBoardNameInput.value.trim();
  if (name) {
    store.addBoard(name);
    newBoardNameInput.value = '';
    showToast(`Board "${name}" created.`);
    closeModal(modalBoardManager);
  }
});


// ==========================================
// POMODORO TIMER PANEL WIDGET
// ==========================================
pomodoroWidgetBtn.addEventListener('click', () => {
  openModal(modalPomodoroController);
  updatePomodoroControlModalDisplay();
});

function updatePomodoroControlModalDisplay() {
  const p = store.state.pomodoro;
  const board = store.getActiveBoard();

  // Draw Timer text
  const minutes = Math.floor(p.timer / 60);
  const seconds = p.timer % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  pomodoroLargeTime.innerText = timeStr;

  // Set Focus/Break titles
  pomodoroModeLabel.innerText = p.isBreak ? "Break Time" : "Focus Session";
  pomodoroModeLabel.style.color = p.isBreak ? "#10B981" : "var(--color-accent-orange)";

  // Draw Play button icon
  const icon = document.getElementById('icon-pomodoro-play');
  if (p.isRunning) {
    icon.setAttribute('data-lucide', 'pause');
    btnPomodoroPlay.classList.add('active-running');
  } else {
    icon.setAttribute('data-lucide', 'play');
    btnPomodoroPlay.classList.remove('active-running');
  }
  lucide.createIcons();

  // Durations settings defaults
  settingWorkTime.value = Math.round(p.settings.workDuration / 60);
  settingBreakTime.value = Math.round(p.settings.breakDuration / 60);

  // Link select option builder
  pomodoroLinkSelect.innerHTML = '<option value="">(None - Persistent Countdown)</option>';
  if (board && board.columns) {
    board.columns.forEach(col => {
      col.cards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card.id;
        opt.innerText = `[${col.name}] ${card.title}`;
        if (p.linkedCardId === card.id) {
          opt.selected = true;
        }
        pomodoroLinkSelect.appendChild(opt);
      });
    });
  }
}

// Pomodoro Timer Interactions
btnPomodoroPlay.addEventListener('click', (e) => {
  e.preventDefault();
  const p = store.state.pomodoro;
  if (p.isRunning) {
    store.pausePomodoro();
    showToast("Pomodoro timer paused.");
  } else {
    // Start Pomodoro and link selected card
    const cardId = pomodoroLinkSelect.value;
    store.startPomodoro(cardId || null);
    showToast("Focus Pomodoro started.");
  }
});

btnPomodoroReset.addEventListener('click', (e) => {
  e.preventDefault();
  store.resetPomodoro();
  showToast("Pomodoro timer reset.");
});

pomodoroLinkSelect.addEventListener('change', (e) => {
  const cardId = e.target.value;
  store.linkCardToPomodoro(cardId || null);
  showToast(cardId ? "Linked Pomodoro to active card." : "Unlinked card from Pomodoro.");
});

pomodoroSettingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const wMin = parseInt(settingWorkTime.value);
  const bMin = parseInt(settingBreakTime.value);
  if (wMin > 0 && bMin > 0) {
    store.configurePomodoro(wMin, bMin);
    showToast("New timer settings applied.");
  }
});


// ==========================================
// NEW TASK ACTIONS
// ==========================================
function triggerNewTaskFlow() {
  const board = store.getActiveBoard();
  if (board && board.columns && board.columns.length > 0) {
    const targetCol = board.columns[0]; // Add to first column (normally TODO)
    const newCard = store.addCard(targetCol.id, { title: "New Task", tag: "PLANNING", tagColor: "planning" });
    if (newCard) {
      openCardDetailModal(newCard.id);
      showToast(`Created task in "${targetCol.name}"`);
    }
  } else {
    alert("Please create a column first before adding a task.");
  }
}

btnSidebarNewTask.addEventListener('click', triggerNewTaskFlow);
btnFloatingNewTask.addEventListener('click', triggerNewTaskFlow);

// Settings button triggers Pomodoro configure for user ease
btnSettings.addEventListener('click', () => {
  openModal(modalPomodoroController);
  updatePomodoroControlModalDisplay();
});


// Initialize Application
store.subscribe(render);
render(); // First Draw
showToast("Welcome back to Fokus!");
