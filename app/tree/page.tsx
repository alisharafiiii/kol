'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import NavigationHeader from '@/components/NavigationHeader'

interface TeamMember {
  handle: string
  emoji: string
  accessIcon: string
  hours: string
}

export default function TreePage() {
  const [currentTime, setCurrentTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [typedText, setTypedText] = useState('')
  const fullText = 'C:\\NABULINES\\TEAM>dir /s'

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toISOString().replace('T', ' ').split('.')[0])
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Typing animation for header
  useEffect(() => {
    let index = 0
    const typingInterval = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index))
        index++
      } else {
        clearInterval(typingInterval)
        setTimeout(() => setIsLoading(false), 500)
      }
    }, 50)
    return () => clearInterval(typingInterval)
  }, [])

  const getTwitterAvatar = (handle: string) => {
    // Special case: use @revengeralpha's pfp for @revenger
    if (handle === 'revenger') {
      return `https://unavatar.io/twitter/revengeralpha`
    }
    return `https://unavatar.io/twitter/${handle.replace('@', '')}`
  }

  const discordTeam = [
    { handle: 'sharafi_eth', emoji: '⚜️', accessIcon: '✨', hours: '13:00 - 04:00', isLeader: true },
    { handle: 'nervyesi', emoji: '🎙️', accessIcon: '✨', hours: '07:30 - 22:30' },
    { handle: 'revenger', emoji: '🛡️', accessIcon: '🔒', hours: '13:00 - 23:00' },
    { handle: 'madmatt3m', emoji: '🛡️', accessIcon: '🔒', hours: '07:00 - 16:00' },
    { handle: 'elin08358481', emoji: '🛡️', accessIcon: '🔒', hours: '20:00 - 05:00' },
    { handle: 'chillparia', emoji: '👁️', accessIcon: '👁️', hours: '13:00 - 01:00' },
    { handle: 'parisaaweb3', emoji: '👁️', accessIcon: '👁️', hours: '07:00 - 19:00' }
  ]

  const kolTeam = [
    { handle: 'parsa_nftt', emoji: '🏹', accessIcon: '👀', hours: '09:00 - 21:00' },
    { handle: 'azurite_nft', emoji: '📣', accessIcon: '👀', hours: '10:00 - 19:00' },
    { handle: 'iamrexorex', emoji: '🤝', accessIcon: '👀', hours: '10:00 - 19:00' },
    { handle: 'senator_nfts', emoji: '✍️', accessIcon: '👀', hours: '11:00 - 17:00' },
    { handle: '0xuncleb', emoji: '🧭', accessIcon: '👀', hours: '11:00 - 17:00' }
  ]

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono overflow-hidden">
      <NavigationHeader />
      
      {/* Matrix rain background effect */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 0, 0.03) 2px,
            rgba(0, 255, 0, 0.03) 4px
          )`
        }} />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-8 mt-14 relative">
        {/* Terminal Header with glitch effect */}
        <div className="mb-12 relative">
          <div className="absolute -inset-1 bg-green-500 opacity-20 blur-xl"></div>
          <div className="relative bg-black border border-green-400 p-6 rounded-lg shadow-2xl shadow-green-900/50">
            <div className="text-green-300 font-bold text-lg mb-2 flex items-center">
              <span className="animate-pulse mr-2">▶</span>
              {typedText}
              <span className="animate-blink ml-1">_</span>
            </div>
            <div className="text-sm text-green-500 space-y-1">
              <div>Volume in drive C is NABULINES_SYS</div>
              <div>Volume Serial Number is 7734-1337</div>
              <div className="text-yellow-400">{currentTime}</div>
            </div>
          </div>
        </div>



        {/* Access Control Matrix - Redesigned */}
        <div className={`mb-12 transition-all duration-1000 ${isLoading ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
          <div className="bg-gradient-to-r from-green-950/30 to-black p-8 rounded-lg border border-green-400/50 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-green-300 mb-6 flex items-center">
              <span className="text-3xl mr-3">🔐</span>
              ACCESS CONTROL MATRIX
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: '✨', label: 'FULL ACCESS', desc: 'post/links/bots +mass tag', color: 'text-yellow-400' },
                { icon: '👁️', label: 'OVERWATCH', desc: 'mod + kick mods', color: 'text-purple-400' },
                { icon: '🔒', label: 'MODERATOR', desc: 'ban/kick/mute only', color: 'text-blue-400' },
                { icon: '👀', label: 'READ ONLY', desc: 'view access', color: 'text-green-400' }
              ].map((item, i) => (
                <div key={i} className="bg-black/50 p-4 rounded-lg border border-green-400/30 hover:border-green-400 transition-all hover:scale-105">
                  <div className={`text-4xl mb-2 ${item.color}`}>{item.icon}</div>
                  <div className="text-green-300 font-bold text-sm">{item.label}</div>
                  <div className="text-green-600 text-xs mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Tree Structure */}
        <div className={`space-y-8 transition-all duration-1000 delay-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          {/* Discord + Social Layer */}
          <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 to-transparent"></div>
            
            <div className="mb-6">
              <h3 className="text-xl font-bold text-green-300 flex items-center">
                <span className="text-2xl mr-2">💬</span>
                DISCORD + SOCIAL LAYER
              </h3>
            </div>
            
            <div className="space-y-3 ml-8">
              {discordTeam.map((member, i) => (
                <div key={i} className="group relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-green-500">
                    {i === discordTeam.length - 1 ? '└──' : '├──'}
                  </div>
                  
                  <div className={`ml-8 ${member.isLeader ? 'bg-gradient-to-r from-yellow-950/30 to-transparent border-2 border-yellow-400/50 hover:border-yellow-400' : 'bg-gradient-to-r from-green-950/20 to-transparent border border-green-400/20 hover:border-green-400/50'} p-4 rounded-lg transition-all group-hover:translate-x-2 relative`}>
                    {member.isLeader && (
                      <div className="absolute -top-3 left-4 bg-black px-2">
                        <span className="text-yellow-400 text-xs font-bold">👑 FOUNDER & HEAD OF BOTH DIVISIONS</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`absolute inset-0 ${member.isLeader ? 'bg-yellow-400' : 'bg-green-400'} blur-md opacity-50 group-hover:opacity-100 transition-opacity`}></div>
                        <img 
                          src={getTwitterAvatar(member.handle)} 
                          className={`relative w-12 h-12 rounded-full border-2 ${member.isLeader ? 'border-yellow-400' : 'border-green-400'}`}
                          alt={member.handle}
                        />
                      </div>
                      
                      <span className="text-2xl">{member.emoji}</span>
                      
                      <div className="flex-1">
                        <a 
                          href={`https://twitter.com/${member.handle}`} 
                          target="_blank" 
                          className={`${member.isLeader ? 'text-yellow-300 hover:text-yellow-100' : 'text-green-300 hover:text-green-100'} font-bold text-lg transition-colors`}
                        >
                          @{member.handle}
                        </a>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{member.accessIcon}</span>
                        <span className={`${member.isLeader ? 'text-yellow-600' : 'text-green-600'} text-sm font-mono bg-black/50 px-3 py-1 rounded`}>
                          {member.hours}
                        </span>
                      </div>
                    </div>
                    {member.isLeader && (
                      <>
                        {/* Connection line to KOL team */}
                        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-px h-8 bg-gradient-to-b from-yellow-400 to-transparent"></div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
                          {/* System Notes */}
              <div className="mt-6 ml-12 p-4 bg-black/30 rounded-lg border-l-4 border-yellow-400/50">
                <div className="text-xs text-yellow-400 space-y-1 font-mono">
                  <div>⚡ BOT_ACCESS: nervyesi + sharafi_eth(alt) only</div>
                  <div>⚡ OVERWATCH: can kick mods (hierarchy above mods)</div>
                  <div>⚡ MOD+OVERWATCH: no bot/link/post/mass tag</div>
                </div>
              </div>
          </div>

          {/* KOL & Campaign Ops */}
          <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-transparent"></div>
            
            <div className="mb-6">
              <h3 className="text-xl font-bold text-green-300 flex items-center">
                <span className="text-2xl mr-2">🎯</span>
                KOL & CAMPAIGN OPS
              </h3>
            </div>
            
            <div className="space-y-3 ml-8">
              {kolTeam.map((member, i) => (
                <div key={i} className="group relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400">
                    {i === kolTeam.length - 1 ? '└──' : '├──'}
                  </div>
                  
                  <div className="ml-8 bg-gradient-to-r from-blue-950/20 to-transparent p-4 rounded-lg border border-blue-400/20 hover:border-blue-400/50 transition-all group-hover:translate-x-2">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 blur-md opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <img 
                          src={getTwitterAvatar(member.handle)} 
                          className="relative w-12 h-12 rounded-full border-2 border-blue-400"
                          alt={member.handle}
                        />
                      </div>
                      
                      <span className="text-2xl">{member.emoji}</span>
                      
                      <div className="flex-1">
                        <a 
                          href={`https://twitter.com/${member.handle}`} 
                          target="_blank" 
                          className="text-blue-300 hover:text-blue-100 font-bold text-lg transition-colors"
                        >
                          @{member.handle}
                        </a>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{member.accessIcon}</span>
                        <span className="text-blue-600 text-sm font-mono bg-black/50 px-3 py-1 rounded">
                          {member.hours}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* System Notes */}
            <div className="mt-6 ml-12 p-4 bg-black/30 rounded-lg border-l-4 border-blue-400/50">
              <div className="text-xs text-blue-400 space-y-1 font-mono">
                <div>📡 discord_access: team_role_only (no mod perms)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Terminal */}
        <div className={`mt-16 transition-all duration-1000 delay-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="bg-black border border-green-400/50 rounded-lg p-6 shadow-2xl shadow-green-900/30">
            <div className="flex justify-between items-center text-sm">
              <div className="space-y-1">
                <div className="text-green-500">END OF DIRECTORY LISTING - PRESENTATION DATA ONLY</div>
                <div className="text-green-600">Total Files Listed: {discordTeam.length + kolTeam.length}</div>
                <div className="text-green-600">Access Control Groups: 4</div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-mono text-lg">C:\NABULINES\TEAM&gt;<span className="animate-blink">_</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-8 text-center">
          <Link href="/">
            <button className="group relative px-8 py-3 bg-black border-2 border-green-400 text-green-400 font-bold uppercase tracking-wider transition-all hover:text-black hover:bg-green-400">
              <span className="relative z-10">← BACK TO MAINFRAME</span>
              <div className="absolute inset-0 bg-green-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            </button>
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </main>
  )
}
