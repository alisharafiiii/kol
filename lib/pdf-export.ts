import jsPDF from 'jspdf'
import type { CampaignKOL, KOLTier } from './types/profile'
import type { Campaign } from './campaign'

interface AnalyticsData {
  campaign: Campaign
  kols: CampaignKOL[]
  totalKOLs: number
  totalBudget: number
  totalViews: number
  totalEngagement: number
  costPerView: number
  costPerEngagement: number
  averageEngagementRate: number
  tierDistribution: Array<{
    name: string
    value: number
    views: number
    budget: number
    color?: string
  }>
  topPerformers: Array<{
    handle: string
    name: string
    tier: KOLTier
    views: number
    engagement: number
    score: number
    roi?: number
  }>
  platformBreakdown?: Array<{
    name: string
    value: number
    views: number
  }>
  stageDistribution?: Array<{
    name: string
    value: number
  }>
  paymentDistribution?: Array<{
    name: string
    value: number
    amount: number
  }>
  timelineData?: Array<{
    date: string
    views: number
    engagement: number
    posts: number
  }>
  userProfileImage?: string
  userName?: string
  logoBase64?: string
}

export class PDFExporter {
  private doc: jsPDF
  private pageWidth: number
  private pageHeight: number
  private margin: number
  private currentY: number
  private readonly bgColor = '#000000'
  private readonly textColor = '#22c55e'
  private readonly accentColor = '#16a34a'
  private readonly mutedColor = '#4ade80'
  private readonly borderColor = '#166534'
  
  // Terminal colors
  private readonly colors = {
    black: [0, 0, 0] as [number, number, number],
    green: [34, 197, 94] as [number, number, number],
    darkGreen: [22, 163, 74] as [number, number, number],
    lightGreen: [74, 222, 128] as [number, number, number],
    gray: [156, 163, 175] as [number, number, number],
    darkGray: [75, 85, 99] as [number, number, number],
    yellow: [251, 191, 36] as [number, number, number],
    purple: [167, 139, 250] as [number, number, number],
    blue: [96, 165, 250] as [number, number, number],
    red: [239, 68, 68] as [number, number, number]
  }
  
  // Tier colors matching the website
  private readonly tierColors: Record<string, [number, number, number]> = {
    'Hero': [251, 191, 36],
    'Legend': [167, 139, 250], 
    'Star': [96, 165, 250],
    'Rising': [134, 239, 172],
    'Micro': [156, 163, 175]
  }
  
  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    this.pageWidth = this.doc.internal.pageSize.getWidth()
    this.pageHeight = this.doc.internal.pageSize.getHeight()
    this.margin = 15
    this.currentY = this.margin
  }
  
  // Export analytics report with terminal aesthetic
  async exportAnalytics(data: AnalyticsData): Promise<Blob> {
    // First page with black background
    this.addTerminalBackground()
    
    // Header with logo and profile
    await this.addTerminalHeader(data)
    
    // Executive Summary
    this.addTerminalSection('> EXECUTIVE SUMMARY')
    this.addKeyMetricsTerminal(data)
    
    // Efficiency Metrics
    this.addTerminalSection('> EFFICIENCY METRICS')
    this.addEfficiencyMetrics(data)
    
    // New page for charts
    this.addPageBreak()
    this.addTerminalBackground()
    await this.addPageHeader(data)
    
    // Tier Distribution Chart
    this.addTerminalSection('> KOL TIER DISTRIBUTION')
    this.addTierDistributionChart(data.tierDistribution)
    
    // Platform Breakdown
    if (data.platformBreakdown) {
      this.addTerminalSection('> PLATFORM DISTRIBUTION')
      this.addPlatformChart(data.platformBreakdown)
    }
    
    // New page for more analytics
    this.addPageBreak()
    this.addTerminalBackground()
    await this.addPageHeader(data)
    
    // Stage Distribution
    if (data.stageDistribution) {
      this.addTerminalSection('> CAMPAIGN STAGE PROGRESS')
      this.addStageProgress(data.stageDistribution, data.totalKOLs)
    }
    
    // Payment Status
    if (data.paymentDistribution) {
      this.addTerminalSection('> PAYMENT STATUS')
      this.addPaymentStatus(data.paymentDistribution, data.totalBudget)
    }
    
    // New page for timeline
    if (data.timelineData && data.timelineData.length > 0) {
      this.addPageBreak()
      this.addTerminalBackground()
      await this.addPageHeader(data)
      
      this.addTerminalSection('> PERFORMANCE TIMELINE')
      this.addTimeline(data.timelineData)
    }
    
    // Top Performers
    this.addPageBreak()
    this.addTerminalBackground()
    await this.addPageHeader(data)
    
    this.addTerminalSection('> TOP PERFORMERS')
    this.addTopPerformersTerminal(data.topPerformers)
    
    // Footer on all pages
    this.addTerminalFooterToAllPages()
    
    return this.doc.output('blob')
  }
  
  // Add terminal-style background
  private addTerminalBackground() {
    this.doc.setFillColor(...this.colors.black)
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F')
  }
  
  // Add terminal-style header with logo and profile
  private async addTerminalHeader(data: AnalyticsData) {
    // Terminal window frame
    this.doc.setFillColor(31, 41, 55) // Dark gray
    this.doc.rect(0, 0, this.pageWidth, 40, 'F')
    
    // Terminal dots
    const dotY = 10
    this.doc.setFillColor(239, 68, 68) // Red
    this.doc.circle(15, dotY, 2, 'F')
    this.doc.setFillColor(251, 191, 36) // Yellow
    this.doc.circle(23, dotY, 2, 'F')
    this.doc.setFillColor(34, 197, 94) // Green
    this.doc.circle(31, dotY, 2, 'F')
    
    // Logo (left side)
    try {
      if (data.logoBase64) {
        this.doc.addImage(data.logoBase64, 'PNG', 15, 15, 20, 20)
      } else {
        throw new Error('No logo')
      }
    } catch (e) {
      // Fallback text if logo fails
      this.doc.setFontSize(14)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text('KOL', 20, 25)
    }
    
    // User profile (right side)
    if (data.userProfileImage) {
      try {
        // Add circular clip for profile image
        this.doc.addImage(data.userProfileImage, 'PNG', this.pageWidth - 35, 15, 20, 20)
      } catch (e) {
        // Fallback to initials
        const initials = (data.userName || 'KOL').substring(0, 2).toUpperCase()
        this.doc.setFillColor(...this.colors.darkGreen)
        this.doc.circle(this.pageWidth - 25, 25, 10, 'F')
        this.doc.setFontSize(12)
        this.doc.setTextColor(...this.colors.green)
        this.doc.text(initials, this.pageWidth - 25, 28, { align: 'center' })
      }
    }
    
    // Title
    this.doc.setFontSize(20)
    this.doc.setTextColor(...this.colors.green)
    this.doc.text('CAMPAIGN ANALYTICS REPORT', this.pageWidth / 2, 25, { align: 'center' })
    
    // Campaign name
    this.doc.setFontSize(14)
    this.doc.setTextColor(...this.colors.lightGreen)
    this.doc.text(data.campaign.name, this.pageWidth / 2, 33, { align: 'center' })
    
    this.currentY = 50
  }
  
  // Simplified header for subsequent pages
  private async addPageHeader(data: AnalyticsData) {
    // Terminal bar
    this.doc.setFillColor(31, 41, 55)
    this.doc.rect(0, 0, this.pageWidth, 25, 'F')
    
    // Logo (small)
    try {
      if (data.logoBase64) {
        this.doc.addImage(data.logoBase64, 'PNG', 10, 5, 15, 15)
      } else {
        throw new Error('No logo')
      }
    } catch (e) {
      this.doc.setFontSize(10)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text('KOL', 15, 13)
    }
    
    // Title
    this.doc.setFontSize(12)
    this.doc.setTextColor(...this.colors.green)
    this.doc.text(data.campaign.name, this.pageWidth / 2, 13, { align: 'center' })
    
    // User profile (small)
    if (data.userProfileImage) {
      try {
        this.doc.addImage(data.userProfileImage, 'PNG', this.pageWidth - 25, 5, 15, 15)
      } catch (e) {
        // Fallback
      }
    }
    
    this.currentY = 35
  }
  
  // Terminal-style section header
  private addTerminalSection(title: string) {
    this.checkPageBreak(20)
    this.doc.setFontSize(14)
    this.doc.setTextColor(...this.colors.green)
    this.doc.text(title, this.margin, this.currentY)
    this.currentY += 8
    
    // Terminal cursor
    this.doc.setFillColor(...this.colors.green)
    this.doc.rect(this.margin + this.doc.getTextWidth(title) + 2, this.currentY - 6, 8, 2, 'F')
    this.currentY += 5
  }
  
  // Key metrics in terminal style
  private addKeyMetricsTerminal(data: AnalyticsData) {
    const metrics = [
      { label: 'Total KOLs', value: data.totalKOLs.toString(), icon: '👥' },
      { label: 'Total Budget', value: `$${data.totalBudget.toLocaleString()}`, icon: '💰' },
      { label: 'Total Views', value: this.formatNumber(data.totalViews), icon: '👁️' },
      { label: 'Total Engagement', value: this.formatNumber(data.totalEngagement), icon: '💬' }
    ]
    
    const boxWidth = (this.pageWidth - 2 * this.margin - 15) / 2
    const boxHeight = 30
    
    metrics.forEach((metric, index) => {
      const x = this.margin + (index % 2) * (boxWidth + 15)
      const y = this.currentY + Math.floor(index / 2) * (boxHeight + 10)
      
      // Terminal box
      this.doc.setDrawColor(...this.colors.green)
      this.doc.setLineWidth(0.5)
      this.doc.rect(x, y, boxWidth, boxHeight)
      
      // Metric content
      this.doc.setFontSize(10)
      this.doc.setTextColor(...this.colors.lightGreen)
      this.doc.text(metric.label, x + 5, y + 10)
      
      this.doc.setFontSize(16)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(metric.value, x + 5, y + 22)
    })
    
    this.currentY += 2 * (boxHeight + 10) + 10
  }
  
  // Efficiency metrics
  private addEfficiencyMetrics(data: AnalyticsData) {
    const metrics = [
      { label: 'Avg Engagement Rate', value: `${data.averageEngagementRate.toFixed(2)}%` },
      { label: 'Cost per View', value: `$${data.costPerView.toFixed(4)}` },
      { label: 'Cost per Engagement', value: `$${data.costPerEngagement.toFixed(2)}` }
    ]
    
    const boxWidth = (this.pageWidth - 2 * this.margin - 20) / 3
    
    metrics.forEach((metric, index) => {
      const x = this.margin + index * (boxWidth + 10)
      
      // Progress bar background
      this.doc.setFillColor(...this.colors.darkGray)
      this.doc.rect(x, this.currentY, boxWidth, 20, 'F')
      
      // Progress bar fill (example)
      this.doc.setFillColor(...this.colors.green)
      this.doc.rect(x, this.currentY, boxWidth * 0.7, 20, 'F')
      
      // Text
      this.doc.setFontSize(8)
      this.doc.setTextColor(...this.colors.black)
      this.doc.text(metric.label, x + 3, this.currentY + 8)
      
      this.doc.setFontSize(10)
      this.doc.text(metric.value, x + 3, this.currentY + 16)
    })
    
    this.currentY += 30
  }
  
  // Tier distribution with actual pie chart
  private addTierDistributionChart(tiers: AnalyticsData['tierDistribution']) {
    if (!tiers || tiers.length === 0) return
    
    const centerX = this.pageWidth / 2
    const centerY = this.currentY + 40
    const radius = 35
    
    // Calculate angles
    const total = tiers.reduce((sum, tier) => sum + tier.value, 0)
    if (total === 0) {
      this.doc.setFontSize(10)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text('No KOL data available', centerX, centerY, { align: 'center' })
      this.currentY += 80
      return
    }
    
    let currentAngle = -90 // Start from top
    
    // Draw pie slices using paths
    tiers.forEach((tier) => {
      const percentage = tier.value / total
      const angle = percentage * 360
      
      // Use tier-specific colors
      this.doc.setFillColor(...(this.tierColors[tier.name] || this.colors.gray))
      
      // Draw slice using path (approximation with many points)
      const steps = Math.max(Math.floor(angle / 2), 1)
      const points: Array<[number, number]> = [[centerX, centerY]]
      
      for (let i = 0; i <= steps; i++) {
        const a = (currentAngle + (i * angle / steps)) * Math.PI / 180
        const x = centerX + radius * Math.cos(a)
        const y = centerY + radius * Math.sin(a)
        points.push([x, y])
      }
      
      // Draw filled polygon
      if (points.length > 2) {
        // Draw filled shape manually using lines and fill
        this.doc.setDrawColor(...(this.tierColors[tier.name] || this.colors.gray))
        this.doc.setLineWidth(0.1)
        
        // Move to center
        let path = `M ${centerX} ${centerY} `
        
        // Draw arc
        for (let i = 1; i < points.length; i++) {
          path += `L ${points[i][0]} ${points[i][1]} `
        }
        
        // Close path
        path += 'Z'
        
        // Since jsPDF doesn't support path, we'll use a series of triangles
        for (let i = 1; i < points.length - 1; i++) {
          const x1 = centerX
          const y1 = centerY
          const x2 = points[i][0]
          const y2 = points[i][1]
          const x3 = points[i + 1][0]
          const y3 = points[i + 1][1]
          
          // Draw filled triangle using lines
          this.doc.setFillColor(...(this.tierColors[tier.name] || this.colors.gray))
          this.doc.lines([[x2 - x1, y2 - y1], [x3 - x2, y3 - y2], [x1 - x3, y1 - y3]], x1, y1, [1, 1], 'F')
        }
      }
      
      currentAngle += angle
    })
    
    // Add border to pie chart
    this.doc.setDrawColor(...this.colors.green)
    this.doc.setLineWidth(0.5)
    this.doc.circle(centerX, centerY, radius)
    
    // Add legend
    let legendY = this.currentY
    tiers.forEach((tier, index) => {
      const x = index < 3 ? this.margin : this.pageWidth / 2 + 10
      const y = legendY + (index % 3) * 15
      
      // Color box
      this.doc.setFillColor(...(this.tierColors[tier.name] || this.colors.gray))
      this.doc.rect(x, y, 8, 8, 'F')
      
      // Text
      this.doc.setFontSize(9)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(`${tier.name}: ${tier.value} (${tier.views.toLocaleString()} views)`, x + 12, y + 6)
    })
    
    this.currentY = centerY + radius + 30
  }
  
  // Platform breakdown bar chart
  private addPlatformChart(platforms: AnalyticsData['platformBreakdown']) {
    if (!platforms || platforms.length === 0) return
    
    const barWidth = (this.pageWidth - 2 * this.margin - (platforms.length - 1) * 5) / platforms.length
    const maxHeight = 60
    const maxValue = Math.max(...platforms.map(p => p.views))
    
    platforms.forEach((platform, index) => {
      const x = this.margin + index * (barWidth + 5)
      const height = (platform.views / maxValue) * maxHeight
      const y = this.currentY + maxHeight - height
      
      // Bar
      this.doc.setFillColor(...this.colors.blue)
      this.doc.rect(x, y, barWidth, height, 'F')
      
      // Value on top
      this.doc.setFontSize(8)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(this.formatNumber(platform.views), x + barWidth / 2, y - 3, { align: 'center' })
      
      // Label
      this.doc.text(platform.name, x + barWidth / 2, this.currentY + maxHeight + 8, { align: 'center' })
    })
    
    this.currentY += maxHeight + 20
  }
  
  // Stage progress bars
  private addStageProgress(stages: AnalyticsData['stageDistribution'], totalKOLs: number) {
    if (!stages || stages.length === 0) return
    
    stages.forEach((stage, index) => {
      this.checkPageBreak(15)
      
      const percentage = (stage.value / totalKOLs) * 100
      const barWidth = this.pageWidth - 2 * this.margin - 80
      
      // Stage name
      this.doc.setFontSize(9)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(stage.name, this.margin, this.currentY + 4)
      
      // Progress bar background
      this.doc.setFillColor(...this.colors.darkGray)
      this.doc.rect(this.margin + 70, this.currentY, barWidth, 8, 'F')
      
      // Progress bar fill
      this.doc.setFillColor(...this.colors.yellow)
      this.doc.rect(this.margin + 70, this.currentY, barWidth * (percentage / 100), 8, 'F')
      
      // Value
      this.doc.setFontSize(8)
      this.doc.setTextColor(...this.colors.lightGreen)
      this.doc.text(`${stage.value}`, this.pageWidth - this.margin - 20, this.currentY + 6)
      
      this.currentY += 12
    })
    
    this.currentY += 10
  }
  
  // Payment status visualization
  private addPaymentStatus(payments: AnalyticsData['paymentDistribution'], totalBudget: number) {
    if (!payments || payments.length === 0) return
    
    const statusColors: Record<string, [number, number, number]> = {
      'Paid': this.colors.green,
      'Approved': this.colors.blue,
      'Rejected': this.colors.red,
      'Pending': this.colors.gray
    }
    
    payments.forEach((payment) => {
      this.checkPageBreak(20)
      
      const percentage = (payment.amount / totalBudget) * 100
      const barWidth = this.pageWidth - 2 * this.margin - 90
      
      // Status name
      this.doc.setFontSize(9)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(payment.name, this.margin, this.currentY + 4)
      
      // Count
      this.doc.setFontSize(8)
      this.doc.setTextColor(...this.colors.lightGreen)
      this.doc.text(`${payment.value} KOLs`, this.margin + 45, this.currentY + 4)
      
      // Bar
      this.doc.setFillColor(...this.colors.darkGray)
      this.doc.rect(this.margin + 90, this.currentY, barWidth, 8, 'F')
      
      this.doc.setFillColor(...(statusColors[payment.name] || this.colors.gray))
      this.doc.rect(this.margin + 90, this.currentY, barWidth * (percentage / 100), 8, 'F')
      
      // Amount and percentage
      this.doc.setFontSize(8)
      this.doc.text(
        `$${payment.amount.toLocaleString()} (${percentage.toFixed(0)}%)`,
        this.margin + 90, 
        this.currentY + 14
      )
      
      this.currentY += 18
    })
    
    this.currentY += 10
  }
  
  // Timeline visualization
  private addTimeline(timeline: AnalyticsData['timelineData']) {
    if (!timeline || timeline.length === 0) return
    
    // Need at least 2 points to draw a line
    if (timeline.length < 2) {
      this.doc.setFontSize(10)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text('Not enough data points for timeline visualization', this.margin, this.currentY + 30)
      this.currentY += 50
      return
    }
    
    const chartWidth = this.pageWidth - 2 * this.margin
    const chartHeight = 60
    const maxViews = Math.max(...timeline.map(t => t.views || 0))
    const maxEngagement = Math.max(...timeline.map(t => t.engagement || 0))
    
    // Skip if no data
    if (maxViews === 0 && maxEngagement === 0) {
      this.doc.setFontSize(10)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text('No view or engagement data available', this.margin, this.currentY + 30)
      this.currentY += 50
      return
    }
    
    // Chart background
    this.doc.setFillColor(...this.colors.darkGray)
    this.doc.rect(this.margin, this.currentY, chartWidth, chartHeight, 'F')
    
    // Grid lines
    this.doc.setDrawColor(...this.colors.gray)
    this.doc.setLineWidth(0.1)
    for (let i = 0; i <= 4; i++) {
      const y = this.currentY + (i * chartHeight / 4)
      this.doc.line(this.margin, y, this.margin + chartWidth, y)
    }
    
    // Plot data
    const pointSpacing = chartWidth / (timeline.length - 1)
    
    // Views line (green) - only if we have views data
    if (maxViews > 0) {
      this.doc.setDrawColor(...this.colors.green)
      this.doc.setLineWidth(1)
      
      for (let i = 1; i < timeline.length; i++) {
        const x1 = this.margin + (i - 1) * pointSpacing
        const x2 = this.margin + i * pointSpacing
        const y1 = this.currentY + chartHeight - ((timeline[i - 1].views || 0) / maxViews) * chartHeight
        const y2 = this.currentY + chartHeight - ((timeline[i].views || 0) / maxViews) * chartHeight
        
        // Validate coordinates
        if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2)) {
          this.doc.line(x1, y1, x2, y2)
        }
      }
    }
    
    // Engagement line (blue) - only if we have engagement data
    if (maxEngagement > 0) {
      this.doc.setDrawColor(...this.colors.blue)
      this.doc.setLineWidth(0.5)
      
      for (let i = 1; i < timeline.length; i++) {
        const x1 = this.margin + (i - 1) * pointSpacing
        const x2 = this.margin + i * pointSpacing
        const y1 = this.currentY + chartHeight - ((timeline[i - 1].engagement || 0) / maxEngagement) * chartHeight
        const y2 = this.currentY + chartHeight - ((timeline[i].engagement || 0) / maxEngagement) * chartHeight
        
        // Validate coordinates
        if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2)) {
          this.doc.line(x1, y1, x2, y2)
        }
      }
    }
    
    // Date labels
    this.doc.setFontSize(7)
    this.doc.setTextColor(...this.colors.green)
    const labelInterval = Math.max(1, Math.ceil(timeline.length / 5))
    timeline.forEach((point, index) => {
      if (index % labelInterval === 0 || index === timeline.length - 1) {
        const x = this.margin + index * pointSpacing
        if (isFinite(x)) {
          this.doc.text(point.date || '', x, this.currentY + chartHeight + 8, { align: 'center' })
        }
      }
    })
    
    // Legend
    this.doc.setFontSize(8)
    let legendX = this.margin
    
    if (maxViews > 0) {
      this.doc.setFillColor(...this.colors.green)
      this.doc.rect(legendX, this.currentY + chartHeight + 15, 10, 2, 'F')
      this.doc.text('Views', legendX + 15, this.currentY + chartHeight + 17)
      legendX += 50
    }
    
    if (maxEngagement > 0) {
      this.doc.setFillColor(...this.colors.blue)
      this.doc.rect(legendX, this.currentY + chartHeight + 15, 10, 2, 'F')
      this.doc.text('Engagement', legendX + 15, this.currentY + chartHeight + 17)
    }
    
    this.currentY += chartHeight + 30
  }
  
  // Top performers in terminal style
  private addTopPerformersTerminal(performers: AnalyticsData['topPerformers']) {
    // Terminal table header
    this.doc.setFillColor(...this.colors.darkGreen)
    this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 10, 'F')
    
    const headers = ['#', 'KOL', 'TIER', 'VIEWS', 'ENGAGEMENT', 'SCORE', 'ROI']
    const colWidths = [10, 45, 20, 25, 30, 20, 20]
    
    // Headers
    let xPos = this.margin + 2
    this.doc.setFontSize(9)
    this.doc.setTextColor(...this.colors.black)
    headers.forEach((header, index) => {
      this.doc.text(header, xPos, this.currentY + 7)
      xPos += colWidths[index]
    })
    
    this.currentY += 15
    
    // Data rows
    performers.slice(0, 10).forEach((performer, index) => {
      this.checkPageBreak(12)
      
      // Alternate row background
      if (index % 2 === 0) {
        this.doc.setFillColor(15, 15, 15)
        this.doc.rect(this.margin, this.currentY - 5, this.pageWidth - 2 * this.margin, 10, 'F')
      }
      
      xPos = this.margin + 2
      this.doc.setFontSize(8)
      
      // Rank with color
      this.doc.setTextColor(...(index < 3 ? this.colors.yellow : this.colors.green))
      this.doc.text(`${index + 1}`, xPos, this.currentY)
      xPos += colWidths[0]
      
      // Name
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(performer.name, xPos, this.currentY)
      xPos += colWidths[1]
      
      // Tier with color
      this.doc.setTextColor(...(this.tierColors[performer.tier.charAt(0).toUpperCase() + performer.tier.slice(1)] || this.colors.gray))
      this.doc.text(performer.tier.toUpperCase(), xPos, this.currentY)
      xPos += colWidths[2]
      
      // Views
      this.doc.setTextColor(...this.colors.lightGreen)
      this.doc.text(this.formatNumber(performer.views), xPos, this.currentY)
      xPos += colWidths[3]
      
      // Engagement
      this.doc.text(this.formatNumber(performer.engagement), xPos, this.currentY)
      xPos += colWidths[4]
      
      // Score
      this.doc.text(performer.score.toFixed(0), xPos, this.currentY)
      xPos += colWidths[5]
      
      // ROI
      this.doc.setTextColor(...this.colors.yellow)
      this.doc.text(performer.roi ? `${performer.roi.toFixed(1)}x` : '-', xPos, this.currentY)
      
      this.currentY += 10
    })
  }
  
  // Helper methods remain mostly the same but with terminal styling
  private checkPageBreak(requiredSpace: number) {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin - 15) {
      this.addPageBreak()
    }
  }
  
  private addPageBreak() {
    this.doc.addPage()
    this.addTerminalBackground()
    this.currentY = this.margin
  }
  
  private addTerminalFooterToAllPages() {
    const pageCount = this.doc.internal.pages.length - 1
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      
      // Footer bar
      this.doc.setFillColor(31, 41, 55)
      this.doc.rect(0, this.pageHeight - 15, this.pageWidth, 15, 'F')
      
      // Terminal prompt style
      this.doc.setFontSize(8)
      this.doc.setTextColor(...this.colors.green)
      this.doc.text(`[${i}/${pageCount}]`, 10, this.pageHeight - 6)
      
      // Center text
      this.doc.text('KOL PLATFORM - CONFIDENTIAL', this.pageWidth / 2, this.pageHeight - 6, { align: 'center' })
      
      // Date
      this.doc.text(
        new Date().toISOString().split('T')[0],
        this.pageWidth - 10,
        this.pageHeight - 6,
        { align: 'right' }
      )
    }
  }
  
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }
  
  // Export KOL list with terminal aesthetic
  async exportKOLList(
    campaign: Campaign, 
    kols: CampaignKOL[],
    options?: {
      userProfileImage?: string
      userName?: string
      logoBase64?: string
    }
  ): Promise<Blob> {
    // First page setup
    this.addTerminalBackground()
    
    // Header
    await this.addTerminalHeader({
      campaign,
      kols,
      totalKOLs: kols.length,
      totalBudget: kols.reduce((sum, k) => sum + k.budget, 0),
      totalViews: 0,
      totalEngagement: 0,
      costPerView: 0,
      costPerEngagement: 0,
      averageEngagementRate: 0,
      tierDistribution: [],
      topPerformers: [],
      userProfileImage: options?.userProfileImage,
      userName: options?.userName,
      logoBase64: options?.logoBase64
    })
    
    // Summary
    this.addTerminalSection('> CAMPAIGN KOL LIST')
    
    this.doc.setFontSize(10)
    this.doc.setTextColor(...this.colors.green)
    this.doc.text(`Total KOLs: ${kols.length}`, this.margin, this.currentY)
    this.currentY += 8
    this.doc.text(`Total Budget: $${kols.reduce((sum, k) => sum + k.budget, 0).toLocaleString()}`, this.margin, this.currentY)
    this.currentY += 15
    
    // KOL Table
    this.addTerminalKOLTable(kols)
    
    // Footer
    this.addTerminalFooterToAllPages()
    
    return this.doc.output('blob')
  }
  
  private addTerminalKOLTable(kols: CampaignKOL[]) {
    // Table header
    this.doc.setFillColor(...this.colors.darkGreen)
    this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 10, 'F')
    
    const headers = ['NAME', 'HANDLE', 'TIER', 'PLATFORM', 'STAGE', 'BUDGET']
    const colWidths = [35, 30, 18, 22, 35, 25]
    
    let xPos = this.margin + 2
    this.doc.setFontSize(9)
    this.doc.setTextColor(...this.colors.black)
    headers.forEach((header, index) => {
      this.doc.text(header, xPos, this.currentY + 7)
      xPos += colWidths[index]
    })
    
    this.currentY += 15
    
    // Data rows
    kols.forEach((kol, index) => {
      this.checkPageBreak(12)
      
      // Alternate row colors
      if (index % 2 === 0) {
        this.doc.setFillColor(15, 15, 15)
        this.doc.rect(this.margin, this.currentY - 5, this.pageWidth - 2 * this.margin, 10, 'F')
      }
      
      xPos = this.margin + 2
      this.doc.setFontSize(8)
      this.doc.setTextColor(...this.colors.green)
      
      const rowData = [
        kol.kolName || '-',
        `@${kol.kolHandle}`,
        kol.tier.toUpperCase(),
        kol.platform.toUpperCase(),
        kol.stage.replace(/_/g, ' ').toUpperCase(),
        `$${kol.budget.toLocaleString()}`
      ]
      
      rowData.forEach((data, colIndex) => {
        // Apply tier color to tier column
        if (colIndex === 2) {
          this.doc.setTextColor(...(this.tierColors[kol.tier.charAt(0).toUpperCase() + kol.tier.slice(1)] || this.colors.gray))
        } else {
          this.doc.setTextColor(...this.colors.green)
        }
        
        // Truncate long text
        const maxWidth = colWidths[colIndex] - 2
        const text = this.doc.splitTextToSize(data, maxWidth)[0]
        this.doc.text(text, xPos, this.currentY)
        xPos += colWidths[colIndex]
      })
      
      this.currentY += 10
    })
  }
  
  // Static helper to download PDF
  static download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
} 