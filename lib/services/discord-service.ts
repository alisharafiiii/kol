import { redis } from '@/lib/redis';
import { nanoid } from 'nanoid';
import { 
  DiscordProject, 
  DiscordMessage, 
  DiscordUser, 
  DiscordAnalytics,
  UserProjectStats 
} from '@/lib/types/discord';
import { geminiService } from './gemini-service';

export class DiscordService {
  // Project Management
  static async createProject(data: {
    name: string;
    serverId: string;
    serverName: string;
    iconUrl?: string;
    createdBy: string;
  }): Promise<DiscordProject> {
    const project: DiscordProject = {
      id: `project:discord:${nanoid()}`,
      name: data.name,
      serverId: data.serverId,
      serverName: data.serverName,
      iconUrl: data.iconUrl,
      trackedChannels: [],
      teamMods: [],
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      isActive: true,
      stats: {
        totalMessages: 0,
        totalUsers: 0
      }
    };
    
    await redis.json.set(project.id, '$', project as any);
    await redis.sadd('discord:projects:all', project.id);
    
    return project;
  }
  
  static async getProject(projectId: string): Promise<DiscordProject | null> {
    const project = await redis.json.get(projectId);
    return project as DiscordProject | null;
  }
  
  static async getAllProjects(): Promise<DiscordProject[]> {
    const projectIds = await redis.smembers('discord:projects:all');
    const projects = await Promise.all(
      projectIds.map((id: string) => redis.json.get(id))
    );
    return projects.filter(Boolean) as DiscordProject[];
  }
  
  static async updateProject(projectId: string, updates: Partial<DiscordProject>): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    const updated = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await redis.json.set(projectId, '$', updated as any);
  }
  
  static async deleteProject(projectId: string): Promise<void> {
    await redis.del(projectId);
    await redis.srem('discord:projects:all', projectId);
    
    // Clean up related data
    const messageKeys = await redis.keys(`message:discord:${projectId}:*`);
    if (messageKeys.length > 0) {
      await redis.del(...messageKeys);
    }
  }
  
  // Channel Management
  static async updateTrackedChannels(projectId: string, channelIds: string[]): Promise<void> {
    const project = await redis.json.get(projectId) as DiscordProject
    if (!project) return

    project.trackedChannels = channelIds
    project.updatedAt = new Date().toISOString()

    await redis.json.set(projectId, '$', project as any)
  }

  // Store channel metadata (names) separately
  static async updateChannelMetadata(projectId: string, channelId: string, metadata: { name: string }): Promise<void> {
    const key = `channel:discord:${channelId}`
    await redis.json.set(key, '$', {
      channelId,
      projectId,
      name: metadata.name,
      updatedAt: new Date().toISOString()
    } as any)
  }

  // Get channel metadata
  static async getChannelMetadata(channelIds: string[]): Promise<Record<string, { name: string }>> {
    const metadata: Record<string, { name: string }> = {}
    
    for (const channelId of channelIds) {
      const key = `channel:discord:${channelId}`
      const data = await redis.json.get(key) as any
      if (data) {
        metadata[channelId] = { name: data.name }
      }
    }

    return metadata
  }
  
  // Message Management
  static async saveMessage(data: {
    messageId: string;
    projectId: string;
    channelId: string;
    channelName: string;
    userId: string;
    username: string;
    userAvatar?: string;
    content: string;
    timestamp: string;
    hasAttachments: boolean;
    replyToId?: string;
  }): Promise<DiscordMessage> {
    const message: DiscordMessage = {
      id: `message:discord:${data.projectId}:${data.messageId}`,
      projectId: data.projectId,
      channelId: data.channelId,
      channelName: data.channelName,
      userId: data.userId,
      username: data.username,
      userAvatar: data.userAvatar,
      content: data.content,
      timestamp: data.timestamp,
      hasAttachments: data.hasAttachments,
      replyToId: data.replyToId
    };
    
    // Analyze sentiment
    const sentiment = await geminiService.analyzeMessage(data.content);
    message.sentiment = sentiment;
    message.tags = sentiment.tags;
    
    // Save message
    await redis.json.set(message.id, '$', message as any);
    
    // Add to indexes
    await redis.sadd(`discord:messages:project:${data.projectId}`, message.id);
    await redis.sadd(`discord:messages:channel:${data.channelId}`, message.id);
    await redis.sadd(`discord:messages:user:${data.userId}`, message.id);
    
    // Update user stats
    await this.updateUserStats(data.userId, data.username, data.projectId, sentiment.score);
    
    // Update project stats
    await this.updateProjectStats(data.projectId);
    
    return message;
  }
  
  static async getMessages(filters: {
    projectId?: string;
    channelId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<DiscordMessage[]> {
    let messageIds: string[] = [];
    
    if (filters.projectId) {
      messageIds = await redis.smembers(`discord:messages:project:${filters.projectId}`);
    } else if (filters.channelId) {
      messageIds = await redis.smembers(`discord:messages:channel:${filters.channelId}`);
    } else if (filters.userId) {
      messageIds = await redis.smembers(`discord:messages:user:${filters.userId}`);
    }
    
    const messages = await Promise.all(
      messageIds.map(id => redis.json.get(id))
    ) as DiscordMessage[];
    
    // Filter by date if needed
    let filtered = messages.filter(Boolean);
    if (filters.startDate) {
      filtered = filtered.filter(m => m.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(m => m.timestamp <= filters.endDate!);
    }
    
    // Sort by timestamp descending and limit
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }
    
    return filtered;
  }
  
  // User Management
  static async updateUserStats(
    userId: string, 
    username: string, 
    projectId: string, 
    sentiment: 'positive' | 'neutral' | 'negative'
  ): Promise<void> {
    const userKey = `discord:user:${userId}`;
    let user = await redis.json.get(userKey) as DiscordUser | null;
    
    if (!user) {
      user = {
        id: userId,
        username,
        projects: [projectId],
        stats: {
          [projectId]: {
            messageCount: 0,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            sentimentBreakdown: {
              positive: 0,
              neutral: 0,
              negative: 0
            }
          }
        }
      };
    }
    
    // Update stats
    if (!user.stats[projectId]) {
      user.stats[projectId] = {
        messageCount: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        sentimentBreakdown: {
          positive: 0,
          neutral: 0,
          negative: 0
        }
      };
    }
    
    user.stats[projectId].messageCount++;
    user.stats[projectId].lastSeen = new Date().toISOString();
    user.stats[projectId].sentimentBreakdown[sentiment]++;
    
    if (!user.projects.includes(projectId)) {
      user.projects.push(projectId);
    }
    
    await redis.json.set(userKey, '$', user as any);
    await redis.sadd(`discord:users:project:${projectId}`, userId);
  }
  
  static async updateProjectStats(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;
    
    const messageIds = await redis.smembers(`discord:messages:project:${projectId}`);
    const userIds = await redis.smembers(`discord:users:project:${projectId}`);
    
    project.stats = {
      totalMessages: messageIds.length,
      totalUsers: userIds.length,
      lastActivity: new Date().toISOString()
    };
    
    await redis.json.set(projectId, '$', project as any);
  }
  
  // Analytics
  static async getAnalytics(
    projectId: string,
    timeframe: 'daily' | 'weekly' | 'monthly' | 'allTime' | 'custom',
    startDate?: string,
    endDate?: string
  ): Promise<DiscordAnalytics> {
    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    let start: Date;
    
    switch (timeframe) {
      case 'daily':
        start = new Date(end);
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(end);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'allTime':
        // For all time, set start date to a very early date
        start = new Date('2020-01-01');
        break;
      default:
        start = startDate ? new Date(startDate) : new Date(end.setMonth(end.getMonth() - 1));
    }
    
    // Get messages in timeframe
    const messages = await this.getMessages({
      projectId,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
    
    // Calculate metrics
    const userMessageCount = new Map<string, number>();
    const channelMessageCount = new Map<string, number>();
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const hourlyActivity = new Array(24).fill(0);
    const dailyData = new Map<string, { messages: number; sentimentSum: number }>();
    
    messages.forEach(msg => {
      // User stats
      userMessageCount.set(msg.userId, (userMessageCount.get(msg.userId) || 0) + 1);
      
      // Channel stats
      channelMessageCount.set(msg.channelId, (channelMessageCount.get(msg.channelId) || 0) + 1);
      
      // Sentiment
      if (msg.sentiment) {
        sentimentCounts[msg.sentiment.score]++;
      }
      
      // Hourly activity
      const hour = new Date(msg.timestamp).getHours();
      hourlyActivity[hour]++;
      
      // Daily trend
      const day = new Date(msg.timestamp).toISOString().split('T')[0];
      const dayData = dailyData.get(day) || { messages: 0, sentimentSum: 0 };
      dayData.messages++;
      dayData.sentimentSum += msg.sentiment?.score === 'positive' ? 1 : 
                             msg.sentiment?.score === 'negative' ? -1 : 0;
      dailyData.set(day, dayData);
    });
    
    // Get user details
    const topUsers = Array.from(userMessageCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => {
        const userMessages = messages.filter(m => m.userId === userId);
        const avgSentiment = userMessages.reduce((sum, m) => 
          sum + (m.sentiment?.score === 'positive' ? 1 : 
                 m.sentiment?.score === 'negative' ? -1 : 0), 0
        ) / userMessages.length;
        
        return {
          userId,
          username: userMessages[0]?.username || 'Unknown',
          messageCount: count,
          avgSentiment
        };
      });
    
    // Channel activity
    const channelActivity = Array.from(channelMessageCount.entries())
      .map(([channelId, count]) => ({
        channelId,
        channelName: messages.find(m => m.channelId === channelId)?.channelName || 'Unknown',
        messageCount: count
      }));
    
    // Daily trend
    const dailyTrend = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        messages: data.messages,
        sentiment: data.messages > 0 ? data.sentimentSum / data.messages : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      projectId,
      timeframe,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      metrics: {
        totalMessages: messages.length,
        uniqueUsers: userMessageCount.size,
        averageMessagesPerUser: messages.length / (userMessageCount.size || 1),
        sentimentBreakdown: sentimentCounts,
        topUsers,
        channelActivity,
        hourlyActivity,
        dailyTrend
      }
    };
  }

  // Get analytics for a specific project
  static async getProjectAnalytics(
    projectId: string, 
    timeframe: 'daily' | 'weekly' | 'monthly' | 'allTime' | 'custom' = 'weekly',
    startDate?: Date,
    endDate?: Date
  ): Promise<DiscordAnalytics> {
    const now = new Date()
    const start = startDate || new Date()
    
    switch (timeframe) {
      case 'daily':
        start.setHours(start.getHours() - 24)
        break
      case 'weekly':
        start.setDate(start.getDate() - 7)
        break
      case 'monthly':
        start.setDate(start.getDate() - 30)
        break
      case 'allTime':
        start.setFullYear(2020) // Set to a date before any messages
        break
    }
    
    const end = endDate || now
    
    // Get all messages for the project in timeframe
    const messageKeys = await redis.keys(`message:discord:${projectId}:*`)
    const messages: DiscordMessage[] = []
    const uniqueUsers = new Set<string>()
    const channelStats: Record<string, { count: number; name: string }> = {}
    const hourlyActivity = new Array(24).fill(0)
    const dailyData: Record<string, { messages: number; sentiment: number; sentimentCount: number }> = {}
    const userStats: Record<string, { messages: number; sentiment: number; sentimentCount: number }> = {}
    
    // Process messages
    for (const key of messageKeys) {
      const message = await redis.json.get(key) as DiscordMessage
      if (!message) continue
      
      const msgDate = new Date(message.timestamp)
      if (msgDate < start || msgDate > end) continue
      
      messages.push(message)
      uniqueUsers.add(message.userId)
      
      // Update channel stats
      if (!channelStats[message.channelId]) {
        channelStats[message.channelId] = { count: 0, name: message.channelName }
      }
      channelStats[message.channelId].count++
      
      // Update hourly activity
      const hour = msgDate.getHours()
      hourlyActivity[hour]++
      
      // Update daily data
      const dateKey = msgDate.toISOString().slice(0, 10)
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { messages: 0, sentiment: 0, sentimentCount: 0 }
      }
      dailyData[dateKey].messages++
      
      // Update user stats
      if (!userStats[message.userId]) {
        userStats[message.userId] = { messages: 0, sentiment: 0, sentimentCount: 0 }
      }
      userStats[message.userId].messages++
      
      // Process sentiment if available
      if (message.sentiment?.score) {
        const sentimentValue = message.sentiment.score === 'positive' ? 1 : 
                              message.sentiment.score === 'negative' ? -1 : 0
        
        dailyData[dateKey].sentimentCount++
        dailyData[dateKey].sentiment += sentimentValue
        
        userStats[message.userId].sentimentCount++
        userStats[message.userId].sentiment += sentimentValue
      }
    }
    
    // Calculate sentiment breakdown
    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 }
    for (const message of messages) {
      if (message.sentiment?.score) {
        sentimentBreakdown[message.sentiment.score]++
      }
    }
    
    // Calculate top users
    const topUsers = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        username: messages.find(m => m.userId === userId)?.username || 'Unknown',
        messageCount: stats.messages,
        avgSentiment: stats.sentimentCount > 0 ? stats.sentiment / stats.sentimentCount : 0
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 20)
    
    // Convert channel stats to array
    const channelActivity = Object.entries(channelStats)
      .map(([channelId, stats]) => ({
        channelId,
        channelName: stats.name,
        messageCount: stats.count
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
    
    // Convert daily data to trend array
    const dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        messages: data.messages,
        sentiment: data.sentimentCount > 0 ? data.sentiment / data.sentimentCount : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return {
      projectId,
      timeframe,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      metrics: {
        totalMessages: messages.length,
        uniqueUsers: uniqueUsers.size,
        averageMessagesPerUser: uniqueUsers.size > 0 ? messages.length / uniqueUsers.size : 0,
        sentimentBreakdown,
        topUsers,
        channelActivity,
        hourlyActivity,
        dailyTrend
      }
    }
  }

  // Get user activity across all projects
  static async getUserActivity(userId: string): Promise<{
    projects: Array<{
      projectId: string
      projectName: string
      messageCount: number
      firstSeen: string
      lastSeen: string
      avgSentiment: number
    }>
    totalMessages: number
    totalProjects: number
  }> {
    const projects = await this.getAllProjects()
    const userActivity = []
    let totalMessages = 0
    
    for (const project of projects) {
      const messageKeys = await redis.keys(`message:discord:${project.id}:*`)
      let projectMessages = 0
      let firstSeen: Date | null = null
      let lastSeen: Date | null = null
      let sentimentSum = 0
      let sentimentCount = 0
      
      for (const key of messageKeys) {
        const message = await redis.json.get(key) as DiscordMessage
        if (!message || message.userId !== userId) continue
        
        projectMessages++
        totalMessages++
        
        const msgDate = new Date(message.timestamp)
        if (!firstSeen || msgDate < firstSeen) firstSeen = msgDate
        if (!lastSeen || msgDate > lastSeen) lastSeen = msgDate
        
        if (message.sentiment?.score) {
          sentimentCount++
          sentimentSum += message.sentiment.score === 'positive' ? 1 :
                         message.sentiment.score === 'negative' ? -1 : 0
        }
      }
      
      if (projectMessages > 0) {
        userActivity.push({
          projectId: project.id,
          projectName: project.name,
          messageCount: projectMessages,
          firstSeen: firstSeen!.toISOString(),
          lastSeen: lastSeen!.toISOString(),
          avgSentiment: sentimentCount > 0 ? sentimentSum / sentimentCount : 0
        })
      }
    }
    
    return {
      projects: userActivity,
      totalMessages,
      totalProjects: userActivity.length
    }
  }

  // Get trending topics/keywords
  static async getTrendingTopics(
    projectId: string,
    timeframe: 'daily' | 'weekly' = 'daily',
    limit: number = 10
  ): Promise<Array<{ word: string; count: number; sentiment: number }>> {
    const start = new Date()
    if (timeframe === 'daily') {
      start.setHours(start.getHours() - 24)
    } else {
      start.setDate(start.getDate() - 7)
    }
    
    const messageKeys = await redis.keys(`message:discord:${projectId}:*`)
    const wordCounts: Record<string, { count: number; sentiment: number; sentimentCount: number }> = {}
    
    // Common words to exclude
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'some', 'any', 'few', 'more', 'most', 'other', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'])
    
    for (const key of messageKeys) {
      const message = await redis.json.get(key) as DiscordMessage
      if (!message) continue
      
      const msgDate = new Date(message.timestamp)
      if (msgDate < start) continue
      
      // Extract words (basic tokenization)
      const words = message.content.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word))
      
      const sentimentValue = message.sentiment?.score === 'positive' ? 1 :
                            message.sentiment?.score === 'negative' ? -1 : 0
      
      for (const word of words) {
        if (!wordCounts[word]) {
          wordCounts[word] = { count: 0, sentiment: 0, sentimentCount: 0 }
        }
        wordCounts[word].count++
        if (message.sentiment?.score) {
          wordCounts[word].sentimentCount++
          wordCounts[word].sentiment += sentimentValue
        }
      }
    }
    
    // Convert to array and sort by count
    return Object.entries(wordCounts)
      .map(([word, stats]) => ({
        word,
        count: stats.count,
        sentiment: stats.sentimentCount > 0 ? stats.sentiment / stats.sentimentCount : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  // Get message engagement metrics (for future use with reactions/replies)
  static async getEngagementMetrics(projectId: string): Promise<{
    avgRepliesPerMessage: number
    topRepliedMessages: Array<{
      messageId: string
      content: string
      replyCount: number
      author: string
    }>
    conversationThreads: number
  }> {
    const messageKeys = await redis.keys(`message:discord:${projectId}:*`)
    const messages: DiscordMessage[] = []
    const replyCount: Record<string, number> = {}
    let totalReplies = 0
    
    for (const key of messageKeys) {
      const message = await redis.json.get(key) as DiscordMessage
      if (!message) continue
      messages.push(message)
      
      if (message.replyToId) {
        totalReplies++
        replyCount[message.replyToId] = (replyCount[message.replyToId] || 0) + 1
      }
    }
    
    // Get top replied messages
    const topRepliedIds = Object.entries(replyCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id)
    
    const topRepliedMessages = []
    for (const msgId of topRepliedIds) {
      const message = messages.find(m => m.id === `message:discord:${msgId}`)
      if (message) {
        topRepliedMessages.push({
          messageId: msgId,
          content: message.content.slice(0, 100) + (message.content.length > 100 ? '...' : ''),
          replyCount: replyCount[msgId],
          author: message.username
        })
      }
    }
    
    // Count unique conversation threads (messages with replies)
    const conversationThreads = Object.keys(replyCount).length
    
    return {
      avgRepliesPerMessage: messages.length > 0 ? totalReplies / messages.length : 0,
      topRepliedMessages,
      conversationThreads
    }
  }
} 