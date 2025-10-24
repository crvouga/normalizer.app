#!/bin/bash

# Script to check PostgreSQL connections
# Usage: ./scripts/check-connections.sh

echo "Checking PostgreSQL connections..."

# Get connection count
CONNECTION_COUNT=$(docker exec normalizer-app-db-1 psql -U postgres -d postgres -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ')

if [ $? -eq 0 ]; then
    echo "Current active connections: $CONNECTION_COUNT"
    
    # Show connection details
    echo ""
    echo "Connection details:"
    docker exec normalizer-app-db-1 psql -U postgres -d postgres -c "SELECT pid, usename, application_name, client_addr, state, query_start FROM pg_stat_activity WHERE state != 'idle';"
    
    # Show max connections setting
    MAX_CONNECTIONS=$(docker exec normalizer-app-db-1 psql -U postgres -d postgres -t -c "SHOW max_connections;" 2>/dev/null | tr -d ' ')
    echo ""
    echo "Max connections allowed: $MAX_CONNECTIONS"
    
    # Calculate usage percentage
    if [ "$MAX_CONNECTIONS" -gt 0 ]; then
        USAGE_PERCENT=$((CONNECTION_COUNT * 100 / MAX_CONNECTIONS))
        echo "Connection usage: $USAGE_PERCENT%"
        
        if [ $USAGE_PERCENT -gt 80 ]; then
            echo "⚠️  WARNING: High connection usage detected!"
        elif [ $USAGE_PERCENT -gt 60 ]; then
            echo "⚠️  CAUTION: Moderate connection usage"
        else
            echo "✅ Connection usage is healthy"
        fi
    fi
else
    echo "❌ Failed to connect to PostgreSQL"
    echo "Make sure the database container is running: docker-compose up -d db"
fi
