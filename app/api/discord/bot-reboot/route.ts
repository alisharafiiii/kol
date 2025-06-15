import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { useCSRFProtection } from '@/lib/csrf'
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }
    
    // Check role - only admin can reboot bot
    const userRole = (session as any)?.role || (session.user as any)?.role
    const twitterHandle = (session as any)?.twitterHandle || session?.user?.name
    
    // Use centralized admin check (includes master admin bypass)
    if (!hasAdminAccess(twitterHandle, userRole)) {
      console.log(`Bot reboot access denied for ${twitterHandle} with role ${userRole}`)
      return NextResponse.json({ error: 'Insufficient permissions - Admin role required' }, { status: 403 })
    }
    
    // Log admin access
    logAdminAccess(twitterHandle || 'unknown', 'discord_bot_reboot', {
      action: 'reboot',
      role: userRole
    })
    
    // Check CSRF protection (temporarily optional)
    const userId = (session as any)?.userId || 
                   (session.user as any)?.id ||
                   twitterHandle ||
                   'anonymous'
    
    const csrfCheck = await useCSRFProtection(request, userId)
    if (!csrfCheck.protected) {
      console.log(`⚠️ Bot reboot CSRF check failed for ${twitterHandle}: ${csrfCheck.error}`)
      console.log(`⚠️ CSRF protection temporarily disabled - proceeding anyway`)
      // TODO: Re-enable CSRF protection once frontend is updated
      // return NextResponse.json({ error: csrfCheck.error || 'CSRF protection failed' }, { status: 403 })
    }
    
    // Log the action for audit trail
    console.log(`🚨 BOT REBOOT initiated by ${twitterHandle} (${userRole}) at ${new Date().toISOString()}`)
    
    // Kill existing bot processes
    try {
      await execAsync('pkill -f "node.*(engagement-bot\\.js|bot\\.js|bot-enhanced)" 2>/dev/null || true')
      console.log('Killed existing bot processes')
    } catch (error) {
      console.log('No existing bot processes to kill')
    }
    
    // Wait a moment for processes to die
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // First, let's check current directory and bot files
    console.log('🔍 Checking environment...')
    try {
      const { stdout: pwdResult } = await execAsync('pwd')
      console.log('Current working directory:', pwdResult.trim())
      
      const { stdout: findResult } = await execAsync('find . -name "*.js" -path "*/discord*" -o -name "bot.js" -o -name "engagement-bot.js" | grep -v node_modules | head -20')
      console.log('Found bot-related files:', findResult)
      
      // Check if bot files are executable
      const { stdout: lsResult } = await execAsync('ls -la discord-bots/engagement-bot.js bot.js 2>/dev/null || echo "Files not found"')
      console.log('Bot files permissions:', lsResult)
    } catch (error) {
      console.log('Error checking environment:', error)
    }
    
    // Get current working directory
    const { stdout: pwd } = await execAsync('pwd')
    const workingDir = pwd.trim()
    console.log(`📂 Working directory: ${workingDir}`)
    
    // Start the bot in background
    // Use absolute paths to avoid directory issues
    const botLocations = [
      // Primary location - engagement bot with absolute path
      `cd "${workingDir}" && nohup node discord-bots/engagement-bot.js > bot-debug.log 2>&1 &`,
      // Alternative: cd into discord-bots first
      `cd "${workingDir}/discord-bots" && nohup node engagement-bot.js > ../bot-debug.log 2>&1 &`,
      // Fallback - root bot.js
      `cd "${workingDir}" && nohup node bot.js > bot-debug.log 2>&1 &`,
    ]
    
    let started = false
    let startCommand = ''
    
    for (const command of botLocations) {
      try {
        console.log(`🚀 Trying to start bot with: ${command}`)
        const { stdout, stderr } = await execAsync(command)
        if (stdout) console.log('Command output:', stdout)
        if (stderr) console.log('Command stderr:', stderr)
        started = true
        startCommand = command
        console.log(`✅ Bot started with command: ${command}`)
        break
      } catch (error) {
        console.log(`❌ Failed to start with: ${command}`)
        console.log(`Error details:`, error instanceof Error ? error.message : error)
      }
    }
    
    if (!started) {
      return NextResponse.json(
        { error: 'Failed to start bot', message: 'Could not find bot.js file in expected locations' },
        { status: 500 }
      )
    }
    
    // Wait for bot to initialize
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check if bot is running
    let isRunning = false
    try {
      const { stdout } = await execAsync('ps aux | grep -E "node.*(engagement-bot\\.js|bot\\.js|bot-enhanced)" | grep -v grep')
      isRunning = !!stdout.trim()
    } catch (error) {
      isRunning = false
    }
    
    const response = NextResponse.json({
      success: isRunning,
      message: isRunning ? 'Bot restarted successfully' : 'Bot started but may not be running',
      command: startCommand,
      timestamp: new Date().toISOString(),
      csrfProtected: csrfCheck.protected,
      warning: !csrfCheck.protected ? 'CSRF protection temporarily disabled' : undefined
    })
    
    // Add new CSRF token to response if generated
    if (csrfCheck?.newToken) {
      response.headers.set('X-CSRF-Token', csrfCheck.newToken)
    }
    
    return response
  } catch (error) {
    console.error('Error rebooting bot:', error)
    return NextResponse.json(
      { error: 'Failed to reboot bot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 