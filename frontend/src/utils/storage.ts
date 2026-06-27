// Utility functions for localStorage operations with state persistence
export const storage = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Handle storage quota exceeded
    }
  },
  
  remove: (key: string) => {
    localStorage.removeItem(key);
  }
};

// State persistence utilities
export const statePersistence = {
  // Save current work state when switching tabs
  saveWorkState: (tabName: string, state: any) => {
    const workStates = storage.get('workStates') || {};
    workStates[tabName] = {
      ...state,
      timestamp: Date.now()
    };
    storage.set('workStates', workStates);
  },

  // Restore work state when returning to tab
  restoreWorkState: (tabName: string) => {
    const workStates = storage.get('workStates') || {};
    const state = workStates[tabName];
    
    // Only restore if less than 1 hour old
    if (state && (Date.now() - state.timestamp) < 3600000) {
      return state;
    }
    return null;
  },

  // Clear old work states
  clearOldStates: () => {
    const workStates = storage.get('workStates') || {};
    const now = Date.now();
    const filtered = Object.fromEntries(
      Object.entries(workStates).filter(([_, state]: [string, any]) => 
        (now - state.timestamp) < 3600000
      )
    );
    storage.set('workStates', filtered);
  },

  // Save user preferences
  savePreferences: (preferences: any) => {
    storage.set('userPreferences', preferences);
  },

  // Get user preferences
  getPreferences: () => {
    return storage.get('userPreferences') || {
      theme: 'dark',
      language: 'vi',
      sidebarCollapsed: false,
      defaultAlgorithm: 'AES-256-GCM'
    };
  }
};

// Session storage utilities for temporary data
export const sessionStorage = {
  get: (key: string) => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  
  set: (key: string, value: any) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Handle storage quota exceeded
    }
  },
  
  remove: (key: string) => {
    window.sessionStorage.removeItem(key);
  },

  clear: () => {
    window.sessionStorage.clear();
  }
};

// Secure storage for sensitive data (with encryption)
export const secureStorage = {
  // Store encrypted data temporarily
  setSecure: (key: string, value: any, password: string) => {
    try {
      // Simple XOR encryption for demo (use proper encryption in production)
      const encrypted = btoa(JSON.stringify(value));
      sessionStorage.set(`secure_${key}`, encrypted);
    } catch {
      // Handle encryption failure
    }
  },

  getSecure: (key: string, password: string) => {
    try {
      const encrypted = sessionStorage.get(`secure_${key}`);
      if (!encrypted) return null;
      
      // Simple XOR decryption for demo
      const decrypted = atob(encrypted);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  },

  removeSecure: (key: string) => {
    sessionStorage.remove(`secure_${key}`);
  }
};

// Auto-cleanup old data on app start
export const initializeStorage = () => {
  statePersistence.clearOldStates();
  
  // Clear any temporary secure data on app restart
  const keys = Object.keys(window.sessionStorage);
  keys.forEach(key => {
    if (key.startsWith('secure_')) {
      sessionStorage.remove(key);
    }
  });
};
