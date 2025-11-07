// Generic external store for useSyncExternalStore
type Unsubscribe = () => void;
type Listener = () => void;

export class Store<T> {
  private state: T;
  private listeners = new Set<Listener>();

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState = (): T => {
    return this.state;
  };

  setState = (newState: T): void => {
    this.state = newState;
    this.emitChange();
  };

  updateState = (updater: (state: T) => T): void => {
    this.state = updater(this.state);
    this.emitChange();
  };

  subscribe = (listener: Listener): Unsubscribe => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emitChange = (): void => {
    this.listeners.forEach((listener) => listener());
  };
}