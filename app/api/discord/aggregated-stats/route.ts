import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'
import { DiscordService } from '@/lib/services/discord-service'
import type { DiscordProject } from '@/lib/types/discord'
import { hasCoreAccess } from '@/lib/session-utils'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin/core role using standardized utility
    if (!hasCoreAccess(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const timeframe = searchParams.get('timeframe') || 'weekly'

    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    switch (timeframe) {
      case 'daily':
        startDate.setHours(startDate.getHours() - 24)
        break
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'monthly':
        startDate.setDate(startDate.getDate() - 30)
        break
    }

    // Get all Discord projects using the service
    const projects = await DiscordService.getAllProjects()

    // Initialize aggregated stats
    const stats = {
      totalProjects: projects.length,
      totalMessages: 0,
      totalUsers: new Set<string>(),
      totalChannels: 0,
      avgSentiment: 0,
      sentimentBreakdown: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      projectActivity: [] as any[],
      weeklyTrend: [] as any[],
      hourlyActivity: new Array(24).fill(0),
      topProjects: [] as any[]
    }

    // Aggregate data from all projects
    let totalSentimentScore = 0
    let totalSentimentCount = 0

    for (const project of projects) {
      if (!project.isActive) continue

      // Count tracked channels
      stats.totalChannels += project.trackedChannels?.length || 0
      
      // Get project stats from stored data
      const projectStats = project.stats || { totalMessages: 0, totalUsers: 0 }
      stats.totalMessages += projectStats.totalMessages || 0
      
      // Get project users
      const projectUserIds = await redis.smembers(`discord:users:project:${project.id}`)
      projectUserIds.forEach((userId: string) => stats.totalUsers.add(userId))
      
      // Sample recent messages for sentiment analysis (limit to avoid performance issues)
      const messageIndexKey = `discord:messages:project:${project.id}`
      const allMessageIds = await redis.smembers(messageIndexKey)
      
      // Get a sample of recent messages (last 100)
      const sampleMessageIds = allMessageIds.slice(-100)
      let projectPositive = 0
      let projectNeutral = 0
      let projectNegative = 0
      let projectSentimentTotal = 0
      let projectMessageCount = 0
      
      for (const messageId of sampleMessageIds) {
        try {
          const message = await redis.json.get(messageId) as any
          if (!message) continue
          
          // Filter by timeframe
          const messageDate = new Date(message.timestamp)
          if (messageDate < startDate) continue
          
          projectMessageCount++
          
          // Count sentiment
          if (message.sentiment?.score) {
            switch (message.sentiment.score) {
              case 'positive':
                projectPositive++
                stats.sentimentBreakdown.positive++
                projectSentimentTotal += 1
                break
              case 'negative':
                projectNegative++
                stats.sentimentBreakdown.negative++
                projectSentimentTotal -= 1
                break
              case 'neutral':
                projectNeutral++
                stats.sentimentBreakdown.neutral++
                break
            }
            totalSentimentCount++
          }
          
          // Count hourly activity
          const hour = messageDate.getHours()
          stats.hourlyActivity[hour]++
        } catch (err) {
          // Skip invalid messages
          continue
        }
      }
      
      // Calculate project sentiment average
      const projectSentiment = projectMessageCount > 0 
        ? projectSentimentTotal / projectMessageCount 
        : 0
      
      totalSentimentScore += projectSentimentTotal
      
      // Add to project activity
      stats.projectActivity.push({
        projectId: project.id,
        name: project.name,
        messages: projectStats.totalMessages || 0,
        users: projectStats.totalUsers || 0,
        recentMessages: projectMessageCount,
        sentiment: projectSentiment,
        sentimentBreakdown: {
          positive: projectPositive,
          neutral: projectNeutral,
          negative: projectNegative
        }
      })
    }

    // Calculate average sentiment
    stats.avgSentiment = totalSentimentCount > 0 
      ? totalSentimentScore / totalSentimentCount 
      : 0

    // Get top projects by recent activity
    stats.topProjects = stats.projectActivity
      .sort((a, b) => b.recentMessages - a.recentMessages)
      .slice(0, 5)
      .map(p => ({
        id: p.projectId,
        name: p.name,
        messageCount: p.messages,
        userCount: p.users,
        sentiment: p.sentiment
      }))

    // Generate weekly trend data
    const weeklyData = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      let dayMessages = 0
      let daySentiment = 0
      let daySentimentCount = 0
      
      // Sample messages for this day
      for (const project of projects) {
        if (!project.isActive) continue
        
        const messageIds = await redis.smembers(`discord:messages:project:${project.id}`)
        const sampleIds = messageIds.slice(-50) // Sample last 50 per project for performance
        
        for (const messageId of sampleIds) {
          try {
            const message = await redis.json.get(messageId) as any
            if (!message) continue
            
            const messageDate = new Date(message.timestamp)
            if (messageDate.toDateString() === date.toDateString()) {
              dayMessages++
              
              if (message.sentiment?.score) {
                daySentimentCount++
                if (message.sentiment.score === 'positive') daySentiment += 1
                else if (message.sentiment.score === 'negative') daySentiment -= 1
              }
            }
          } catch (err) {
            continue
          }
        }
      }
      
      weeklyData.push({
        date: date.toISOString().slice(0, 10),
        messages: dayMessages,
        sentiment: daySentimentCount > 0 ? daySentiment / daySentimentCount : 0
      })
    }
    
    stats.weeklyTrend = weeklyData

    // Convert sets to counts
    const aggregatedStats = {
      ...stats,
      totalUsers: stats.totalUsers.size
    }

    return NextResponse.json(aggregatedStats)
  } catch (error) {
    console.error('Error fetching aggregated Discord stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
} 