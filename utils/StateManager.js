// StateManager.js - Centralized state management
class StateManager {
  constructor() {
    this.state = {};
    this.subscribers = new Map();
    this.middlewares = [];
    this.history = [];
    this.historyLimit = 100;
  }

  // Initialize state with default values
  init(initialState = {}) {
    this.state = { ...initialState };
    this.notifySubscribers("*", this.state);
  }

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  // Dispatch action to modify state
  dispatch(action) {
    try {
      // Apply middlewares
      const enhancedAction = this.applyMiddlewares(action);

      // Execute action
      const prevState = { ...this.state };
      const nextState = this.reducer(prevState, enhancedAction);

      // Update state
      this.state = nextState;

      // Add to history
      this.addToHistory({
        action: enhancedAction,
        prevState,
        nextState,
        timestamp: Date.now(),
      });

      // Notify subscribers
      this.notifySubscribers(
        enhancedAction.type,
        nextState,
        prevState,
        enhancedAction,
      );

      return true;
    } catch (error) {
      console.error("Error in dispatch:", error);
      return false;
    }
  }

  // Add middleware
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  // Remove middleware
  removeMiddleware(middleware) {
    const index = this.middlewares.indexOf(middleware);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
    }
  }

  // Get current state
  getState(key = null) {
    if (key) {
      return this.state[key];
    }
    return { ...this.state };
  }

  // Private methods
  applyMiddlewares(action) {
    return this.middlewares.reduce(
      (enhancedAction, middleware) => middleware(enhancedAction),
      action,
    );
  }

  reducer(state, action) {
    switch (action.type) {
      case "SET_STATE":
        return {
          ...state,
          [action.key]: action.value,
        };

      case "MERGE_STATE":
        return {
          ...state,
          ...action.values,
        };

      case "DELETE_STATE": {
        let deleted = false;
        const key = action.key;
        if (Object.prototype.hasOwnProperty.call(this.state, key)) {
          delete this.state[key];
          deleted = true;
        }
        return deleted;
      }
      // unreachable code removed

      case "RESET_STATE":
        return {};

      default:
        if (action.reducer) {
          return action.reducer(state);
        }
        return state;
    }
  }

  notifySubscribers(type, nextState, prevState = null, action = null) {
    // Notify specific subscribers
    const specificSubscribers = this.subscribers.get(type);
    if (specificSubscribers) {
      specificSubscribers.forEach((callback) => {
        try {
          callback(nextState, prevState, action);
        } catch (error) {
          console.error("Error in subscriber callback:", error);
        }
      });
    }

    // Notify global subscribers
    const globalSubscribers = this.subscribers.get("*");
    if (globalSubscribers) {
      globalSubscribers.forEach((callback) => {
        try {
          callback(nextState, prevState, action);
        } catch (error) {
          console.error("Error in global subscriber callback:", error);
        }
      });
    }
  }

  addToHistory(entry) {
    this.history.push(entry);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }

  // Time travel debugging (development only)
  getHistory() {
    return [...this.history];
  }

  travelToState(index) {
    if (index >= 0 && index < this.history.length) {
      this.state = { ...this.history[index].nextState };
      this.notifySubscribers("*", this.state);
      return true;
    }
    return false;
  }
}

module.exports = new StateManager();
