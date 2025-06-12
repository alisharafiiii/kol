import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  const campaignId = 'campaign:Te-1hZJ5AfwCwAEayvwLI'
  
  try {
    // Get raw campaign data
    const campaignData = await redis.hgetall(campaignId)
    
    if (!campaignData || Object.keys(campaignData).length === 0) {
      return NextResponse.json({ error: 'Campaign not found or empty' }, { status: 404 })
    }
    
    // Get all the keys
    const keys = Object.keys(campaignData)
    
    // Try to parse the kols field if it exists
    let parsedKols = null
    let kolsCount: string | number = 'No kols field'
    
    if (campaignData.kols) {
      try {
        parsedKols = JSON.parse(campaignData.kols)
        if (Array.isArray(parsedKols)) {
          kolsCount = parsedKols.length
        } else {
          kolsCount = 'Parsed but not an array'
        }
      } catch (e) {
        parsedKols = 'Failed to parse as JSON'
        kolsCount = 'Parse error'
      }
    }
    
    return NextResponse.json({
      campaignId,
      keys,
      rawData: campaignData,
      parsedKols,
      kolsCount
    })
    
  } catch (error: any) {
    console.error('Error checking campaign data:', error)
    return NextResponse.json({ 
      error: 'Failed to check campaign data', 
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
} 