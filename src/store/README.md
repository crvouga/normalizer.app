# Entity Store

A lightweight, type-safe entity management system with automatic indexing support.

## Architecture

The entity store is split into three parts:

1. **`entity-store-library.ts`** - Generic, reusable library code (can be extracted to its own package)
2. **`entity-store-config.ts`** - Application-specific entity and index definitions
3. **`entity-store.tsx`** - Wiring layer that connects everything together

## Adding a New Entity Type

To add a new entity type, update `entity-store-config.ts`:

```typescript
// 1. Add the entity to the EntityStore type
export type EntityStore = {
  entities: {
    // ... existing entities
    products: EntitySlice<ProductId, Product>;
  };
  indexes: {
    // ... existing indexes
  };
};

// 2. Add initial state
export const initialEntityStore: EntityStore = {
  entities: {
    // ... existing entities
    products: {
      byId: {},
      allIds: [],
    },
  },
  indexes: {
    // ... existing indexes
  },
};
```

That's it! No need to modify any reducer logic or action creators.

## Adding a New Index

Indexes are defined declaratively in `entity-store-config.ts`:

```typescript
export const indexDefinitions = {
  // ... existing indexes
  productsByCategory: {
    entityType: 'products' as const,
    definition: {
      getIndexKey: (entity: unknown) => {
        if (
          entity &&
          typeof entity === 'object' &&
          'category_id' in entity &&
          typeof entity.category_id === 'string'
        ) {
          return entity.category_id;
        }
        return undefined;
      },
      getEntityId: (entity: unknown) => {
        if (entity && typeof entity === 'object' && 'id' in entity) {
          return entity.id as string;
        }
        return '';
      },
    } as IndexDefinition<Product>,
  },
};
```

Then add the index to the `EntityStore` type:

```typescript
export type EntityStore = {
  entities: {
    // ... entities
  };
  indexes: {
    // ... existing indexes
    productsByCategory: Record<CategoryId, ProductId[]>;
  };
};
```

The index will be automatically maintained when entities are added!

## Usage

### Basic Operations

```typescript
import { useEntityStore, useEntityStoreSelector } from './store/entity-store';

function MyComponent() {
  const { addEntity, addManyEntities, removeEntity, resetEntity } = useEntityStore();

  // Add a single entity (or update if it already exists)
  addEntity('artifacts', myArtifact);

  // Add multiple entities (or update if they already exist)
  addManyEntities('users', [user1, user2, user3]);

  // Note: addEntity now overrides existing entities, so you can use it for both
  // adding new entities and updating existing ones. Just pass the complete entity.

  // Remove an entity
  removeEntity('artifacts', artifactId);

  // Reset all entities of a type
  resetEntity('artifacts');
}
```

### Querying with Selectors

Use selectors for optimized re-renders:

```typescript
function MyComponent({ artifactId }: { artifactId: ArtifactId }) {
  // Only re-renders when this specific artifact changes
  const artifact = useEntityStoreSelector((state) => state.entities.artifacts.byId[artifactId]);

  // Only re-renders when the user count changes
  const userCount = useEntityStoreSelector((state) => state.entities.users.allIds.length);

  // Using indexes
  const sessionEvents = useEntityStoreSelector((state) => {
    const eventIds = state.indexes.normalizationSessionEventsBySessionId[sessionId] || [];
    return eventIds.map((id) => state.entities.normalizationSessionEvents.byId[id]);
  });
}
```

## Benefits

- **Less Code**: Reduced from 437 lines to ~100 lines in the main file
- **Maintainable**: Generic library code is decoupled from entity definitions
- **Declarative**: Indexes are defined in configuration, not imperative reducer logic
- **Type-Safe**: Full TypeScript support throughout
- **Extensible**: Easy to add new entities and indexes
- **Reusable**: Library code can be extracted to a separate package
- **Performance**: Automatic index maintenance with no manual bookkeeping

## Migration Guide

The API remains the same, so existing code using `useEntityStore()` and `useEntityStoreSelector()` will continue to work without changes.
