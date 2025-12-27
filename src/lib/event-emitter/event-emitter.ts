/**
 * Event with metadata automatically added by EventEmitter
 */
export interface EventWithMetadata<T> {
  /** The original event data */
  data: T;
  /** Timestamp in milliseconds since epoch when the event was emitted */
  timestamp: number;
  /** Sequential number starting from 0, incremented for each event */
  sequence: number;
}

/**
 * Listener function that receives events with metadata
 */
export type EventListener<T> = (event: EventWithMetadata<T>) => void;

/**
 * Unsubscribe function returned from subscribe()
 */
export type Unsubscribe = () => void;

/**
 * A generic event emitter that collects events in memory with automatic timestamping and sequencing,
 * and notifies subscribers in real-time. Useful for tracking events during long-running processes
 * like normalization, where you need both event buffering and real-time notifications.
 *
 * @example
 * ```ts
 * // Basic usage with subscribers
 * const emitter = new EventEmitter<string>();
 *
 * // Subscribe to events
 * const unsubscribe = emitter.subscribe((event) => {
 *   console.log('Event received:', event.data, 'at', event.timestamp);
 *   // Write to database or update UI
 * });
 *
 * // Emit events
 * emitter.emit('event1');
 * emitter.emit('event2');
 *
 * // Get all buffered events
 * const allEvents = emitter.getAllEvents();
 *
 * // Unsubscribe when done
 * unsubscribe();
 * ```
 *
 * @example
 * ```ts
 * // Object events
 * const emitter = new EventEmitter<{ type: string; data: unknown }>();
 *
 * emitter.subscribe((event) => {
 *   if (event.data.type === 'llm_chunk') {
 *     // Handle LLM chunk
 *   }
 * });
 *
 * emitter.emit({ type: 'llm_chunk', data: 'Hello' });
 * emitter.emit({ type: 'tool_call', data: { name: 'query_db' } });
 * ```
 */
export class EventEmitter<T> {
  private events: EventWithMetadata<T>[] = [];
  private sequenceCounter = 0;
  private listeners = new Set<EventListener<T>>();

  /**
   * Emit an event to the buffer and notify all subscribers.
   * Automatically adds a timestamp and sequence number.
   *
   * @param event - The event data to emit
   */
  emit(event: T): void {
    const eventWithMetadata: EventWithMetadata<T> = {
      data: event,
      timestamp: Date.now(),
      sequence: this.sequenceCounter++,
    };

    // Add to buffer
    this.events.push(eventWithMetadata);

    // Notify all subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(eventWithMetadata);
      } catch (error) {
        // Don't let one listener's error break others
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Subscribe to events. The listener will be called immediately for all future events.
   *
   * @param listener - Function to call when events are emitted
   * @returns Unsubscribe function to remove the listener
   */
  subscribe(listener: EventListener<T>): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get all buffered events with their metadata.
   * Returns events in the order they were emitted.
   *
   * @returns Array of events with metadata (timestamp and sequence)
   */
  getAllEvents(): EventWithMetadata<T>[] {
    return [...this.events];
  }

  /**
   * Clear all events from the buffer and reset the sequence counter.
   * Note: This does not remove subscribers.
   */
  clear(): void {
    this.events = [];
    this.sequenceCounter = 0;
  }

  /**
   * Get the number of events currently in the buffer.
   *
   * @returns The count of buffered events
   */
  getCount(): number {
    return this.events.length;
  }

  /**
   * Get the number of active subscribers.
   *
   * @returns The count of subscribed listeners
   */
  getSubscriberCount(): number {
    return this.listeners.size;
  }
}
