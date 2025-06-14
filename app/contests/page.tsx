'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Contest, ContestLeaderboard, LeaderboardEntry } from '@/lib/types/contest'

interface ContestWithStats extends Contest {
  leaderboard?: ContestLeaderboard
  totalParticipants?: number
  totalViews?: number
  totalEngagements?: number
}

export default function ContestsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [contests, setContests] = useState<ContestWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContests()
  }, [])

  const fetchContests = async () => {
    try {
      setLoading(true)
      
      // Fetch active contests from API
      const contestsRes = await fetch('/api/contests?status=active&visibility=public')
      if (!contestsRes.ok) {
        throw new Error('Failed to fetch contests')
      }
      const activeContests = await contestsRes.json()
      console.log('Fetched contests:', activeContests.length)
      
      // Fetch additional data for each contest
      const contestsWithStats = await Promise.all(
        activeContests.map(async (contest: Contest) => {
          try {
            // Fetch contest details including leaderboard
            const detailsRes = await fetch(`/api/contests/${contest.id}`)
            if (detailsRes.ok) {
              const details = await detailsRes.json()
              
              // Calculate stats from leaderboard and submissions
              const leaderboardRes = await fetch(`/api/contests/${contest.id}/leaderboard`)
              const submissionsRes = await fetch(`/api/contests/${contest.id}/submissions`)
              
              let leaderboard: ContestLeaderboard | undefined
              let totalViews = 0
              let totalEngagements = 0
              
              if (leaderboardRes.ok) {
                leaderboard = await leaderboardRes.json()
              }
              
              if (submissionsRes.ok) {
                const { submissions } = await submissionsRes.json()
                submissions?.forEach((sub: any) => {
                  totalViews += sub.views || 0
                  totalEngagements += sub.rawEngagement || 0
                })
              }
              
              return {
                ...details,
                leaderboard,
                totalParticipants: leaderboard?.entries.length || 0,
                totalViews,
                totalEngagements
              }
            }
            return contest
          } catch (error) {
            console.error(`Error fetching details for contest ${contest.id}:`, error)
            return contest
          }
        })
      )
      
      setContests(contestsWithStats)
    } catch (error) {
      console.error('Error fetching contests:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTimeRemaining = (targetTime: Date) => {
    const now = new Date()
    const target = new Date(targetTime)
    const diff = Math.abs(target.getTime() - now.getTime())
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getContestStatus = (contest: Contest) => {
    const now = new Date()
    const start = new Date(contest.startTime)
    const end = new Date(contest.endTime)
    
    if (now < start) return 'upcoming'
    if (now > end) return 'ended'
    return 'active'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div className="animate-pulse">Loading contests...</div>
      </div>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="min-h-screen bg-black text-green-300">
      {/* Header Banner - Compact for Mobile */}
      <div className="relative h-48 sm:h-64 overflow-hidden bg-gradient-to-br from-yellow-900/50 via-amber-900/30 to-black">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          <div className="mb-3 flex items-center gap-2 sm:gap-3">
            <span className="text-3xl sm:text-5xl animate-bounce">🏆</span>
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent" 
                style={{ fontFamily: 'Press Start 2P, monospace' }}>
              CONTESTS
            </h1>
            <span className="text-3xl sm:text-5xl animate-bounce" style={{ animationDelay: '0.5s' }}>🏆</span>
          </div>
          <p className="text-sm sm:text-base opacity-90 max-w-2xl px-4" style={{ fontFamily: 'Roboto Mono, monospace' }}>
            Compete for prizes. Your tier multiplier boosts your score!
          </p>
          
          {/* Animated decoration */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent animate-pulse"></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">

        {/* Active Contests */}
        <div className="mb-8">
          {session?.user?.name?.toLowerCase() === 'sharafi_eth' && (
            <div className="flex justify-end mb-6 gap-2">
              <button
                onClick={async () => {
                  if (confirm('This will clean up all corrupted contest data. Continue?')) {
                    try {
                      const res = await fetch('/api/contests/cleanup', { method: 'POST' })
                      const data = await res.json()
                      console.log('CLEANUP RESULT:', data)
                      alert(`Cleanup complete!\nCleaned: ${data.cleaned}\nValid: ${data.valid}\nTotal checked: ${data.totalChecked}`)
                      window.location.reload()
                    } catch (error) {
                      console.error('Cleanup error:', error)
                      alert('Cleanup failed - see console')
                    }
                  }
                }}
                className="px-3 py-1 text-xs border border-orange-400 text-orange-400 hover:bg-orange-900/30"
              >
                Clean DB
              </button>
              <button
                onClick={async () => {
                  if (confirm('WARNING: This will DELETE ALL contest data! Are you sure?')) {
                    if (confirm('This action cannot be undone. Type "yes" to confirm.') === true) {
                      try {
                        const res = await fetch('/api/contests/reset-all', { method: 'POST' })
                        const data = await res.json()
                        console.log('RESET RESULT:', data)
                        alert(`Reset complete!\nDeleted ${data.deletedContests} contests\nCleared ${data.clearedIndices} indices`)
                        window.location.reload()
                      } catch (error) {
                        console.error('Reset error:', error)
                        alert('Reset failed - see console')
                      }
                    }
                  }
                }}
                className="px-3 py-1 text-xs border border-red-600 text-red-600 hover:bg-red-900/30"
              >
                RESET ALL
              </button>
            </div>
          )}
          
          {contests.length === 0 ? (
            <div className="border-2 border-dashed border-green-300/50 rounded-lg p-16 text-center bg-green-900/10">
              <span className="text-6xl mb-4 block opacity-50">🏆</span>
              <p className="text-xl mb-4">No active contests at the moment</p>
              <p className="text-sm opacity-70">Check back soon for new opportunities!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {contests.map(contest => {
                const status = getContestStatus(contest)
                
                return (
                  <div
                    key={contest.id}
                    className="border-2 border-green-300 rounded-lg overflow-hidden hover:border-yellow-400 transition-all cursor-pointer group bg-black hover:shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                    onClick={() => router.push(`/contests/${contest.id}`)}
                  >
                    {/* Contest Header with Image - Mobile Optimized */}
                    <div className="relative h-40 sm:h-48 bg-gradient-to-br from-green-900/50 to-black">
                      {contest.imageUrl ? (
                        <img
                          src={contest.imageUrl}
                          alt={contest.name}
                          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-6xl sm:text-8xl opacity-20">🏆</span>
                        </div>
                      )}
                      
                      {/* Contest Name Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-3 sm:p-4">
                        <h3 className="font-bold text-lg sm:text-xl text-white line-clamp-1">{contest.name}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm">
                          <span className={`${
                            status === 'ended' ? 'text-red-400' :
                            status === 'upcoming' ? 'text-yellow-400' :
                            'text-green-400'
                          } font-bold`}>
                            {status === 'upcoming' ? `Starts ${getTimeRemaining(contest.startTime)}` : 
                             status === 'ended' ? 'Ended' :
                             `${getTimeRemaining(contest.endTime)} left`}
                          </span>
                          <span className="text-yellow-400 font-bold">
                            ${contest.prizePool} Prize
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Contest Info - Mobile Optimized */}
                    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                      {/* Sponsors Section */}
                      {contest.sponsors.length > 0 && (
                        <div>
                          <p className="text-[10px] sm:text-xs opacity-70 mb-1.5">Sponsored by</p>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {contest.sponsors.slice(0, 4).map((sponsor) => (
                              <div key={sponsor.projectId} className="relative group/sponsor">
                                {sponsor.imageUrl ? (
                                  <img
                                    src={sponsor.imageUrl}
                                    alt={sponsor.name}
                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-green-400"
                                    title={sponsor.twitterHandle}
                                  />
                                ) : (
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-green-400 bg-green-900 flex items-center justify-center text-xs sm:text-sm font-bold">
                                    {sponsor.twitterHandle.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {contest.sponsors.length > 4 && (
                              <div className="text-[10px] sm:text-xs opacity-70">
                                +{contest.sponsors.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Stats Grid - Compact on Mobile */}
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                        <div className="bg-green-900/20 rounded p-1.5 sm:p-2">
                          <p className="text-[10px] sm:text-xs opacity-70">Players</p>
                          <p className="text-sm sm:text-lg font-bold text-green-400">
                            {contest.totalParticipants || 0}
                          </p>
                        </div>
                        <div className="bg-green-900/20 rounded p-1.5 sm:p-2">
                          <p className="text-[10px] sm:text-xs opacity-70">Views</p>
                          <p className="text-sm sm:text-lg font-bold text-blue-400">
                            {formatNumber(contest.totalViews || 0)}
                          </p>
                        </div>
                        <div className="bg-green-900/20 rounded p-1.5 sm:p-2">
                          <p className="text-[10px] sm:text-xs opacity-70">Engage</p>
                          <p className="text-sm sm:text-lg font-bold text-yellow-400">
                            {formatNumber(contest.totalEngagements || 0)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Top 5 Leaderboard - Mobile Optimized */}
                      {contest.leaderboard && contest.leaderboard.entries.length > 0 && (
                        <div>
                          <p className="text-[10px] sm:text-xs opacity-70 mb-1.5">Current Leaders</p>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {contest.leaderboard.entries.slice(0, 5).map((entry, index) => (
                              <div key={entry.userId} className="relative">
                                <div className="relative">
                                  {entry.userImage ? (
                                    <img
                                      src={entry.userImage}
                                      alt={entry.userHandle}
                                      className={`rounded-full border-2 ${
                                        index === 0 ? 'w-9 h-9 sm:w-10 sm:h-10 border-yellow-400' :
                                        index === 1 ? 'w-8 h-8 sm:w-9 sm:h-9 border-gray-400' :
                                        index === 2 ? 'w-8 h-8 sm:w-9 sm:h-9 border-amber-600' :
                                        'w-7 h-7 sm:w-8 sm:h-8 border-green-400'
                                      }`}
                                    />
                                  ) : (
                                    <div className={`rounded-full border-2 bg-green-900 flex items-center justify-center font-bold ${
                                      index === 0 ? 'w-9 h-9 sm:w-10 sm:h-10 border-yellow-400 text-xs sm:text-sm' :
                                      index === 1 ? 'w-8 h-8 sm:w-9 sm:h-9 border-gray-400 text-xs sm:text-sm' :
                                      index === 2 ? 'w-8 h-8 sm:w-9 sm:h-9 border-amber-600 text-xs sm:text-sm' :
                                      'w-7 h-7 sm:w-8 sm:h-8 border-green-400 text-[10px] sm:text-xs'
                                    }`}>
                                      {entry.userHandle.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  {index < 3 && (
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                      index === 0 ? 'bg-yellow-400 text-black' :
                                      index === 1 ? 'bg-gray-400 text-black' :
                                      'bg-amber-600 text-white'
                                    }`}>
                                      {index + 1}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {contest.totalParticipants && contest.totalParticipants > 5 && (
                              <span className="text-[10px] sm:text-xs opacity-70">
                                +{contest.totalParticipants - 5}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Action Button - Mobile Optimized */}
                      <button className="w-full py-2.5 sm:py-3 rounded-lg border-2 border-yellow-400 bg-yellow-900/20 hover:bg-yellow-900/40 transition-all text-yellow-400 font-bold text-sm sm:text-base group-hover:shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                        {status === 'upcoming' ? '🔒 View Details' :
                         status === 'ended' ? '📊 View Results' :
                         '🚀 Join Contest'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 