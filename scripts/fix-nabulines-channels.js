const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '../.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixNabulinesChannels() {
  const projectId = 'project:discord:pype0pAxNMSU9k0LDSkF4'
  
  // The correct NABULINES channels
  const correctChannels = [
    { id: '980162754365235300', name: '🧲〉share-your-stuff' },
    { id: '1382583759907459123', name: 'engagement-tracker' },
    { id: '984154482168434728', name: '💬〉general' }
  ]
  
  console.log('🔧 Fixing NABULINES project channels...\n')
  
  // First, update the project's tracked channels
  const project = await redis.json.get(projectId)
  if (!project) {
    console.error('❌ Project not found!')
    return
  }
  
  console.log('Current tracked channels:', project.trackedChannels)
  console.log('Updating to correct channels:', correctChannels.map(c => c.id))
  
  // Update tracked channels
  await redis.json.set(projectId, '$.trackedChannels', correctChannels.map(c => c.id))
  
  // Now save metadata for each channel
  for (const channel of correctChannels) {
    const channelKey = `channel:discord:${channel.id}`
    
    try {
      await redis.json.set(channelKey, '$', {
        id: channel.id,
        name: channel.name,
        type: 'text',
        projectId: projectId,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`✅ Fixed metadata for #${channel.name} (${channel.id})`)
    } catch (error) {
      console.error(`❌ Error fixing channel ${channel.id}:`, error)
    }
  }
  
  // Verify the fix
  const updatedProject = await redis.json.get(projectId)
  console.log('\n✅ Updated tracked channels:', updatedProject.trackedChannels)
  console.log('✅ NABULINES channels have been fixed!')
}

fixNabulinesChannels().catch(console.error) 