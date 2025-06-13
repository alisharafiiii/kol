import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'
import type { DiscordProject } from '@/lib/types/discord'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin/core role
    const userRole = (session as any).role || (session.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
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

    // Get all Discord projects
    const projectKeys = await redis.keys('project:discord:*')
    const projects: DiscordProject[] = []
    
    for (const key of projectKeys) {
      const project = await redis.json.get(key)
      if (project) {
        projects.push(project as DiscordProject)
      }
    }

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

    // Collect messages and analytics for each project
    let totalSentimentScore = 0
    let sentimentCount = 0

    for (const project of projects) {
      // Count tracked channels
      stats.totalChannels += project.trackedChannels?.length || 0

      // Get messages for this project
      const messageKeys = await redis.keys(`message:discord:${project.id}:*`)
      let projectMessages = 0
      const projectUsers = new Set<string>()

      for (const msgKey of messageKeys) {
        const message = await redis.json.get(msgKey) as any
        if (!message) continue

        const msgDate = new Date(message.timestamp)
        if (msgDate < startDate) continue

        projectMessages++
        stats.totalMessages++
        projectUsers.add(message.userId)
        stats.totalUsers.add(message.userId)

        // Update hourly activity
        const hour = msgDate.getHours()
        stats.hourlyActivity[hour]++

        // Process sentiment
        if (message.sentiment?.score) {
          sentimentCount++
          switch (message.sentiment.score) {
            case 'positive':
              stats.sentimentBreakdown.positive++
              totalSentimentScore += 1
              break
            case 'neutral':
              stats.sentimentBreakdown.neutral++
              break
            case 'negative':
              stats.sentimentBreakdown.negative++
              totalSentimentScore -= 1
              break
          }
        }
      }

      // Add project activity
      stats.projectActivity.push({
        projectId: project.id,
        name: project.name,
        messages: projectMessages,
        users: projectUsers.size
      })
    }

    // Calculate average sentiment
    if (sentimentCount > 0) {
      stats.avgSentiment = totalSentimentScore / sentimentCount
    }

    // Generate weekly trend data
    const dailyData: Record<string, { messages: number; sentiment: number; sentimentCount: number }> = {}
    
    for (let i = 0; i < (timeframe === 'daily' ? 24 : timeframe === 'weekly' ? 7 : 30); i++) {
      const date = new Date()
      if (timeframe === 'daily') {
        date.setHours(date.getHours() - i)
      } else {
        date.setDate(date.getDate() - i)
      }
      const dateKey = timeframe === 'daily' 
        ? date.toISOString().slice(0, 13) 
        : date.toISOString().slice(0, 10)
      
      dailyData[dateKey] = { messages: 0, sentiment: 0, sentimentCount: 0 }
    }

    // Populate daily data from messages
    for (const project of projects) {
      const messageKeys = await redis.keys(`message:discord:${project.id}:*`)
      
      for (const msgKey of messageKeys) {
        const message = await redis.json.get(msgKey) as any
        if (!message) continue

        const msgDate = new Date(message.timestamp)
        if (msgDate < startDate) continue

        const dateKey = timeframe === 'daily'
          ? msgDate.toISOString().slice(0, 13)
          : msgDate.toISOString().slice(0, 10)

        if (dailyData[dateKey]) {
          dailyData[dateKey].messages++
          
          if (message.sentiment?.score) {
            dailyData[dateKey].sentimentCount++
            if (message.sentiment.score === 'positive') {
              dailyData[dateKey].sentiment += 1
            } else if (message.sentiment.score === 'negative') {
              dailyData[dateKey].sentiment -= 1
            }
          }
        }
      }
    }

    // Convert to array and calculate averages
    stats.weeklyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        messages: data.messages,
        sentiment: data.sentimentCount > 0 ? data.sentiment / data.sentimentCount : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Get top projects by activity
    stats.topProjects = stats.projectActivity
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 5)
      .map(p => {
        const projectSentiment = projects.find(proj => proj.id === p.projectId)
        return {
          id: p.projectId,
          name: p.name,
          messageCount: p.messages,
          userCount: p.users,
          sentiment: 0 // TODO: Calculate per-project sentiment
        }
      })

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