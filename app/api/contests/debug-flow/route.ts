import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { ContestService } from '@/lib/services/contest-service'

export async function GET() {
  try {
    const debugInfo: any = {
      step1_indices: {},
      step2_rawData: {},
      step3_issues: [],
      step4_recommendations: []
    }
    
    // Step 1: Check all indices
    const allContestIds = await redis.smembers('contests:all')
    const activeIds = await redis.smembers('idx:contest:status:active')
    const publicIds = await redis.smembers('idx:contest:visibility:public')
    
    debugInfo.step1_indices = {
      all: allContestIds,
      active: activeIds,
      public: publicIds,
      allCount: allContestIds.length,
      activeCount: activeIds.length,
      publicCount: publicIds.length
    }
    
    // Step 2: Check raw data for each contest
    for (const id of allContestIds) {
      const contestData: any = await redis.json.get(`contest:${id}`)
      
      if (!contestData) {
        debugInfo.step3_issues.push({
          id,
          issue: 'Contest exists in index but no data in Redis'
        })
        continue
      }
      
      // With json.get, we already have the parsed object
      try {
        // Check for required fields
        if (!contestData.id || !contestData.name || !contestData.status || !contestData.visibility) {
          debugInfo.step3_issues.push({
            id,
            issue: 'Missing required fields',
            hasId: !!contestData.id,
            hasName: !!contestData.name,
            hasStatus: !!contestData.status,
            hasVisibility: !!contestData.visibility
          })
        }
        
        // Check date fields
        if (!contestData.startTime || !contestData.endTime) {
          debugInfo.step3_issues.push({
            id,
            issue: 'Missing date fields',
            startTime: contestData.startTime,
            endTime: contestData.endTime
          })
        }
        
        debugInfo.step2_rawData[id] = {
          dataLength: JSON.stringify(contestData).length,
          preview: JSON.stringify(contestData).substring(0, 200),
          parsed: {
            id: contestData.id,
            name: contestData.name,
            status: contestData.status,
            visibility: contestData.visibility,
            startTime: contestData.startTime,
            endTime: contestData.endTime,
            hasSponsors: !!contestData.sponsors,
            hasPrizeDistribution: !!contestData.prizeDistribution
          }
        }
      } catch (error) {
        debugInfo.step3_issues.push({
          id,
          issue: 'Error processing contest data',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    // Step 4: Check what ContestService returns
    try {
      const allContests = await ContestService.getContests()
      const activePublicContests = await ContestService.getContests({
        status: 'active',
        visibility: 'public'
      })
      
      debugInfo.step4_service = {
        allContestsCount: allContests.length,
        activePublicCount: activePublicContests.length,
        allContestIds: allContests.map(c => c.id),
        activePublicIds: activePublicContests.map(c => c.id)
      }
    } catch (serviceError) {
      debugInfo.step4_service = {
        error: serviceError instanceof Error ? serviceError.message : String(serviceError)
      }
    }
    
    // Recommendations
    if (debugInfo.step3_issues.length > 0) {
      debugInfo.step4_recommendations.push('Run cleanup to remove corrupted data')
      debugInfo.step4_recommendations.push('Check why data is being saved as [object Object]')
    }
    
    console.log('DEBUG FLOW:', JSON.stringify(debugInfo, null, 2))
    
    return NextResponse.json(debugInfo)
  } catch (error) {
    console.error('Debug flow error:', error)
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 