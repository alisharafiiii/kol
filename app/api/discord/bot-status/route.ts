import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { hasAdminAccess } from '@/lib/admin-config'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }
    
    // Check role - only admin and core can check bot status
    const userRole = (session as any)?.role || (session.user as any)?.role
    const twitterHandle = (session as any)?.twitterHandle || session?.user?.name
    
    // Use centralized admin check or allow core role
    if (!hasAdminAccess(twitterHandle, userRole) && userRole !== 'core') {
      console.log(`Bot status access denied for ${twitterHandle} with role ${userRole}`)
      return NextResponse.json({ error: 'Insufficient permissions - Admin or Core role required' }, { status: 403 })
    }
    
    console.log(`Bot status check by ${twitterHandle} (${userRole})`)
    
    // Check if bot process is running
    let isRunning = false
    let processInfo = null
    let analyticsRunning = false
    let analyticsProcessInfo = null
    
    try {
      // Check for engagement bot
      const { stdout: engagementStdout } = await execAsync('ps aux | grep -E "node.*(engagement-bot\\.js|bot\\.js|bot-enhanced)" | grep -v grep')
      
      if (engagementStdout.trim()) {
        isRunning = true
        const lines = engagementStdout.trim().split('\n')
        const firstProcess = lines[0].split(/\s+/)
        processInfo = {
          pid: firstProcess[1],
          cpu: firstProcess[2],
          memory: firstProcess[3],
          startTime: firstProcess[8],
          command: lines[0].substring(lines[0].indexOf('node'))
        }
      }
    } catch (error) {
      // Process not found, bot is not running
      isRunning = false
    }
    
    try {
      // Check for analytics bot
      const { stdout: analyticsStdout } = await execAsync('ps aux | grep -E "node.*analytics-bot\\.js" | grep -v grep')
      
      if (analyticsStdout.trim()) {
        analyticsRunning = true
        const lines = analyticsStdout.trim().split('\n')
        const firstProcess = lines[0].split(/\s+/)
        analyticsProcessInfo = {
          pid: firstProcess[1],
          cpu: firstProcess[2],
          memory: firstProcess[3],
          startTime: firstProcess[8],
          command: lines[0].substring(lines[0].indexOf('node'))
        }
      }
    } catch (error) {
      // Analytics bot not found
      analyticsRunning = false
    }
    
    // Check last log entries
    let lastLogs: string[] = []
    let analyticsLogs: string[] = []
    try {
      // Check bot-debug.log in root directory (where it's created)
      const { stdout: logs } = await execAsync('tail -n 20 bot-debug.log 2>/dev/null || echo "No logs found"')
      lastLogs = logs.trim().split('\n').filter(line => line && line !== 'No logs found')
    } catch (error) {
      // Ignore log errors
    }
    
    try {
      // Check analytics bot logs
      const { stdout: logs } = await execAsync('tail -n 20 analytics-bot-debug.log 2>/dev/null || echo "No logs found"')
      analyticsLogs = logs.trim().split('\n').filter(line => line && line !== 'No logs found')
    } catch (error) {
      // Ignore log errors
    }
    
    // Check bot token configuration
    const hasToken = !!process.env.DISCORD_BOT_TOKEN
    
    // Get uptime if running
    let uptime = null
    let analyticsUptime = null
    if (isRunning && processInfo) {
      try {
        // Sanitize PID to prevent command injection
        const pid = parseInt(processInfo.pid, 10)
        if (!isNaN(pid) && pid > 0) {
          const { stdout } = await execAsync(`ps -o etime= -p ${pid}`)
          uptime = stdout.trim()
        }
      } catch (error) {
        // Ignore uptime errors
      }
    }
    
    if (analyticsRunning && analyticsProcessInfo) {
      try {
        const pid = parseInt(analyticsProcessInfo.pid, 10)
        if (!isNaN(pid) && pid > 0) {
          const { stdout } = await execAsync(`ps -o etime= -p ${pid}`)
          analyticsUptime = stdout.trim()
        }
      } catch (error) {
        // Ignore uptime errors
      }
    }
    
    return NextResponse.json({
      status: isRunning ? 'running' : 'stopped',
      analyticsStatus: analyticsRunning ? 'running' : 'stopped',
      hasToken,
      process: processInfo,
      analyticsProcess: analyticsProcessInfo,
      uptime,
      analyticsUptime,
      lastLogs: lastLogs.slice(-10), // Last 10 log entries
      analyticsLogs: analyticsLogs.slice(-10), // Last 10 analytics log entries
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error checking bot status:', error)
    return NextResponse.json(
      { error: 'Failed to check bot status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 