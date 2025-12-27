import { describe, expect, test, beforeEach } from 'bun:test';
import { EventEmitter, type EventWithMetadata } from './event-emitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter<string>;

  beforeEach(() => {
    emitter = new EventEmitter<string>();
  });

  describe('emit and getAllEvents', () => {
    test('emits events and retrieves them in order', () => {
      emitter.emit('event1');
      emitter.emit('event2');
      emitter.emit('event3');

      const events = emitter.getAllEvents();
      expect(events).toHaveLength(3);
      expect(events[0]!.data).toBe('event1');
      expect(events[1]!.data).toBe('event2');
      expect(events[2]!.data).toBe('event3');
    });

    test('events have metadata (timestamp and sequence)', () => {
      emitter.emit('test');

      const events = emitter.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.data).toBe('test');
      expect(typeof events[0]!.timestamp).toBe('number');
      expect(events[0]!.timestamp).toBeGreaterThan(0);
      expect(events[0]!.sequence).toBe(0);
    });

    test('sequence numbers increment correctly', () => {
      emitter.emit('event1');
      emitter.emit('event2');
      emitter.emit('event3');

      const events = emitter.getAllEvents();
      expect(events[0]!.sequence).toBe(0);
      expect(events[1]!.sequence).toBe(1);
      expect(events[2]!.sequence).toBe(2);
    });

    test('timestamps increase monotonically', () => {
      const before = Date.now();
      emitter.emit('event1');
      emitter.emit('event2');
      const after = Date.now();

      const events = emitter.getAllEvents();
      expect(events[0]!.timestamp).toBeGreaterThanOrEqual(before);
      expect(events[1]!.timestamp).toBeGreaterThanOrEqual(events[0]!.timestamp);
      expect(events[1]!.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('subscribe', () => {
    test('subscriber receives events when emitted', () => {
      const receivedEvents: EventWithMetadata<string>[] = [];
      emitter.subscribe((event) => {
        receivedEvents.push(event);
      });

      emitter.emit('event1');
      emitter.emit('event2');

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0]!.data).toBe('event1');
      expect(receivedEvents[1]!.data).toBe('event2');
    });

    test('subscriber receives events with correct metadata', () => {
      let receivedEvent: EventWithMetadata<string> | null = null;
      emitter.subscribe((event) => {
        receivedEvent = event;
      });

      emitter.emit('test');

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.data).toBe('test');
      expect(receivedEvent!.sequence).toBe(0);
      expect(typeof receivedEvent!.timestamp).toBe('number');
    });

    test('multiple subscribers all receive events', () => {
      const received1: EventWithMetadata<string>[] = [];
      const received2: EventWithMetadata<string>[] = [];

      emitter.subscribe((event) => {
        received1.push(event);
      });
      emitter.subscribe((event) => {
        received2.push(event);
      });

      emitter.emit('event1');
      emitter.emit('event2');

      expect(received1).toHaveLength(2);
      expect(received2).toHaveLength(2);
      expect(received1[0]!.data).toBe('event1');
      expect(received2[0]!.data).toBe('event1');
    });

    test('unsubscribe removes listener', () => {
      const receivedEvents: EventWithMetadata<string>[] = [];
      const unsubscribe = emitter.subscribe((event) => {
        receivedEvents.push(event);
      });

      emitter.emit('event1');
      unsubscribe();
      emitter.emit('event2');

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]!.data).toBe('event1');
    });

    test('unsubscribe can be called multiple times safely', () => {
      const receivedEvents: EventWithMetadata<string>[] = [];
      const unsubscribe = emitter.subscribe((event) => {
        receivedEvents.push(event);
      });

      unsubscribe();
      unsubscribe(); // Should not throw
      unsubscribe(); // Should not throw

      emitter.emit('event1');
      expect(receivedEvents).toHaveLength(0);
    });

    test('subscriber errors do not break other subscribers', () => {
      const receivedEvents: EventWithMetadata<string>[] = [];
      let errorThrown = false;

      emitter.subscribe(() => {
        throw new Error('Test error');
      });
      emitter.subscribe((event) => {
        receivedEvents.push(event);
      });

      try {
        emitter.emit('event1');
      } catch (error) {
        errorThrown = true;
      }

      // Error should be caught internally, not thrown
      expect(errorThrown).toBe(false);
      // Other subscriber should still receive the event
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]!.data).toBe('event1');
    });
  });

  describe('clear', () => {
    test('clear removes all events', () => {
      emitter.emit('event1');
      emitter.emit('event2');
      expect(emitter.getCount()).toBe(2);

      emitter.clear();
      expect(emitter.getCount()).toBe(0);
      expect(emitter.getAllEvents()).toHaveLength(0);
    });

    test('clear resets sequence counter', () => {
      emitter.emit('event1');
      emitter.emit('event2');
      emitter.clear();

      emitter.emit('event3');
      const events = emitter.getAllEvents();
      expect(events[0]!.sequence).toBe(0);
    });

    test('clear does not remove subscribers', () => {
      const receivedEvents: EventWithMetadata<string>[] = [];
      emitter.subscribe((event) => {
        receivedEvents.push(event);
      });

      emitter.emit('event1');
      emitter.clear();
      emitter.emit('event2');

      expect(receivedEvents).toHaveLength(2);
      expect(emitter.getCount()).toBe(1);
    });
  });

  describe('getCount', () => {
    test('returns correct count of events', () => {
      expect(emitter.getCount()).toBe(0);
      emitter.emit('event1');
      expect(emitter.getCount()).toBe(1);
      emitter.emit('event2');
      expect(emitter.getCount()).toBe(2);
      emitter.clear();
      expect(emitter.getCount()).toBe(0);
    });
  });

  describe('getSubscriberCount', () => {
    test('returns correct count of subscribers', () => {
      expect(emitter.getSubscriberCount()).toBe(0);
      const unsubscribe1 = emitter.subscribe(() => {});
      expect(emitter.getSubscriberCount()).toBe(1);
      const unsubscribe2 = emitter.subscribe(() => {});
      expect(emitter.getSubscriberCount()).toBe(2);
      unsubscribe1();
      expect(emitter.getSubscriberCount()).toBe(1);
      unsubscribe2();
      expect(emitter.getSubscriberCount()).toBe(0);
    });
  });

  describe('type safety with different event types', () => {
    test('works with string events', () => {
      const stringEmitter = new EventEmitter<string>();
      stringEmitter.emit('hello');
      const events = stringEmitter.getAllEvents();
      expect(events[0]!.data).toBe('hello');
      expect(typeof events[0]!.data).toBe('string');
    });

    test('works with number events', () => {
      const numberEmitter = new EventEmitter<number>();
      numberEmitter.emit(42);
      const events = numberEmitter.getAllEvents();
      expect(events[0]!.data).toBe(42);
      expect(typeof events[0]!.data).toBe('number');
    });

    test('works with object events', () => {
      type TestEvent = { type: string; data: unknown };
      const objectEmitter = new EventEmitter<TestEvent>();
      objectEmitter.emit({ type: 'test', data: 'value' });
      const events = objectEmitter.getAllEvents();
      expect(events[0]!.data.type).toBe('test');
      expect(events[0]!.data.data).toBe('value');
    });

    test('works with complex nested objects', () => {
      type ComplexEvent = {
        type: 'llm_chunk' | 'tool_call';
        payload: {
          id: string;
          content: string;
          metadata?: Record<string, unknown>;
        };
      };

      const complexEmitter = new EventEmitter<ComplexEvent>();
      complexEmitter.emit({
        type: 'llm_chunk',
        payload: {
          id: '123',
          content: 'Hello',
          metadata: { source: 'openai' },
        },
      });

      const events = complexEmitter.getAllEvents();
      expect(events[0]!.data.type).toBe('llm_chunk');
      expect(events[0]!.data.payload.id).toBe('123');
      expect(events[0]!.data.payload.metadata?.source).toBe('openai');
    });
  });

  describe('integration scenarios', () => {
    test('simulates database writer subscriber', () => {
      const writtenEvents: EventWithMetadata<string>[] = [];
      emitter.subscribe((event) => {
        // Simulate writing to database
        writtenEvents.push(event);
      });

      emitter.emit('event1');
      emitter.emit('event2');
      emitter.emit('event3');

      expect(writtenEvents).toHaveLength(3);
      expect(writtenEvents.map((e) => e.data)).toEqual(['event1', 'event2', 'event3']);
    });

    test('simulates multiple subscribers (database + UI)', () => {
      const dbEvents: EventWithMetadata<string>[] = [];
      const uiEvents: EventWithMetadata<string>[] = [];

      emitter.subscribe((event) => {
        // Database writer
        dbEvents.push(event);
      });

      emitter.subscribe((event) => {
        // UI updater
        uiEvents.push(event);
      });

      emitter.emit('update');

      expect(dbEvents).toHaveLength(1);
      expect(uiEvents).toHaveLength(1);
      expect(dbEvents[0]!.data).toBe('update');
      expect(uiEvents[0]!.data).toBe('update');
    });

    test('subscriber can unsubscribe mid-stream', () => {
      const receivedEvents: EventWithMetadata<string>[] = [];
      const unsubscribe = emitter.subscribe((event) => {
        receivedEvents.push(event);
        if (event.data === 'stop') {
          unsubscribe();
        }
      });

      emitter.emit('event1');
      emitter.emit('stop');
      emitter.emit('event2');

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0]!.data).toBe('event1');
      expect(receivedEvents[1]!.data).toBe('stop');
    });
  });
});
