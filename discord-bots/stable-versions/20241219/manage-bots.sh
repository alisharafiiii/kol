#!/bin/bash

# Bot Management Script

ENGAGEMENT_BOT_PID_FILE="/tmp/engagement-bot.pid"
ANALYTICS_BOT_PID_FILE="/tmp/analytics-bot.pid"

start_engagement_bot() {
    if [ -f "$ENGAGEMENT_BOT_PID_FILE" ]; then
        PID=$(cat "$ENGAGEMENT_BOT_PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "Engagement bot is already running (PID: $PID)"
            return
        fi
    fi
    
    echo "Starting engagement bot..."
    nohup node discord-bots/engagement-bot.js > discord-bots/engagement-bot.log 2>&1 &
    echo $! > "$ENGAGEMENT_BOT_PID_FILE"
    echo "Engagement bot started (PID: $!)"
}

start_analytics_bot() {
    if [ -f "$ANALYTICS_BOT_PID_FILE" ]; then
        PID=$(cat "$ANALYTICS_BOT_PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "Analytics bot is already running (PID: $PID)"
            return
        fi
    fi
    
    echo "Starting analytics bot..."
    nohup node discord-bots/analytics-bot.js > discord-bots/analytics-bot.log 2>&1 &
    echo $! > "$ANALYTICS_BOT_PID_FILE"
    echo "Analytics bot started (PID: $!)"
}

stop_engagement_bot() {
    if [ -f "$ENGAGEMENT_BOT_PID_FILE" ]; then
        PID=$(cat "$ENGAGEMENT_BOT_PID_FILE")
        echo "Stopping engagement bot (PID: $PID)..."
        kill $PID 2>/dev/null
        rm "$ENGAGEMENT_BOT_PID_FILE"
        echo "Engagement bot stopped"
    else
        echo "Engagement bot is not running"
    fi
}

stop_analytics_bot() {
    if [ -f "$ANALYTICS_BOT_PID_FILE" ]; then
        PID=$(cat "$ANALYTICS_BOT_PID_FILE")
        echo "Stopping analytics bot (PID: $PID)..."
        kill $PID 2>/dev/null
        rm "$ANALYTICS_BOT_PID_FILE"
        echo "Analytics bot stopped"
    else
        echo "Analytics bot is not running"
    fi
}

status() {
    echo "=== Bot Status ==="
    
    if [ -f "$ENGAGEMENT_BOT_PID_FILE" ]; then
        PID=$(cat "$ENGAGEMENT_BOT_PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "✅ Engagement bot: Running (PID: $PID)"
        else
            echo "❌ Engagement bot: Not running (stale PID file)"
        fi
    else
        echo "❌ Engagement bot: Not running"
    fi
    
    if [ -f "$ANALYTICS_BOT_PID_FILE" ]; then
        PID=$(cat "$ANALYTICS_BOT_PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "✅ Analytics bot: Running (PID: $PID)"
        else
            echo "❌ Analytics bot: Not running (stale PID file)"
        fi
    else
        echo "❌ Analytics bot: Not running"
    fi
}

case "$1" in
    start)
        start_engagement_bot
        start_analytics_bot
        ;;
    stop)
        stop_engagement_bot
        stop_analytics_bot
        ;;
    restart)
        stop_engagement_bot
        stop_analytics_bot
        sleep 2
        start_engagement_bot
        start_analytics_bot
        ;;
    status)
        status
        ;;
    start-engagement)
        start_engagement_bot
        ;;
    stop-engagement)
        stop_engagement_bot
        ;;
    start-analytics)
        start_analytics_bot
        ;;
    stop-analytics)
        stop_analytics_bot
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|start-engagement|stop-engagement|start-analytics|stop-analytics}"
        exit 1
        ;;
esac 