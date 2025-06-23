#!/bin/bash

echo "🔧 Engagement Batch Processor Cron Setup"
echo "======================================="
echo ""

# Get the current directory
PROJECT_DIR=$(pwd)
NODE_PATH=$(which node)

echo "📁 Project directory: $PROJECT_DIR"
echo "🟢 Node.js path: $NODE_PATH"
echo ""

# Create the cron job command
CRON_COMMAND="*/30 * * * * cd $PROJECT_DIR && $NODE_PATH discord-bots/engagement-batch-processor.js >> $PROJECT_DIR/logs/engagement-batch.log 2>&1"

echo "📋 This will add the following cron job:"
echo "   $CRON_COMMAND"
echo ""
echo "📊 Optimized Approach:"
echo "   - Every 30 minutes: Updates tweet metrics (likes, RTs, replies)"
echo "   - Every hour: Performs detailed engagement checks for points"
echo "   - This reduces API calls by ~95% while keeping metrics current"
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs

echo "Would you like to:"
echo "1) Add this cron job"
echo "2) View current cron jobs"
echo "3) Remove engagement batch cron job"
echo "4) Exit"
echo ""
read -p "Choose an option (1-4): " choice

case $choice in
    1)
        # Add the cron job
        (crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -
        echo "✅ Cron job added successfully!"
        echo ""
        echo "The batch processor will now run every 30 minutes."
        echo "Logs will be saved to: logs/engagement-batch.log"
        ;;
    2)
        echo "📋 Current cron jobs:"
        crontab -l
        ;;
    3)
        # Remove the cron job
        crontab -l | grep -v "engagement-batch-processor.js" | crontab -
        echo "✅ Engagement batch cron job removed!"
        ;;
    4)
        echo "Exiting..."
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo ""
echo "💡 Tips:"
echo "- Check logs with: tail -f logs/engagement-batch.log"
echo "- Run manually: node discord-bots/engagement-batch-processor.js"
echo "- The processor checks Twitter API for likes/retweets and awards points" 