const cron = require('node-cron')
const { processBatch } = require('./engagement-batch-processor')

console.log('🤖 Starting Engagement Cron Job...')

// Run batch processing every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('\n⏰ Running scheduled batch processing at', new Date().toISOString())
  
  try {
    await processBatch()
    console.log('✅ Batch processing completed successfully')
  } catch (error) {
    console.error('❌ Batch processing failed:', error)
  }
})

// Also run once on startup
console.log('🚀 Running initial batch processing...')
processBatch()
  .then(() => console.log('✅ Initial batch completed'))
  .catch(error => console.error('❌ Initial batch failed:', error))

console.log('⏳ Cron job scheduled - will run every 30 minutes')

// Keep the process running
process.stdin.resume() 