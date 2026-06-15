// Focus State Management Store
// Implements local storage persistence, Pomodoro timer state, and a pub/sub model for UI reactivity.

const DEFAULT_MEMBERS = {
  "bob": { name: "Bob", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80" },
  "alice": { name: "Alice", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80" },
  "charlie": { name: "Charlie", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120&q=80" }
};

class StateStore {
  constructor() {
    this.subscribers = [];
    this.loadState();
    
    // Start the global tick timer for Pomodoro and Stopwatches
    setInterval(() => this.tick(), 1000);
  }
  
  subscribe(callback) {
    this.subscribers.push(callback);
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  notify() {
    this.saveState();
    this.subscribers.forEach(cb => cb(this.state));
  }
  
  loadState() {
    const saved = localStorage.getItem('focus_app_state');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        // Ensure active runners are paused on fresh reload to avoid drift or double-timers
        this.state.pomodoro.isRunning = false;
        this.state.activeStopwatchCardId = null;
        return;
      } catch (e) {
        console.error("Failed to parse saved state, resetting...", e);
      }
    }
    
    // Default initial state matching the spec and screenshot layout
    this.state = {
      boards: [
        {
          id: "board-1",
          name: "My Board",
          columns: [
            {
              id: "col-todo",
              name: "TODO",
              cards: [
                {
                  id: "card-1",
                  title: "Review Q4 Goals",
                  description: "Discuss Q4 objectives, roadmap milestones, and alignment across team divisions.",
                  tag: "PLANNING",
                  tagColor: "planning",
                  timeSpent: 5100, // 1h 25m
                  members: ["bob"],
                  completed: false,
                  history: [{ date: new Date().toISOString(), type: 'manual', note: 'Initial time set: 1h 25m' }]
                },
                {
                  id: "card-2",
                  title: "Design System Update",
                  description: "Refactor typography scale, component layouts, and border styling guidelines.",
                  tag: "DESIGN",
                  tagColor: "design",
                  timeSpent: 2700, // 45m
                  members: ["alice", "bob"],
                  completed: false,
                  history: [{ date: new Date().toISOString(), type: 'manual', note: 'Initial time set: 45m' }]
                }
              ]
            },
            {
              id: "col-doing",
              name: "DOING",
              cards: [
                {
                  id: "card-3",
                  title: "High-fidelity Mockups",
                  description: "Finalizing the tactile surface treatments and glassmorphic elements for the web layout.",
                  tag: "DESIGN",
                  tagColor: "design",
                  timeSpent: 1122, // 18m 42s
                  members: ["bob"],
                  completed: false,
                  history: [{ date: new Date().toISOString(), type: 'manual', note: 'Initial time set: 18m 42s' }]
                }
              ]
            },
            {
              id: "col-done",
              name: "DONE",
              cards: [
                {
                  id: "card-4",
                  title: "User Interview Synthesis",
                  description: "Summarize findings from research sessions, map insights, and export conclusions.",
                  tag: "RESEARCH",
                  tagColor: "research",
                  timeSpent: 7200, // 2h
                  members: ["charlie"],
                  completed: true,
                  history: [{ date: new Date().toISOString(), type: 'manual', note: 'Initial time set: 2h' }]
                }
              ]
            }
          ]
        }
      ],
      activeBoardId: "board-1",
      pomodoro: {
        timer: 1500, // 25 min default
        duration: 1500,
        isRunning: false,
        linkedCardId: "card-3", // default link to Doing card
        isBreak: false,
        settings: {
          workDuration: 1500,
          breakDuration: 300
        }
      },
      activeStopwatchCardId: null
    };
    this.saveState();
  }
  
  saveState() {
    localStorage.setItem('focus_app_state', JSON.stringify(this.state));
  }

  // Getters
  getBoards() {
    return this.state.boards;
  }

  getActiveBoard() {
    return this.state.boards.find(b => b.id === this.state.activeBoardId) || this.state.boards[0];
  }

  getMembers() {
    return DEFAULT_MEMBERS;
  }

  // Board management
  addBoard(name) {
    const id = 'board-' + Date.now();
    const newBoard = {
      id,
      name: name || "Untitled Board",
      columns: [
        { id: 'col-todo-' + Date.now(), name: "TODO", cards: [] },
        { id: 'col-doing-' + Date.now(), name: "DOING", cards: [] },
        { id: 'col-done-' + Date.now(), name: "DONE", cards: [] }
      ]
    };
    this.state.boards.push(newBoard);
    this.state.activeBoardId = id;
    this.notify();
  }

  deleteBoard(id) {
    if (this.state.boards.length <= 1) {
      alert("You must keep at least one project board.");
      return;
    }
    this.state.boards = this.state.boards.filter(b => b.id !== id);
    if (this.state.activeBoardId === id) {
      this.state.activeBoardId = this.state.boards[0].id;
    }
    this.notify();
  }

  renameBoard(id, name) {
    const board = this.state.boards.find(b => b.id === id);
    if (board && name.trim()) {
      board.name = name.trim();
      this.notify();
    }
  }

  setActiveBoard(id) {
    this.state.activeBoardId = id;
    // Reset transient timers on board switch
    this.state.activeStopwatchCardId = null;
    this.notify();
  }

  // Column management
  addColumn(name) {
    const board = this.getActiveBoard();
    if (!board) return;
    board.columns.push({
      id: 'col-' + Date.now(),
      name: name || "New Column",
      cards: []
    });
    this.notify();
  }

  deleteColumn(colId) {
    const board = this.getActiveBoard();
    if (!board) return;
    board.columns = board.columns.filter(col => col.id !== colId);
    this.notify();
  }

  renameColumn(colId, name) {
    const board = this.getActiveBoard();
    if (!board) return;
    const col = board.columns.find(c => c.id === colId);
    if (col && name.trim()) {
      col.name = name.trim();
      this.notify();
    }
  }

  // Card management
  addCard(colId, fields = {}) {
    const board = this.getActiveBoard();
    if (!board) return;
    const col = board.columns.find(c => c.id === colId);
    if (!col) return;

    const newCard = {
      id: 'card-' + Date.now(),
      title: fields.title || "New Task",
      description: fields.description || "",
      tag: fields.tag || "PLANNING",
      tagColor: fields.tagColor || "planning",
      timeSpent: fields.timeSpent || 0,
      members: fields.members || ["bob"],
      completed: false,
      history: [{ date: new Date().toISOString(), type: 'create', note: 'Task created' }]
    };

    col.cards.push(newCard);
    this.notify();
    return newCard;
  }

  updateCard(cardId, fields) {
    const board = this.getActiveBoard();
    if (!board) return;
    
    for (let col of board.columns) {
      const card = col.cards.find(c => c.id === cardId);
      if (card) {
        // Track log if manual time was edited or state completed
        if (fields.timeSpent !== undefined && fields.timeSpent !== card.timeSpent) {
          const diff = fields.timeSpent - card.timeSpent;
          card.history.push({
            date: new Date().toISOString(),
            type: 'manual',
            note: `Manual adjustment: ${diff >= 0 ? '+' : ''}${Math.round(diff/60)}m`
          });
        }
        if (fields.completed !== undefined && fields.completed !== card.completed) {
          card.history.push({
            date: new Date().toISOString(),
            type: 'status',
            note: fields.completed ? 'Task completed' : 'Task reopened'
          });
        }
        
        Object.assign(card, fields);
        this.notify();
        return;
      }
    }
  }

  deleteCard(cardId) {
    const board = this.getActiveBoard();
    if (!board) return;

    if (this.state.activeStopwatchCardId === cardId) {
      this.state.activeStopwatchCardId = null;
    }
    if (this.state.pomodoro.linkedCardId === cardId) {
      this.state.pomodoro.linkedCardId = null;
      this.state.pomodoro.isRunning = false;
    }

    for (let col of board.columns) {
      const idx = col.cards.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        col.cards.splice(idx, 1);
        this.notify();
        return;
      }
    }
  }

  moveCard(cardId, targetColId, targetIndex) {
    const board = this.getActiveBoard();
    if (!board) return;

    let sourceCard = null;
    for (let col of board.columns) {
      const idx = col.cards.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        sourceCard = col.cards[idx];
        col.cards.splice(idx, 1);
        break;
      }
    }

    if (!sourceCard) return;

    const targetCol = board.columns.find(c => c.id === targetColId);
    if (!targetCol) return;

    // Auto-mark completed if moving to DONE (case-insensitive)
    if (targetCol.name.toUpperCase() === 'DONE') {
      sourceCard.completed = true;
    } else if (sourceCard.completed) {
      sourceCard.completed = false;
    }

    if (targetIndex === undefined || targetIndex === null) {
      targetCol.cards.push(sourceCard);
    } else {
      targetCol.cards.splice(targetIndex, 0, sourceCard);
    }

    this.notify();
  }

  // Pomodoro timer control
  startPomodoro(cardId = null) {
    this.state.pomodoro.isRunning = true;
    if (cardId) {
      this.state.pomodoro.linkedCardId = cardId;
      // Pause manual stopwatch to prevent multi-tracking
      this.state.activeStopwatchCardId = null;
    }
    this.notify();
  }

  pausePomodoro() {
    this.state.pomodoro.isRunning = false;
    this.notify();
  }

  resetPomodoro() {
    this.state.pomodoro.isRunning = false;
    const duration = this.state.pomodoro.isBreak
      ? this.state.pomodoro.settings.breakDuration
      : this.state.pomodoro.settings.workDuration;
    this.state.pomodoro.timer = duration;
    this.state.pomodoro.duration = duration;
    this.notify();
  }

  configurePomodoro(workMin, breakMin) {
    this.state.pomodoro.settings.workDuration = workMin * 60;
    this.state.pomodoro.settings.breakDuration = breakMin * 60;
    this.resetPomodoro();
  }

  linkCardToPomodoro(cardId) {
    this.state.pomodoro.linkedCardId = cardId;
    this.notify();
  }

  // Stopwatch manual control
  toggleStopwatch(cardId) {
    if (this.state.activeStopwatchCardId === cardId) {
      this.state.activeStopwatchCardId = null;
    } else {
      this.state.activeStopwatchCardId = cardId;
      // Pause Pomodoro timer if stopwatch starts
      this.state.pomodoro.isRunning = false;
    }
    this.notify();
  }

  addTimeToCard(cardId, seconds, type = 'manual') {
    const board = this.getActiveBoard();
    if (!board) return;

    for (let col of board.columns) {
      const card = col.cards.find(c => c.id === cardId);
      if (card) {
        card.timeSpent = Math.max(0, card.timeSpent + seconds);
        if (type === 'pomodoro') {
          card.history.push({
            date: new Date().toISOString(),
            type: 'pomodoro',
            note: `Pomodoro session completed: +${Math.round(seconds / 60)}m`
          });
        }
        return;
      }
    }
  }

  tick() {
    let changed = false;

    // 1. Tick Pomodoro
    if (this.state.pomodoro.isRunning) {
      if (this.state.pomodoro.timer > 0) {
        this.state.pomodoro.timer--;
        changed = true;
      } else {
        // Timer reached 0
        this.state.pomodoro.isRunning = false;
        
        const linkedId = this.state.pomodoro.linkedCardId;
        const wasBreak = this.state.pomodoro.isBreak;
        
        if (linkedId && !wasBreak) {
          // Pomodoro work session completed, award time
          const workTime = this.state.pomodoro.settings.workDuration;
          this.addTimeToCard(linkedId, workTime, 'pomodoro');
        }

        // Toggle work/break mode
        this.state.pomodoro.isBreak = !wasBreak;
        const nextDuration = this.state.pomodoro.isBreak
          ? this.state.pomodoro.settings.breakDuration
          : this.state.pomodoro.settings.workDuration;
          
        this.state.pomodoro.timer = nextDuration;
        this.state.pomodoro.duration = nextDuration;

        changed = true;

        // Visual notification
        setTimeout(() => {
          // Play audio beep
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(600, audioCtx.currentTime); // Hz
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
          } catch(e) {}
          alert(wasBreak ? "Break is over! Time to start focusing." : "Focus session finished! Enjoy your break.");
        }, 50);
      }
    }

    // 2. Tick Manual Stopwatch
    if (this.state.activeStopwatchCardId) {
      this.addTimeToCard(this.state.activeStopwatchCardId, 1, 'stopwatch');
      changed = true;
    }

    if (changed) {
      this.notify();
    }
  }
}

// Export singleton instance
const store = new StateStore();
window.store = store; // Make globally accessible
export default store;
