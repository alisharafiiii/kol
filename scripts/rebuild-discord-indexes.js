const Redis = require('ioredis');

async function rebuildDiscordIndexes() {
  const redis = new Redis(process.env.REDIS_URL);
  
  try {
    console.log('🔄 Starting Discord index rebuild...');
    
    // Get all Discord projects
    const projectKeys = await redis.keys('project:discord:*');
    console.log(`Found ${projectKeys.length} Discord projects`);
    
    let totalMessages = 0;
    let indexedMessages = 0;
    
    for (const projectKey of projectKeys) {
      const project = await redis.call('JSON.GET', projectKey);
      if (!project) continue;
      
      const projectData = JSON.parse(project);
      console.log(`\nProcessing project: ${projectData.name} (${projectData.id})`);
      
      // Get all messages for this project
      const messageKeys = await redis.keys(`message:discord:${projectData.id}:*`);
      console.log(`  Found ${messageKeys.length} messages`);
      totalMessages += messageKeys.length;
      
      // Create sorted set for time-based queries
      const timelineKey = `discord:messages:timeline:${projectData.id}`;
      
      // Process messages in batches
      const batchSize = 100;
      for (let i = 0; i < messageKeys.length; i += batchSize) {
        const batch = messageKeys.slice(i, i + batchSize);
        const pipeline = redis.pipeline();
        
        for (const messageKey of batch) {
          const message = await redis.call('JSON.GET', messageKey);
          if (!message) continue;
          
          const messageData = JSON.parse(message);
          const timestamp = new Date(messageData.timestamp).getTime();
          const messageId = messageKey.split(':').pop();
          
          // Add to sorted set
          pipeline.zadd(timelineKey, timestamp, messageId);
          indexedMessages++;
        }
        
        await pipeline.exec();
        console.log(`  Indexed ${Math.min(i + batchSize, messageKeys.length)}/${messageKeys.length} messages`);
      }
    }
    
    console.log(`\n✅ Index rebuild complete!`);
    console.log(`   Total messages: ${totalMessages}`);
    console.log(`   Indexed messages: ${indexedMessages}`);
    
  } catch (error) {
    console.error('❌ Error rebuilding indexes:', error);
  } finally {
    await redis.quit();
  }
}

// Run the script
rebuildDiscordIndexes(); 