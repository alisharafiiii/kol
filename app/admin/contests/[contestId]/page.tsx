'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Contest, ContestSubmission, ContestLeaderboard } from '@/lib/types/contest'
import { ContestService } from '@/lib/services/contest-service'

type Tab = 'overview' | 'submissions' | 'leaderboard'

export default function ContestDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const contestId = params.contestId as string
  
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [contest, setContest] = useState<Contest | null>(null)
  const [submissions, setSubmissions] = useState<ContestSubmission[]>([])
  const [leaderboard, setLeaderboard] = useState<ContestLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)

  // Check authorization
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Check if user has admin role
    const userRole = (session as any)?.user?.role || (session as any)?.role
    if (userRole !== 'admin') {
      router.push('/access-denied')
    }
  }, [session, status, router])

  // Fetch contest data
  useEffect(() => {
    if (contestId) {
      fetchContestData()
    }
  }, [contestId])

  const fetchContestData = async () => {
    try {
      setLoading(true)
      const [contestData, submissionsData, leaderboardData] = await Promise.all([
        ContestService.getContestById(contestId),
        ContestService.getContestSubmissions(contestId),
        ContestService.getLeaderboard(contestId)
      ])
      
      if (!contestData) {
        router.push('/admin/contests')
        return
      }
      
      setContest(contestData)
      setSubmissions(submissionsData)
      setLeaderboard(leaderboardData)
    } catch (error) {
      console.error('Error fetching contest data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: Contest['status']) => {
    if (!contest) return
    
    try {
      const updated = await ContestService.updateContest(
        contest.id,
        { status: newStatus },
        session?.user?.email || 'admin'
      )
      setContest(updated)
    } catch (error) {
      console.error('Error updating contest status:', error)
    }
  }

  const handleUpdateVisibility = async (newVisibility: Contest['visibility']) => {
    if (!contest) return
    
    try {
      const updated = await ContestService.updateContest(
        contest.id,
        { visibility: newVisibility },
        session?.user?.email || 'admin'
      )
      setContest(updated)
    } catch (error) {
      console.error('Error updating contest visibility:', error)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div>Contest not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Press Start 2P, monospace' }}>
              {contest.name}
            </h1>
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 text-xs rounded ${
                contest.status === 'active' ? 'bg-green-900 text-green-300' :
                contest.status === 'draft' ? 'bg-yellow-900 text-yellow-300' :
                'bg-red-900 text-red-300'
              }`}>
                {contest.status}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded ${
                contest.visibility === 'public' ? 'bg-blue-900 text-blue-300' :
                'bg-gray-900 text-gray-300'
              }`}>
                {contest.visibility}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/contests')}
            className="px-4 py-2 border border-green-400 hover:bg-green-900/30"
          >
            Back to Contests
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-6 p-4 border border-green-300">
          <div>
            <label className="text-xs block mb-1">Status</label>
            <select
              value={contest.status}
              onChange={(e) => handleUpdateStatus(e.target.value as Contest['status'])}
              className="bg-black border border-green-300 p-1 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1">Visibility</label>
            <select
              value={contest.visibility}
              onChange={(e) => handleUpdateVisibility(e.target.value as Contest['visibility'])}
              className="bg-black border border-green-300 p-1 text-sm"
            >
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1">Contest URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}/contests/${contest.id}`}
                readOnly
                className="bg-black border border-green-300 p-1 text-sm"
              />
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/contests/${contest.id}`)}
                className="px-2 py-1 text-xs border border-green-400 hover:bg-green-900/30"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-green-300">
          <button
            className={`px-4 py-2 ${activeTab === 'overview' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'submissions' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            Submissions ({submissions.length})
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'leaderboard' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Contest Info */}
            <div className="border border-green-300 p-4">
              <h2 className="text-lg font-bold mb-4">Contest Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs opacity-70">Start Time</label>
                  <p>{new Date(contest.startTime).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs opacity-70">End Time</label>
                  <p>{new Date(contest.endTime).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs opacity-70">Prize Pool</label>
                  <p className="text-xl font-bold">${contest.prizePool}</p>
                </div>
                <div>
                  <label className="text-xs opacity-70">Total Submissions</label>
                  <p className="text-xl font-bold">{submissions.length}</p>
                </div>
              </div>
              
              {contest.description && (
                <div className="mt-4">
                  <label className="text-xs opacity-70">Description</label>
                  <p className="mt-1">{contest.description}</p>
                </div>
              )}
            </div>

            {/* Sponsors */}
            {contest.sponsors.length > 0 && (
              <div className="border border-green-300 p-4">
                <h2 className="text-lg font-bold mb-4">Sponsors</h2>
                <div className="flex flex-wrap gap-4">
                  {contest.sponsors.map(sponsor => (
                    <div key={sponsor.projectId} className="flex items-center gap-2 border border-green-400 p-2">
                      {sponsor.imageUrl && (
                        <img
                          src={sponsor.imageUrl}
                          alt={sponsor.name}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <span>{sponsor.twitterHandle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prize Distribution */}
            <div className="border border-green-300 p-4">
              <h2 className="text-lg font-bold mb-4">Prize Distribution</h2>
              <div className="space-y-2">
                {contest.prizeDistribution.tiers.map((tier, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>Position {tier.position}</span>
                    <span>{tier.percentage}%</span>
                    <span className="font-bold">${(contest.prizePool * tier.percentage / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="border border-green-300 p-8 text-center">
                <p className="text-sm opacity-70">No submissions yet</p>
              </div>
            ) : (
              <div className="border border-green-300">
                <table className="w-full text-sm">
                  <thead className="bg-green-900/30">
                    <tr>
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Tweet</th>
                      <th className="p-2 text-right">Views</th>
                      <th className="p-2 text-right">Engagements</th>
                      <th className="p-2 text-right">Score</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(submission => (
                      <tr key={submission.id} className="border-t border-green-800">
                        <td className="p-2">
                          <div>
                            <div>{submission.userHandle}</div>
                            <div className="text-xs opacity-70">{submission.userTier}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <a
                            href={submission.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            View Tweet
                          </a>
                        </td>
                        <td className="p-2 text-right">{submission.views.toLocaleString()}</td>
                        <td className="p-2 text-right">{submission.rawEngagement.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold">{submission.finalScore.toFixed(0)}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            submission.verified ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                          }`}>
                            {submission.verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-2 text-xs">
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {!leaderboard || leaderboard.entries.length === 0 ? (
              <div className="border border-green-300 p-8 text-center">
                <p className="text-sm opacity-70">No leaderboard data yet</p>
              </div>
            ) : (
              <div>
                <p className="text-sm opacity-70 mb-2">
                  Last updated: {new Date(leaderboard.lastUpdated).toLocaleString()}
                </p>
                <div className="border border-green-300">
                  <table className="w-full text-sm">
                    <thead className="bg-green-900/30">
                      <tr>
                        <th className="p-2 text-left">Rank</th>
                        <th className="p-2 text-left">User</th>
                        <th className="p-2 text-right">Tweets</th>
                        <th className="p-2 text-right">Total Engagements</th>
                        <th className="p-2 text-right">Score</th>
                        <th className="p-2 text-right">Prize</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.entries.map(entry => (
                        <tr key={entry.userId} className="border-t border-green-800">
                          <td className="p-2">
                            <span className={`font-bold ${
                              entry.rank === 1 ? 'text-yellow-400' :
                              entry.rank === 2 ? 'text-gray-300' :
                              entry.rank === 3 ? 'text-orange-400' :
                              ''
                            }`}>
                              #{entry.rank}
                            </span>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {entry.userImage && (
                                <img
                                  src={entry.userImage}
                                  alt={entry.userHandle}
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <div>
                                <div>{entry.userHandle}</div>
                                <div className="text-xs opacity-70">{entry.userTier}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-right">{entry.tweetCount}</td>
                          <td className="p-2 text-right">{entry.totalEngagements.toLocaleString()}</td>
                          <td className="p-2 text-right font-bold">{entry.totalScore.toFixed(0)}</td>
                          <td className="p-2 text-right">
                            {entry.prizeAmount ? (
                              <span className="text-green-400 font-bold">${entry.prizeAmount.toFixed(2)}</span>
                            ) : (
                              <span className="opacity-50">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 