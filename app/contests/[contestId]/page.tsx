'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Contest, ContestLeaderboard } from '@/lib/types/contest'

export default function ContestDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const contestId = params.contestId as string
  
  const [contest, setContest] = useState<Contest | null>(null)
  const [leaderboard, setLeaderboard] = useState<ContestLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contestId) {
      fetchContestData()
    }
  }, [contestId])

  const fetchContestData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch contest data from API
      const contestRes = await fetch(`/api/contests/${contestId}`)
      if (!contestRes.ok) {
        throw new Error('Failed to fetch contest')
      }
      const contestData = await contestRes.json()
      
      // Fetch leaderboard data from API
      const leaderboardRes = await fetch(`/api/contests/${contestId}/leaderboard`)
      let leaderboardData = null
      if (leaderboardRes.ok) {
        leaderboardData = await leaderboardRes.json()
      }
      
      if (!contestData) {
        router.push('/contests')
        return
      }
      
      setContest(contestData)
      setLeaderboard(leaderboardData)
    } catch (error) {
      console.error('Error fetching contest data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load contest')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div className="animate-pulse">Loading contest...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <button
            onClick={() => router.push('/contests')}
            className="px-4 py-2 border border-green-400 hover:bg-green-900/30"
          >
            Back to Contests
          </button>
        </div>
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div className="text-center">
          <p className="mb-4">Contest not found</p>
          <button
            onClick={() => router.push('/contests')}
            className="px-4 py-2 border border-green-400 hover:bg-green-900/30"
          >
            Back to Contests
          </button>
        </div>
      </div>
    )
  }

  const getTimeStatus = () => {
    const now = new Date()
    const start = new Date(contest.startTime)
    const end = new Date(contest.endTime)
    
    if (now < start) {
      const diff = start.getTime() - now.getTime()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      return `Starts in ${days}d ${hours}h`
    } else if (now > end) {
      return 'Contest Ended'
    } else {
      const diff = end.getTime() - now.getTime()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      return `${days}d ${hours}h remaining`
    }
  }

  return (
    <div className="min-h-screen bg-black text-green-300">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-green-900/50 to-black border-b border-green-300">
        {contest.imageUrl && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={contest.imageUrl}
              alt={contest.name}
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
          </div>
        )}
        
        <div className="relative p-6">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => router.push('/contests')}
              className="mb-4 text-sm hover:text-white transition-colors inline-flex items-center gap-1"
            >
              ← Back to Contests
            </button>
            
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Press Start 2P, monospace' }}>
              {contest.name}
            </h1>
            
            {contest.description && (
              <p className="text-lg opacity-90">{contest.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contest Info */}
          <div className="border border-green-300 p-6">
            <h2 className="text-xl font-bold mb-4">Contest Details</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-70">Status</p>
                <p className="font-bold text-lg capitalize">{contest.status}</p>
              </div>
              <div>
                <p className="text-sm opacity-70">Time Status</p>
                <p className="font-bold text-lg">{getTimeStatus()}</p>
              </div>
              <div>
                <p className="text-sm opacity-70">Start Time</p>
                <p className="font-bold">{new Date(contest.startTime).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm opacity-70">End Time</p>
                <p className="font-bold">{new Date(contest.endTime).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Prize Distribution */}
          <div className="border border-green-300 p-6">
            <h2 className="text-xl font-bold mb-4">Prize Distribution</h2>
            <div className="space-y-2">
              {contest.prizeDistribution.tiers.slice(0, 10).map((tier, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-green-900/20">
                  <span>Position #{tier.position}</span>
                  <span className="font-bold">{tier.percentage}%</span>
                  <span className="text-yellow-400">${(contest.prizePool * tier.percentage / 100).toFixed(2)}</span>
                </div>
              ))}
              {contest.prizeDistribution.tiers.length > 10 && (
                <p className="text-sm opacity-70 text-center mt-2">
                  ...and {contest.prizeDistribution.tiers.length - 10} more positions
                </p>
              )}
            </div>
          </div>

          {/* Sponsors */}
          {contest.sponsors.length > 0 && (
            <div className="border border-green-300 p-6">
              <h2 className="text-xl font-bold mb-4">Sponsors</h2>
              <div className="flex flex-wrap gap-4">
                {contest.sponsors.map((sponsor) => (
                  <div key={sponsor.projectId} className="flex items-center gap-2">
                    {sponsor.imageUrl && (
                      <img
                        src={sponsor.imageUrl}
                        alt={sponsor.name}
                        className="w-12 h-12 rounded-full border border-green-400"
                      />
                    )}
                    <span>{sponsor.twitterHandle}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Prize Pool */}
          <div className="border-2 border-yellow-400 p-6 bg-yellow-900/20 text-center">
            <p className="text-sm opacity-70 mb-2">Total Prize Pool</p>
            <p className="text-3xl font-bold text-yellow-400">
              ${contest.prizePool.toLocaleString()}
            </p>
          </div>

          {/* Leaderboard Preview */}
          <div className="border border-green-300 p-6">
            <h3 className="font-bold mb-4">Current Leaders</h3>
            {leaderboard && leaderboard.entries.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.entries.slice(0, 5).map((entry) => (
                  <div key={entry.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">#{entry.rank}</span>
                      <span className="truncate">{entry.userHandle}</span>
                    </div>
                    <span className="text-yellow-400">{entry.totalScore}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm opacity-70">No participants yet</p>
            )}
          </div>

          {/* Action Button */}
          <div className="border-2 border-green-400 p-6 text-center bg-green-900/20">
            <p className="text-lg font-bold mb-4">Ready to compete?</p>
            <p className="text-sm opacity-70 mb-4">
              Tweet submission feature coming soon!
            </p>
            <button
              disabled
              className="w-full py-3 bg-gray-800 text-gray-500 cursor-not-allowed"
            >
              Submit Tweet (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 