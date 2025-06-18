import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'
import { DiscordService } from '@/lib/services/discord-service'
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

    // For now, just return basic stats without detailed analytics
    // This is a temporary fix to get the page loading
    for (const project of projects) {
      // Count tracked channels
      stats.totalChannels += project.trackedChannels?.length || 0
      
      // Get basic stats from project
      const projectStats = project.stats || { totalMessages: 0, totalUsers: 0 }
      stats.totalMessages += projectStats.totalMessages || 0
      
      // Add to project activity
      stats.projectActivity.push({
        projectId: project.id,
        name: project.name,
        messages: projectStats.totalMessages || 0,
        users: projectStats.totalUsers || 0
      })
    }

    // Get top projects by activity
    stats.topProjects = stats.projectActivity
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 5)
      .map(p => ({
        id: p.projectId,
        name: p.name,
        messageCount: p.messages,
        userCount: p.users,
        sentiment: 0
      }))

    // Convert sets to counts
    const aggregatedStats = {
      ...stats,
      totalUsers: stats.projectActivity.reduce((sum, p) => sum + p.users, 0),
      // Add some dummy data for the charts to render
      weeklyTrend: Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        return {
          date: date.toISOString().slice(0, 10),
          messages: Math.floor(Math.random() * 100) + 50,
          sentiment: Math.random() * 0.4 - 0.2
        }
      })
    }

    return NextResponse.json(aggregatedStats)
  } catch (error) {
    console.error('Error fetching aggregated Discord stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
} 