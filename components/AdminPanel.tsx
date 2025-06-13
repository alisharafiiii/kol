'use client'
import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { InfluencerProfile } from '../lib/redis'
import Image from 'next/image'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js'
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

// We'll create a new interface without extending InfluencerProfile to avoid type conflicts
interface KOLProfile {
  id: string;
  name: string;
  handle?: string;
  email?: string;
  approvalStatus?: string;
  followers?: number;
  countries?: string;
  wallets?: Record<string, string>;
  walletType?: string;
  experience?: string;
  audienceLocations?: string[] | string;
  targetAudience?: string[] | string;
  audience?: string[] | string;
  activeChains?: string[] | string;
  chains?: string[];
  blockchains?: string;
  contentType?: string[] | string;
  contentTypes?: string;
  pricePerPost?: number;
  priceMonthly?: number;
  roiPoints?: number;
  createdAt?: string;
  country?: string | string[];
  walletCount?: number;
  platformsUsed?: string[];
  twitterHandle?: string;
  role?: string;
  totalFollowers?: number;
  followerCount?: number;
  postPricePerPost?: number;
  monthlySupportBudget?: number;
  adminNotes?: string;
  audienceTypes?: string[] | string;
  walletAddresses?: Record<string, string>;
  socialAccounts?: Record<string, { handle?: string; followers?: number; subscribers?: number; } | unknown>;
  profileImageUrl?: string;
  bestCollabUrls?: string[]; // Add best collaboration URLs
}

// Constants for filter options
const audienceOptions = [
  'NFT Collectors',
  'DeFi Users',
  'Crypto Traders',
  'Blockchain Developers',
  'Gaming Community',
  'Art Collectors'
];

const chainOptions = [
  'Ethereum',
  'Solana',
  'Base',
  'Bitcoin',
  'TON',
  'Sui',
  'Polkadot',
  'Doge',
  'Sei',
  'Avalanche'
];

const contentTypeOptions = [
  'Thread',
  'Video',
  'Stream',
  'Space'
];

const platformOptions = [
  'Twitter',
  'Farcaster',
  'Twitch',
  'YouTube',
  'Discord',
  'Telegram',
  'Instagram',
  'TikTok'
];

const allCountries = [
  'United States', 'Japan', 'United Kingdom', 'Germany', 'India', 
  'Brazil', 'Canada', 'Australia', 'France', 'China',
  'Russia', 'South Korea', 'Singapore', 'UAE', 'Nigeria'
];

interface StatusTotals {
  approved: number;
  pending: number;
  rejected: number;
  [key: string]: number;
}

// Chart data types
type LineChartData = ChartData<'line'>;
type BarChartData = ChartData<'bar'>;
type PieChartData = ChartData<'pie'>;
type DoughnutChartData = ChartData<'doughnut'>;

// Chart options types
type LineChartOptions = ChartOptions<'line'>;
type BarChartOptions = ChartOptions<'bar'>;
type PieChartOptions = ChartOptions<'pie'>;
type DoughnutChartOptions = ChartOptions<'doughnut'>;

type Tab = 'dashboard' | 'search' | 'leaderboard' | 'roles' | 'twitter-roles' | 'products' | 'discord'

// Helper function to safely get follower count from social accounts
const getFollowerCount = (data: unknown): number => {
  if (!data) return 0
  if (typeof data === 'object' && data !== null) {
    if ('followers' in data && typeof data.followers === 'number') {
      return data.followers
    }
    if ('subscribers' in data && typeof data.subscribers === 'number') {
      return data.subscribers
    }
  }
  return 0
}

interface AdminPanelProps {
  onClose: () => void;
}

// Chart utility functions
const generateRandomDates = (days: number) => {
  const dates: string[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  
  return dates;
};

const generateRandomTrend = (days: number, minRange: number, maxRange: number) => {
  return Array(days).fill(0).map(() => Math.floor(Math.random() * (maxRange - minRange) + minRange));
};

const getTop5Countries = (users: KOLProfile[]) => {
  const countryCounts: Record<string, number> = {};
  
  users.forEach(user => {
    if (user.country) {
      // Handle both string and array country values
      const countries = Array.isArray(user.country) ? user.country : [user.country];
      
      countries.forEach(country => {
        if (typeof country === 'string') {
          countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
      });
    }
  });
  
  return Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
};

const getChainDistribution = (users: KOLProfile[]) => {
  const chainCounts: Record<string, number> = {};
  
  users.forEach(user => {
    if (user.chains && user.chains.length > 0) {
      user.chains.forEach(chain => {
        chainCounts[chain] = (chainCounts[chain] || 0) + 1;
      });
    }
  });
  
  return chainCounts;
};

const getContentTypeDistribution = (users: KOLProfile[]) => {
  const contentTypeCounts: Record<string, number> = {
    'Thread': 0,
    'Video': 0,
    'Stream': 0,
    'Space': 0,
    'Other': 0
  };
  
  users.forEach(user => {
    if (user.contentType) {
      const types = Array.isArray(user.contentType) ? user.contentType : [user.contentType];
      
      types.forEach(type => {
        if (type in contentTypeCounts) {
          contentTypeCounts[type] += 1;
        } else {
          contentTypeCounts['Other'] += 1;
        }
      });
    }
  });
  
  return contentTypeCounts;
};

const getWalletConnectionRatio = (users: KOLProfile[]) => {
  const walletCounts: Record<string, number> = {
    '0 Wallets': 0,
    '1 Wallet': 0,
    '2 Wallets': 0,
    '3+ Wallets': 0
  };
  
  users.forEach(user => {
    const count = user.walletCount || 0;
    
    if (count === 0) walletCounts['0 Wallets']++;
    else if (count === 1) walletCounts['1 Wallet']++;
    else if (count === 2) walletCounts['2 Wallets']++;
    else walletCounts['3+ Wallets']++;
  });
  
  return walletCounts;
};

const getPlatformsDistribution = (users: KOLProfile[]) => {
  const platformCounts: Record<string, number> = {};
  
  users.forEach(user => {
    if (user.platformsUsed && user.platformsUsed.length > 0) {
      user.platformsUsed.forEach(platform => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });
    }
  });
  
  return Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
};

// Add ProfileModal component before AdminPanel component
function ProfileModal({ 
  user, 
  onClose, 
  onStatusChange,
  onDelete,
  onRoleChange
}: { 
  user: KOLProfile; 
  onClose: () => void; 
  onStatusChange: (userId: string, newStatus: 'approved' | 'pending' | 'rejected') => void;
  onDelete: (userId: string) => void;
  onRoleChange: (userId: string, newRole: string) => void;
}) {
  if (!user) return null;
  
  // Format dates for better display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };
  
  // Get display Twitter handle, prefer twitterHandle then handle
  const displayHandle = user.twitterHandle || user.handle || 'No handle';
  
  // Get display follower count, prefer totalFollowers then followers
  const displayFollowers = user.totalFollowers || user.followers || 0;
  
  // Get profile image - check multiple sources for the image and use high quality
  const profileImageUrl = (user.profileImageUrl || 
    (user.socialAccounts?.twitter && typeof user.socialAccounts.twitter === 'object' && 'imageUrl' in user.socialAccounts.twitter 
      ? user.socialAccounts.twitter.imageUrl as string 
      : null))?.replace('_normal', '_400x400');
  
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      ></div>
      <div className="relative z-10 bg-black border-2 border-green-400 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <button 
          className="absolute top-2 right-2 text-green-300 hover:text-white"
          onClick={onClose}
        >
          ✕
        </button>
        
        {/* Profile Header with Image */}
        <div className="flex flex-col md:flex-row items-center gap-6 border-b border-green-300/30 pb-6 mb-6">
          {/* Profile Image */}
          <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-green-400 flex items-center justify-center bg-black/50">
            {profileImageUrl ? (
              <img 
                src={profileImageUrl} 
                alt={user.name || 'Profile'} 
                className="w-full h-full object-cover" 
              />
            ) : displayHandle.startsWith('@') ? (
              <div className="text-4xl font-bold text-green-300">{displayHandle.substring(1, 3).toUpperCase()}</div>
            ) : (
              <div className="text-4xl font-bold text-green-300">{(user.name || "User").substring(0, 2).toUpperCase()}</div>
            )}
          </div>
          
          {/* Basic Profile Info */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-green-300 mb-2">
              {user.name || 'Unnamed User'}
            </h2>
            
            <div className="mb-2">
              <span className="text-green-400">{displayHandle}</span>
              {displayFollowers > 0 && (
                <span className="text-sm ml-2">({displayFollowers.toLocaleString()} followers)</span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <span className={`px-2 py-0.5 rounded text-sm ${
                user.approvalStatus === 'approved' 
                  ? 'bg-green-900 text-green-300' 
                  : user.approvalStatus === 'rejected'
                    ? 'bg-red-900 text-red-300'
                    : 'bg-yellow-900 text-yellow-300'
              }`}>
                {user.approvalStatus || 'pending'}
              </span>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400/70">Role:</span>
                <span className="px-2 py-0.5 bg-purple-900 text-purple-300 rounded text-sm uppercase">
                  {user.role || 'user'}
                </span>
                <select
                  className="bg-black border-2 border-purple-500 text-purple-300 px-3 py-1 text-sm rounded hover:border-purple-400 cursor-pointer"
                  value={user.role || 'user'}
                  onChange={(e) => onRoleChange(user.id, e.target.value)}
                  title="Change user role"
                >
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
                  <option value="team">Team</option>
                  <option value="scout">Scout</option>
                  <option value="intern">Intern</option>
                  <option value="core">Core</option>
                  <option value="admin">Admin</option>
                </select>
                <span className="text-xs text-purple-400 animate-pulse">← Edit Role</span>
              </div>
              
              {user.country && (
                <span className="px-2 py-0.5 bg-blue-900 text-blue-300 rounded text-sm">
                  {typeof user.country === 'string' ? user.country : Array.isArray(user.country) ? user.country.join(', ') : 'Unknown'}
                </span>
              )}
            </div>
          </div>
          
          {/* Admin Actions */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button 
                className="px-2 py-1 border border-green-500 text-green-400 hover:bg-green-900/30"
                onClick={() => onStatusChange(user.id, 'approved')}
              >
                Approve
              </button>
              <button 
                className="px-2 py-1 border border-yellow-500 text-yellow-400 hover:bg-yellow-900/30"
                onClick={() => onStatusChange(user.id, 'pending')}
              >
                Pending
              </button>
              <button 
                className="px-2 py-1 border border-red-500 text-red-400 hover:bg-red-900/30"
                onClick={() => onStatusChange(user.id, 'rejected')}
              >
                Reject
              </button>
            </div>
            <button 
              className="px-2 py-1 border border-red-700 text-red-600 hover:bg-red-900/50 w-full mt-2"
              onClick={() => {
                if (confirm(`Are you sure you want to delete user ${user.name || user.id}?`)) {
                  onDelete(user.id)
                }
              }}
            >
              Delete User
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Identification & Metrics */}
          <div className="space-y-6">
            {/* User Identification */}
            <div className="border border-green-400/30 p-4 rounded-sm">
              <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">User Information</h3>
              
              <div className="space-y-2 text-sm">
                {user.id && (
                  <div className="flex">
                    <span className="font-bold mr-2 w-24">User ID:</span>
                    <span className="text-green-200 break-all">{user.id}</span>
                  </div>
                )}
                
                {user.email && (
                  <div className="flex">
                    <span className="font-bold mr-2 w-24">Email:</span>
                    <span className="text-green-200">{user.email}</span>
                  </div>
                )}
                
                {user.createdAt && (
                  <div className="flex">
                    <span className="font-bold mr-2 w-24">Joined:</span>
                    <span className="text-green-200">{formatDate(user.createdAt)}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Pricing Information */}
            {(user.pricePerPost || user.postPricePerPost || user.priceMonthly || user.monthlySupportBudget) && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Pricing</h3>
                <div className="space-y-2 text-sm">
                  {(user.pricePerPost || user.postPricePerPost) && (
                    <div className="flex">
                      <span className="font-bold mr-2 w-24">Per Post:</span>
                      <span className="text-green-200">${user.pricePerPost || user.postPricePerPost}</span>
                    </div>
                  )}
                  {(user.priceMonthly || user.monthlySupportBudget) && (
                    <div className="flex">
                      <span className="font-bold mr-2 w-24">Monthly:</span>
                      <span className="text-green-200">${user.priceMonthly || user.monthlySupportBudget}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* ROI & Metrics */}
            <div className="border border-green-400/30 p-4 rounded-sm">
              <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Metrics</h3>
              <div className="space-y-2 text-sm">
                {displayFollowers > 0 && (
                  <div className="flex">
                    <span className="font-bold mr-2 w-24">Followers:</span>
                    <span className="text-green-200">{displayFollowers.toLocaleString()}</span>
                  </div>
                )}
                
                {user.roiPoints && (
                  <div className="flex">
                    <span className="font-bold mr-2 w-24">ROI Score:</span>
                    <span className="text-green-200">{user.roiPoints}</span>
                  </div>
                )}
                
                {user.walletAddresses && (
                  <div className="flex">
                    <span className="font-bold mr-2 w-24">Wallets:</span>
                    <span className="text-green-200">{Object.keys(user.walletAddresses).length}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Chains */}
            {user.chains && user.chains.length > 0 && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Active Chains</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(user.chains) ? 
                    user.chains.map(chain => (
                      <span key={chain} className="px-2 py-1 bg-green-900/50 text-xs rounded">
                        {chain}
                      </span>
                    )) : 
                    <span className="px-2 py-1 bg-green-900/50 text-xs rounded">{String(user.chains)}</span>
                  }
                </div>
              </div>
            )}
            
            {/* Audience Types */}
            {user.audienceTypes && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Audience Types</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(user.audienceTypes) ? 
                    user.audienceTypes.map(type => (
                      <span key={type} className="px-2 py-1 bg-green-900/50 text-xs rounded">
                        {type}
                      </span>
                    )) : 
                    <span className="px-2 py-1 bg-green-900/50 text-xs rounded">{String(user.audienceTypes)}</span>
                  }
                </div>
              </div>
            )}
            
            {/* Content Types */}
            {user.contentType && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Content Types</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(user.contentType) ? 
                    user.contentType.map(type => (
                      <span key={type} className="px-2 py-1 bg-green-900/50 text-xs rounded">
                        {type}
                      </span>
                    )) : 
                    <span className="px-2 py-1 bg-green-900/50 text-xs rounded">{String(user.contentType)}</span>
                  }
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column - Social & Wallet Info */}
          <div className="space-y-6">
            {/* Social Accounts with Icons */}
            {user.socialAccounts && Object.keys(user.socialAccounts).length > 0 && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Social Platforms</h3>
                <div className="space-y-3">
                  {Object.entries(user.socialAccounts).map(([platform, account]) => {
                    // Create icon element based on platform
                    let icon = '🌐';
                    
                    if (platform.toLowerCase().includes('twitter')) icon = '𝕏';
                    if (platform.toLowerCase().includes('instagram')) icon = '📷';
                    if (platform.toLowerCase().includes('youtube')) icon = '▶️';
                    if (platform.toLowerCase().includes('tiktok')) icon = '📱';
                    if (platform.toLowerCase().includes('discord')) icon = '💬';
                    if (platform.toLowerCase().includes('twitch')) icon = '🎮';
                    if (platform.toLowerCase().includes('linkedin')) icon = '💼';
                    if (platform.toLowerCase().includes('telegram')) icon = '📢';
                    
                    // Get follower count
                    let followers = 0;
                    if (account && typeof account === 'object') {
                      if ('followers' in account && typeof account.followers === 'number') {
                        followers = account.followers;
                      } else if ('subscribers' in account && typeof account.subscribers === 'number') {
                        followers = account.subscribers;
                      }
                    }
                    
                    // Get handle
                    let handle = '';
                    if (account && typeof account === 'object' && 'handle' in account) {
                      handle = account.handle as string || '';
                    }
                    
                    return (
                      <div key={platform} className="flex items-center border border-green-400/20 p-2 rounded-sm">
                        <div className="text-xl mr-3">{icon}</div>
                        <div className="flex-1">
                          <div className="text-xs text-green-400/80 uppercase">{platform}</div>
                          <div className="text-green-200">
                            {handle || 'Connected'}
                            {followers > 0 && <span className="text-xs ml-2 text-green-400/70">({followers.toLocaleString()} followers)</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Wallet Addresses */}
            {user.walletAddresses && Object.keys(user.walletAddresses).length > 0 && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Wallet Addresses</h3>
                <div className="space-y-3">
                  {Object.entries(user.walletAddresses).map(([wallet, address]) => {
                    // Create icon element based on wallet type
                    let icon = '🔑';
                    
                    if (wallet.toLowerCase().includes('ethereum') || wallet.toLowerCase().includes('metamask')) icon = 'Ξ';
                    if (wallet.toLowerCase().includes('solana')) icon = '◎';
                    if (wallet.toLowerCase().includes('phantom')) icon = '◎';
                    if (wallet.toLowerCase().includes('coinbase')) icon = '🅒';
                    if (wallet.toLowerCase().includes('bitcoin')) icon = '₿';
                    
                    return (
                      <div key={wallet} className="border border-green-400/20 p-2 rounded-sm">
                        <div className="flex items-center mb-1">
                          <div className="text-xl mr-3">{icon}</div>
                          <div className="text-xs text-green-400/80 uppercase">{wallet}</div>
                        </div>
                        <div className="text-green-200 break-all text-xs pl-8">
                          {address}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Collaboration Examples */}
            {user.bestCollabUrls && user.bestCollabUrls.length > 0 && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Best Collaborations</h3>
                <div className="space-y-2 text-sm">
                  {user.bestCollabUrls.map((url, index) => (
                    <div key={index} className="break-all">
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Admin Notes */}
            {user.adminNotes && (
              <div className="border border-green-400/30 p-4 rounded-sm">
                <h3 className="text-md border-b border-green-300/50 mb-4 pb-1 uppercase">Admin Notes</h3>
                <div className="text-sm whitespace-pre-wrap">{user.adminNotes}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Debug Button & Raw Data */}
        <details className="mt-6 border-t border-green-300/30 pt-4">
          <summary className="cursor-pointer text-xs text-green-400/60 hover:text-green-400">Debug: View Raw User Data</summary>
          <pre className="mt-2 text-xs bg-black/50 p-2 rounded overflow-auto max-h-[200px] text-green-300/60">
            {JSON.stringify(user, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

// inside component file, before export default AdminPanel, define PixelLoader component
const PixelLoader: React.FC<{text?: string}> = ({ text = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center text-green-300">
    <div className="grid grid-cols-4 gap-0.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 bg-green-500 animate-ping"
          style={{ animationDelay: `${i * 0.05}s`, animationDuration: '1.2s' }}
        />
      ))}
    </div>
    <span className="mt-2 text-[10px] font-press-start-2p tracking-tight">{text}</span>
  </div>
);

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [statusTotals, setStatusTotals] = useState<StatusTotals>({
    approved: 0,
    pending: 0,
    rejected: 0
  })
  
  // Chart data states
  const [signupTrendData, setSignupTrendData] = useState<any>(null)
  const [approvalStatusData, setApprovalStatusData] = useState<any>(null)
  const [countryDistributionData, setCountryDistributionData] = useState<any>(null)
  const [chainDistributionData, setChainDistributionData] = useState<any>(null)
  const [contentTypeData, setContentTypeData] = useState<any>(null)
  const [walletConnectionData, setWalletConnectionData] = useState<any>(null)
  const [platformsDistributionData, setPlatformsDistributionData] = useState<any>(null)
  
  // New multi-select filters
  const [audienceLocations, setAudienceLocations] = useState<string[]>([])
  const [targetAudience, setTargetAudience] = useState<string[]>([])
  const [activeChains, setActiveChains] = useState<string[]>([])
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  
  // Range filters
  const [pricePerPostRange, setPricePerPostRange] = useState<{min: number, max: number}>({min: 0, max: 10000})
  const [priceMonthlyRange, setPriceMonthlyRange] = useState<{min: number, max: number}>({min: 0, max: 50000})
  const [followerRange, setFollowerRange] = useState<{min: number, max: number}>({min: 0, max: 1000000})
  const [roiPointsRange, setRoiPointsRange] = useState<{min: number, max: number}>({min: 0, max: 100})
  
  // Show/hide advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // Debug mode
  const [debugMode, setDebugMode] = useState(false)
  const [debugUser, setDebugUser] = useState<string>('')
  
  // Search states for dropdowns
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  
  const [users, setUsers] = useState<KOLProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const { data: session } = useSession()
  
  // Countries list (more comprehensive)
  const countries = [
    { code: 'AF', name: 'Afghanistan' },
    { code: 'AX', name: 'Åland Islands' },
    { code: 'AL', name: 'Albania' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'AS', name: 'American Samoa' },
    { code: 'AD', name: 'Andorra' },
    { code: 'AO', name: 'Angola' },
    { code: 'AI', name: 'Anguilla' },
    { code: 'AQ', name: 'Antarctica' },
    { code: 'AG', name: 'Antigua and Barbuda' },
    { code: 'AR', name: 'Argentina' },
    { code: 'AM', name: 'Armenia' },
    { code: 'AW', name: 'Aruba' },
    { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' },
    { code: 'AZ', name: 'Azerbaijan' },
    { code: 'BS', name: 'Bahamas' },
    { code: 'BH', name: 'Bahrain' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'BB', name: 'Barbados' },
    { code: 'BY', name: 'Belarus' },
    { code: 'BE', name: 'Belgium' },
    { code: 'BZ', name: 'Belize' },
    { code: 'BJ', name: 'Benin' },
    { code: 'BM', name: 'Bermuda' },
    { code: 'BT', name: 'Bhutan' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' },
    { code: 'BA', name: 'Bosnia and Herzegovina' },
    { code: 'BW', name: 'Botswana' },
    { code: 'BV', name: 'Bouvet Island' },
    { code: 'BR', name: 'Brazil' },
    { code: 'IO', name: 'British Indian Ocean Territory' },
    { code: 'BN', name: 'Brunei Darussalam' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'BF', name: 'Burkina Faso' },
    { code: 'BI', name: 'Burundi' },
    { code: 'CV', name: 'Cabo Verde' },
    { code: 'KH', name: 'Cambodia' },
    { code: 'CM', name: 'Cameroon' },
    { code: 'CA', name: 'Canada' },
    { code: 'KY', name: 'Cayman Islands' },
    { code: 'CF', name: 'Central African Republic' },
    { code: 'TD', name: 'Chad' },
    { code: 'CL', name: 'Chile' },
    { code: 'CN', name: 'China' },
    { code: 'CX', name: 'Christmas Island' },
    { code: 'CC', name: 'Cocos (Keeling) Islands' },
    { code: 'CO', name: 'Colombia' },
    { code: 'KM', name: 'Comoros' },
    { code: 'CG', name: 'Congo' },
    { code: 'CD', name: 'Congo, Democratic Republic of the' },
    { code: 'CK', name: 'Cook Islands' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'CI', name: 'Côte d\'Ivoire' },
    { code: 'HR', name: 'Croatia' },
    { code: 'CU', name: 'Cuba' },
    { code: 'CW', name: 'Curaçao' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'CZ', name: 'Czechia' },
    { code: 'DK', name: 'Denmark' },
    { code: 'DJ', name: 'Djibouti' },
    { code: 'DM', name: 'Dominica' },
    { code: 'DO', name: 'Dominican Republic' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'EG', name: 'Egypt' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'ER', name: 'Eritrea' },
    { code: 'EE', name: 'Estonia' },
    { code: 'SZ', name: 'Eswatini' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'FK', name: 'Falkland Islands (Malvinas)' },
    { code: 'FO', name: 'Faroe Islands' },
    { code: 'FJ', name: 'Fiji' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'GF', name: 'French Guiana' },
    { code: 'PF', name: 'French Polynesia' },
    { code: 'TF', name: 'French Southern Territories' },
    { code: 'GA', name: 'Gabon' },
    { code: 'GM', name: 'Gambia' },
    { code: 'GE', name: 'Georgia' },
    { code: 'DE', name: 'Germany' },
    { code: 'GH', name: 'Ghana' },
    { code: 'GI', name: 'Gibraltar' },
    { code: 'GR', name: 'Greece' },
    { code: 'GL', name: 'Greenland' },
    { code: 'GD', name: 'Grenada' },
    { code: 'GP', name: 'Guadeloupe' },
    { code: 'GU', name: 'Guam' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'GG', name: 'Guernsey' },
    { code: 'GN', name: 'Guinea' },
    { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GY', name: 'Guyana' },
    { code: 'HT', name: 'Haiti' },
    { code: 'HM', name: 'Heard Island and McDonald Islands' },
    { code: 'VA', name: 'Holy See' },
    { code: 'HN', name: 'Honduras' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'HU', name: 'Hungary' },
    { code: 'IS', name: 'Iceland' },
    { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IR', name: 'Iran' },
    { code: 'IQ', name: 'Iraq' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IM', name: 'Isle of Man' },
    { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'JP', name: 'Japan' },
    { code: 'JE', name: 'Jersey' },
    { code: 'JO', name: 'Jordan' },
    { code: 'KZ', name: 'Kazakhstan' },
    { code: 'KE', name: 'Kenya' },
    { code: 'KI', name: 'Kiribati' },
    { code: 'KP', name: 'North Korea' },
    { code: 'KR', name: 'South Korea' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'KG', name: 'Kyrgyzstan' },
    { code: 'LA', name: 'Lao People\'s Democratic Republic' },
    { code: 'LV', name: 'Latvia' },
    { code: 'LB', name: 'Lebanon' },
    { code: 'LS', name: 'Lesotho' },
    { code: 'LR', name: 'Liberia' },
    { code: 'LY', name: 'Libya' },
    { code: 'LI', name: 'Liechtenstein' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'MO', name: 'Macao' },
    { code: 'MG', name: 'Madagascar' },
    { code: 'MW', name: 'Malawi' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'MV', name: 'Maldives' },
    { code: 'ML', name: 'Mali' },
    { code: 'MT', name: 'Malta' },
    { code: 'MH', name: 'Marshall Islands' },
    { code: 'MQ', name: 'Martinique' },
    { code: 'MR', name: 'Mauritania' },
    { code: 'MU', name: 'Mauritius' },
    { code: 'YT', name: 'Mayotte' },
    { code: 'MX', name: 'Mexico' },
    { code: 'FM', name: 'Micronesia' },
    { code: 'MD', name: 'Moldova' },
    { code: 'MC', name: 'Monaco' },
    { code: 'MN', name: 'Mongolia' },
    { code: 'ME', name: 'Montenegro' },
    { code: 'MS', name: 'Montserrat' },
    { code: 'MA', name: 'Morocco' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'MM', name: 'Myanmar' },
    { code: 'NA', name: 'Namibia' },
    { code: 'NR', name: 'Nauru' },
    { code: 'NP', name: 'Nepal' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NC', name: 'New Caledonia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'NE', name: 'Niger' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'NU', name: 'Niue' },
    { code: 'NF', name: 'Norfolk Island' },
    { code: 'MK', name: 'North Macedonia' },
    { code: 'MP', name: 'Northern Mariana Islands' },
    { code: 'NO', name: 'Norway' },
    { code: 'OM', name: 'Oman' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'PW', name: 'Palau' },
    { code: 'PS', name: 'Palestine' },
    { code: 'PA', name: 'Panama' },
    { code: 'PG', name: 'Papua New Guinea' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'PE', name: 'Peru' },
    { code: 'PH', name: 'Philippines' },
    { code: 'PN', name: 'Pitcairn' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'PR', name: 'Puerto Rico' },
    { code: 'QA', name: 'Qatar' },
    { code: 'RE', name: 'Réunion' },
    { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russian Federation' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'BL', name: 'Saint Barthélemy' },
    { code: 'SH', name: 'Saint Helena, Ascension and Tristan da Cunha' },
    { code: 'KN', name: 'Saint Kitts and Nevis' },
    { code: 'LC', name: 'Saint Lucia' },
    { code: 'MF', name: 'Saint Martin (French part)' },
    { code: 'PM', name: 'Saint Pierre and Miquelon' },
    { code: 'VC', name: 'Saint Vincent and the Grenadines' },
    { code: 'WS', name: 'Samoa' },
    { code: 'SM', name: 'San Marino' },
    { code: 'ST', name: 'Sao Tome and Principe' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'SN', name: 'Senegal' },
    { code: 'RS', name: 'Serbia' },
    { code: 'SC', name: 'Seychelles' },
    { code: 'SL', name: 'Sierra Leone' },
    { code: 'SG', name: 'Singapore' },
    { code: 'SX', name: 'Sint Maarten (Dutch part)' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'SB', name: 'Solomon Islands' },
    { code: 'SO', name: 'Somalia' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
    { code: 'SS', name: 'South Sudan' },
    { code: 'ES', name: 'Spain' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'SD', name: 'Sudan' },
    { code: 'SR', name: 'Suriname' },
    { code: 'SJ', name: 'Svalbard and Jan Mayen' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'SY', name: 'Syrian Arab Republic' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TJ', name: 'Tajikistan' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'TH', name: 'Thailand' },
    { code: 'TL', name: 'Timor-Leste' },
    { code: 'TG', name: 'Togo' },
    { code: 'TK', name: 'Tokelau' },
    { code: 'TO', name: 'Tonga' },
    { code: 'TT', name: 'Trinidad and Tobago' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'TR', name: 'Turkey' },
    { code: 'TM', name: 'Turkmenistan' },
    { code: 'TC', name: 'Turks and Caicos Islands' },
    { code: 'TV', name: 'Tuvalu' },
    { code: 'UG', name: 'Uganda' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
    { code: 'UM', name: 'United States Minor Outlying Islands' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'UZ', name: 'Uzbekistan' },
    { code: 'VU', name: 'Vanuatu' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'VN', name: 'Viet Nam' },
    { code: 'VG', name: 'Virgin Islands, British' },
    { code: 'VI', name: 'Virgin Islands, U.S.' },
    { code: 'WF', name: 'Wallis and Futuna' },
    { code: 'EH', name: 'Western Sahara' },
    { code: 'YE', name: 'Yemen' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' }
  ]
  
  // Target audience options - match apply form options
  const targetAudienceOptions = [
    'Crypto Enthusiasts',
    'Traders',
    'Developers',
    'Artists',
    'Gamers',
    'Investors',
    'DeFi Users',
    'NFT Collectors',
    'Beginners',
    'Enterprises',
    'Tech Enthusiasts',
    'Blockchain Hobbyists'
  ]
  
  // Toggle selection in multi-select arrays
  const toggleSelection = (value: string, currentSelections: string[], setSelections: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (currentSelections.includes(value)) {
      setSelections(currentSelections.filter(item => item !== value))
    } else {
      setSelections([...currentSelections, value])
    }
  }
  
  // Filter countries by search term
  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  )
  
  // Load users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log('[DEBUG] Fetching users from API...')
        // Fetch data from the backend API instead of using mock data
        const response = await fetch('/api/admin/get-users');
        
        if (!response.ok) {
          throw new Error('Failed to fetch users data');
        }
        
        const userData = await response.json();
        
        // Use the real data if available, or fall back to mock data for development
        const usersData: KOLProfile[] = userData.users.length > 0 
          ? userData.users.map((user: any) => ({
              id: user.id || `user_${Math.random().toString(36).substring(7)}`,
              name: user.name || 'No Name',
              handle: user.handle || `@user_${Math.random().toString(36).substring(7)}`,
              email: user.email,
              approvalStatus: user.approvalStatus || 'pending',
              followers: user.totalFollowers ?? user.followerCount ?? Math.floor(Math.random() * 100000),
              chains: user.chains || [chainOptions[Math.floor(Math.random() * chainOptions.length)]],
              createdAt: user.createdAt || new Date().toISOString(),
              country: user.country || 'United States',
              walletCount: user.wallets ? Object.keys(user.wallets).length : 0,
              contentType: user.contentType || ['Thread'],
              platformsUsed: user.socialProfiles ? Object.keys(user.socialProfiles) : ['Twitter'],
              // Add profile image URL from user data
              profileImageUrl: user.profileImageUrl || 
                (user.socialAccounts?.twitter && typeof user.socialAccounts.twitter === 'object' && 'imageUrl' in user.socialAccounts.twitter 
                  ? user.socialAccounts.twitter.imageUrl 
                  : null),
              // Add social accounts data
              socialAccounts: user.socialAccounts,
              // Add wallet addresses
              walletAddresses: user.walletAddresses,
              // Add collaboration URLs
              bestCollabUrls: user.bestCollabUrls,
              // Add audience types
              audienceTypes: user.audienceTypes,
              // Add role
              role: user.role,
              // Add twitter handle
              twitterHandle: user.twitterHandle
            }))
          : generateMockUsers();
        
        console.log('[DEBUG] Fetched users:', usersData.length)
        setUsers(usersData);
        
        // Calculate status totals
        const totals: StatusTotals = usersData.reduce((acc: StatusTotals, user) => {
          const status = user.approvalStatus || 'pending';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {approved: 0, pending: 0, rejected: 0});
        
        setStatusTotals(totals);
        
        // Fetch signup trend data from API
        try {
          const trendResponse = await fetch('/api/admin/stats?type=signups');
          if (trendResponse.ok) {
            const trendData = await trendResponse.json();
            
            // If we have real data, use it
            if (trendData && trendData.dates && trendData.counts) {
              setSignupTrendData({
                labels: trendData.dates,
                datasets: [
                  {
                    label: 'New Signups',
                    data: trendData.counts,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    tension: 0.3
                  }
                ]
              });
            } else {
              // Fallback to generated data
              const signupDates = generateRandomDates(30);
              const signupCounts = generateRandomTrend(30, 0, 10);
              
              setSignupTrendData({
                labels: signupDates,
                datasets: [
                  {
                    label: 'New Signups',
                    data: signupCounts,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    tension: 0.3
                  }
                ]
              });
            }
          }
        } catch (error) {
          console.error('Error fetching signup trend data:', error);
          // Fallback to generated data if API fails
          const signupDates = generateRandomDates(30);
          const signupCounts = generateRandomTrend(30, 0, 10);
          
          setSignupTrendData({
            labels: signupDates,
            datasets: [
              {
                label: 'New Signups',
                data: signupCounts,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.3
              }
            ]
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        // Fallback to mock data if API fails
        const mockUsers = generateMockUsers();
        setUsers(mockUsers);
        
        const totals: StatusTotals = mockUsers.reduce((acc: StatusTotals, user) => {
          const status = user.approvalStatus || 'pending';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {approved: 0, pending: 0, rejected: 0});
        
        setStatusTotals(totals);
        setLoading(false);
      }
    };
    
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Helper function to generate mock users for development or fallback
  const generateMockUsers = (): KOLProfile[] => {
    return Array(15).fill(0).map((_, i) => {
      // Generate random date in the last 30 days
      const randomDate = new Date();
      randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 30));
      
      // Generate random number of wallets (0-3)
      const walletCount = Math.floor(Math.random() * 4);
      
      // Generate random content type
      const contentTypes = ['Thread', 'Video', 'Stream', 'Space'];
      const randomContentType = [contentTypes[Math.floor(Math.random() * contentTypes.length)]];
      
      // Generate random country
      const countries = ['United States', 'Japan', 'United Kingdom', 'Germany', 'India', 'Brazil', 'Canada', 'Australia'];
      const randomCountry = countries[Math.floor(Math.random() * countries.length)];
      
      // Generate random platforms
      const platforms = ['Twitter', 'Farcaster', 'Twitch', 'YouTube', 'Discord', 'Telegram', 'Instagram', 'TikTok'];
      const randomPlatforms: string[] = [];
      const numPlatforms = Math.floor(Math.random() * 3) + 1; // 1-3 platforms
      
      for (let j = 0; j < numPlatforms; j++) {
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        if (!randomPlatforms.includes(platform)) {
          randomPlatforms.push(platform);
        }
      }
      
      // Get a random blockchain
      const randomChain = chainOptions[Math.floor(Math.random() * chainOptions.length)];
      
      // Create a unique ID that doesn't change between renders
      const userId = `mockuser_${i}`;
      
      return {
        id: userId,
        name: `User ${i}`,
        handle: `@user${i}`,
        email: `user${i}@example.com`,
        approvalStatus: ['approved', 'pending', 'rejected'][Math.floor(Math.random() * 3)],
        followers: Math.floor(Math.random() * 100000),
        chains: [randomChain],
        createdAt: randomDate.toISOString(),
        country: randomCountry,
        walletCount: walletCount,
        contentType: randomContentType,
        platformsUsed: randomPlatforms
      };
    });
  };
  
  // Filter users based on search and status
  const filteredUsers = users.filter(user => {
    // Apply search filter
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.handle && user.handle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (debugMode && debugUser && user.id === debugUser)
    
    // Apply status filter
    const matchesStatus = statusFilter === 'all' || user.approvalStatus === statusFilter
    
    return matchesSearch && matchesStatus
  })
  
  // Update chart data when users or status totals change
  useEffect(() => {
    if (users.length > 0 && !loading) {
      updateChartData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, statusTotals, loading]);
  
  // Handle approval status change
  const handleApprove = (userId: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? {...user, approvalStatus: 'approved'} : user
    ))
  }
  
  const handleReject = (userId: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? {...user, approvalStatus: 'rejected'} : user
    ))
  }
  
  // View detailed user profile
  const [selectedUser, setSelectedUser] = useState<KOLProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const handleView = (userId: string) => {
    // Find the user from the list
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setShowProfileModal(true);
    } else {
      console.error(`User not found with ID: ${userId}`);
    }
  }
  
  // Update all chart data based on current users
  const updateChartData = () => {
    // Approval status pie chart
    setApprovalStatusData({
      labels: ['Approved', 'Pending', 'Rejected'],
      datasets: [
        {
          data: [statusTotals.approved || 0, statusTotals.pending || 0, statusTotals.rejected || 0],
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(255, 99, 132, 0.8)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(255, 99, 132, 1)'
          ],
          borderWidth: 1
        }
      ]
    });
    
    // Country distribution
    const topCountries = getTop5Countries(users);
    setCountryDistributionData({
      labels: topCountries.map(country => country[0]),
      datasets: [
        {
          label: 'Users by Country',
          data: topCountries.map(country => country[1]),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    });
    
    // Chain distribution
    const chainCounts = getChainDistribution(users);
    setChainDistributionData({
      labels: Object.keys(chainCounts),
      datasets: [
        {
          label: 'Users by Chain',
          data: Object.values(chainCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1
        }
      ]
    });
    
    // Content type distribution
    const contentTypeCounts = getContentTypeDistribution(users);
    setContentTypeData({
      labels: Object.keys(contentTypeCounts),
      datasets: [
        {
          data: Object.values(contentTypeCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1
        }
      ]
    });
    
    // Wallet connection ratio
    const walletCounts = getWalletConnectionRatio(users);
    setWalletConnectionData({
      labels: Object.keys(walletCounts),
      datasets: [
        {
          data: Object.values(walletCounts),
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1,
          borderRadius: 5,
          spacing: 2
        }
      ]
    });
    
    // Platforms distribution
    const platformsData = getPlatformsDistribution(users);
    setPlatformsDistributionData({
      labels: platformsData.map(platform => platform[0]),
      datasets: [
        {
          label: 'Users by Platform',
          data: platformsData.map(platform => platform[1]),
          backgroundColor: 'rgba(153, 102, 255, 0.8)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }
      ]
    });
  };
  
  // Function to update user status
  const updateUserStatus = async (userId: string, newStatus: 'approved' | 'pending' | 'rejected') => {
    try {
      const response = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, status: newStatus }),
      })
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status')
      }
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userId ? { ...u, approvalStatus: newStatus } : u
        )
      )
      
      // Update totals
      const oldUser = users.find(u => u.id === userId)
      if (oldUser) {
        const oldStatus = oldUser.approvalStatus || 'pending'
        setStatusTotals(prev => ({
          ...prev,
          [oldStatus]: Math.max(0, prev[oldStatus] - 1),
          [newStatus]: prev[newStatus] + 1
        }))
      }
      
      // Re-render the charts with updated data
      updateChartData()
    } catch (error) {
      console.error('Error updating user status:', error)
      alert(`Failed to update user status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      console.log(`Attempting to delete user: ${userId}`);
      
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user')
      }
      
      console.log(`User ${userId} deleted successfully`);
      
      // Update local state immediately
      const deletedUser = users.find(u => u.id === userId);
      setUsers(prevUsers => {
        const newUsers = prevUsers.filter(u => u.id !== userId);
        console.log(`Updated user list: ${newUsers.length} users remaining`);
        return newUsers;
      });
      
      // Update totals
      if (deletedUser) {
        const status = deletedUser.approvalStatus || 'pending'
        setStatusTotals(prev => ({
          ...prev,
          [status]: Math.max(0, prev[status] - 1)
        }))
      }
      
      // Close modal
      setShowProfileModal(false)
      setSelectedUser(null)
      
      // Refresh data from server to ensure consistency
      setTimeout(async () => {
        try {
          console.log('Refreshing user data from server...');
          const response = await fetch('/api/admin/get-users');
          if (response.ok) {
            const userData = await response.json();
            const refreshedUsers = userData.users.length > 0 
              ? userData.users.map((user: any) => ({
                  id: user.id || `user_${Math.random().toString(36).substring(7)}`,
                  name: user.name || 'No Name',
                  handle: user.handle || `@user_${Math.random().toString(36).substring(7)}`,
                  email: user.email,
                  approvalStatus: user.approvalStatus || 'pending',
                  followers: user.totalFollowers ?? user.followerCount ?? Math.floor(Math.random() * 100000),
                  chains: user.chains || [chainOptions[Math.floor(Math.random() * chainOptions.length)]],
                  createdAt: user.createdAt || new Date().toISOString(),
                  country: user.country || 'United States',
                  walletCount: user.wallets ? Object.keys(user.wallets).length : 0,
                  contentType: user.contentType || ['Thread'],
                  platformsUsed: user.socialProfiles ? Object.keys(user.socialProfiles) : ['Twitter'],
                  profileImageUrl: user.profileImageUrl || 
                    (user.socialAccounts?.twitter && typeof user.socialAccounts.twitter === 'object' && 'imageUrl' in user.socialAccounts.twitter 
                      ? user.socialAccounts.twitter.imageUrl 
                      : null),
                  socialAccounts: user.socialAccounts,
                  walletAddresses: user.walletAddresses,
                  bio: user.bio,
                  role: user.role,
                  twitterHandle: user.twitterHandle
                }))
              : [];
            
            console.log(`Server refresh: ${refreshedUsers.length} users found`);
            setUsers(refreshedUsers);
            
            // Recalculate status totals
            const newTotals = refreshedUsers.reduce((acc: any, user: any) => {
              const status = user.approvalStatus || 'pending';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, { approved: 0, pending: 0, rejected: 0 });
            
            setStatusTotals(newTotals);
            updateChartData();
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
      }, 500);
      
      alert('User deleted successfully')
    } catch (error) {
      console.error('Error deleting user:', error)
      alert(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Find the user's twitter handle
      const user = users.find(u => u.id === userId)
      if (!user) {
        alert('User not found')
        return
      }
      
      console.log('[DEBUG] Changing role for user:', { userId, newRole, user })
      
      // Check for twitter handle in both possible fields
      const twitterHandle = user.twitterHandle || user.handle
      if (!twitterHandle) {
        alert('User does not have a Twitter handle')
        return
      }
      
      // Clean the handle (remove @ if present)
      const cleanHandle = twitterHandle.replace('@', '')
      
      console.log('[DEBUG] Making API call to:', `/api/user/full-profile?handle=${cleanHandle}`)
      
      const response = await fetch(`/api/user/full-profile?handle=${encodeURIComponent(cleanHandle)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      const responseData = await response.json()
      console.log('[DEBUG] API Response:', { status: response.status, data: responseData })

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update role')
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))
      
      // Update selected user if this is the one being viewed
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null)
      }
      
      // Show success message with note about session
      alert(`Role updated successfully!\n\nNote: The user (${user.name || user.handle}) may need to sign out and sign back in for the role change to take full effect.`)
      
      // Don't reload the page - the UI is already updated
      console.log('[DEBUG] Role change completed')
    } catch (error) {
      console.error('Error updating role:', error)
      alert(`Failed to update role: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /* =====================
     Roles management state
  ====================== */
  const roleOptions = ['admin', 'core', 'team', 'scout', 'intern', 'user', 'viewer'] as const
  type RoleOption = typeof roleOptions[number]

  const [rolesList, setRolesList] = useState<Array<{ wallet: string; role: RoleOption }>>([])
  const [newWallet, setNewWallet] = useState('')
  const [newRole, setNewRole] = useState<RoleOption>('viewer')
  const [roleActionStatus, setRoleActionStatus] = useState<{ message: string; isError: boolean } | null>(null)

  // Fetch roles when the tab becomes active
  const fetchRoles = async () => {
    setRoleActionStatus(null)
    try {
      const res = await fetch('/api/admin/roles')
      if (res.ok) {
        const data = await res.json()
        setRolesList(data)
        if (data.length === 0) {
          setRoleActionStatus({ message: 'No roles assigned yet. Add one below.', isError: false })
        }
      }
    } catch (err) {
      console.error('Failed to fetch roles', err)
      setRoleActionStatus({ message: 'Error loading roles', isError: true })
    }
  }

  useEffect(() => {
    if (activeTab === 'roles') {
      fetchRoles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleSaveRole = async () => {
    if (!newWallet) return
    setRoleActionStatus({ message: 'Saving role...', isError: false })
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: newWallet.trim(), role: newRole })
      })
      if (res.ok) {
        setNewWallet('')
        setRoleActionStatus({ message: 'Role saved successfully!', isError: false })
        fetchRoles()
      } else {
        const error = await res.json()
        setRoleActionStatus({ message: `Error: ${error.error || 'Failed to save role'}`, isError: true })
      }
    } catch (err) {
      console.error('Failed to save role', err)
      setRoleActionStatus({ message: 'Error saving role', isError: true })
    }
  }
  
  /* Twitter Roles state */
  const [twitterRoles, setTwitterRoles] = useState<Array<{ handle: string; role: string; profileImage?: string }>>([])
  const [twitterRoleSearch, setTwitterRoleSearch] = useState('')
  const [loadingTwitterRoles, setLoadingTwitterRoles] = useState(false)
  const [twitterRoleStatus, setTwitterRoleStatus] = useState<{ message: string; isError: boolean } | null>(null)
  
  // Fetch Twitter roles
  const fetchTwitterRoles = async () => {
    setLoadingTwitterRoles(true)
    setTwitterRoleStatus(null)
    try {
      const res = await fetch('/api/admin/twitter-roles')
      if (res.ok) {
        const data = await res.json()
        setTwitterRoles(data.users || [])
        if (data.users?.length === 0) {
          setTwitterRoleStatus({ message: 'No Twitter users found.', isError: false })
        }
      } else {
        setTwitterRoleStatus({ message: 'Error loading Twitter roles', isError: true })
      }
    } catch (err) {
      console.error('Failed to fetch Twitter roles', err)
      setTwitterRoleStatus({ message: 'Error loading Twitter roles', isError: true })
    } finally {
      setLoadingTwitterRoles(false)
    }
  }
  
  // Update Twitter role
  const updateTwitterRole = async (handle: string, role: string) => {
    setTwitterRoleStatus({ message: 'Updating role...', isError: false })
    try {
      const res = await fetch('/api/admin/twitter-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, role })
      })
      if (res.ok) {
        setTwitterRoleStatus({ message: 'Role updated successfully!', isError: false })
        fetchTwitterRoles()
      } else {
        const error = await res.json()
        setTwitterRoleStatus({ message: `Error: ${error.error || 'Failed to update role'}`, isError: true })
      }
    } catch (err) {
      console.error('Failed to update Twitter role', err)
      setTwitterRoleStatus({ message: 'Error updating role', isError: true })
    }
  }
  
  const handleAddTwitterRole = async () => {
    if (!twitterRoleSearch) return
    setTwitterRoleStatus({ message: 'Adding Twitter role...', isError: false })
    try {
      const res = await fetch('/api/admin/twitter-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: twitterRoleSearch })
      })
      if (res.ok) {
        setTwitterRoleSearch('')
        setTwitterRoleStatus({ message: 'Twitter role added successfully!', isError: false })
        fetchTwitterRoles()
      } else {
        const error = await res.json()
        setTwitterRoleStatus({ message: `Error: ${error.error || 'Failed to add Twitter role'}`, isError: true })
      }
    } catch (err) {
      console.error('Failed to add Twitter role', err)
      setTwitterRoleStatus({ message: 'Error adding Twitter role', isError: true })
    }
  }
  
  useEffect(() => {
    if (activeTab === 'twitter-roles') {
      fetchTwitterRoles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  
  // Fetch twitter roles when tab changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      updateChartData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  
  return (
    <div className="fixed inset-0 z-50 bg-black font-mono text-green-300 p-4 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl uppercase tracking-wider font-press-start-2p animate-pulse">The System.</h1>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-green-300 mb-6 admin-nav gap-2 overflow-x-auto">
          <button 
            className={`px-4 py-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`px-4 py-2 whitespace-nowrap ${activeTab === 'search' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search
          </button>
          <button 
            className={`px-4 py-2 whitespace-nowrap ${activeTab === 'leaderboard' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          <button 
            className={`px-4 py-2 whitespace-nowrap ${activeTab === 'products' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </button>
          <button 
            className={`px-4 py-2 whitespace-nowrap ${activeTab === 'discord' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('discord')}
          >
            Discord
          </button>
          {/* Roles management tab – visible to admins only.  */}
          {/* Roles tabs removed */}
        </div>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-around mb-8">
              <div className="flex flex-col items-center">
                <div className="text-2xl">{statusTotals.approved || 0}</div>
                <div className="h-40 w-8 bg-green-800 relative mt-2">
                  <div 
                    className="absolute bottom-0 w-full bg-green-400" 
                    style={{ height: `${((statusTotals.approved || 0) / (users.length || 1)) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-2">Approved</div>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="text-2xl">{statusTotals.pending || 0}</div>
                <div className="h-40 w-8 bg-green-800 relative mt-2">
                  <div 
                    className="absolute bottom-0 w-full bg-yellow-400" 
                    style={{ height: `${((statusTotals.pending || 0) / (users.length || 1)) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-2">Pending</div>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="text-2xl">{statusTotals.rejected || 0}</div>
                <div className="h-40 w-8 bg-green-800 relative mt-2">
                  <div 
                    className="absolute bottom-0 w-full bg-red-400" 
                    style={{ height: `${((statusTotals.rejected || 0) / (users.length || 1)) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-2">Rejected</div>
              </div>
            </div>
            
            {/* Charts section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Signup Trend */}
              <div className="border border-green-300 p-4">
                <h3 className="text-lg mb-4">User Signup Trend</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {signupTrendData ? (
                    <Line 
                      data={signupTrendData} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          },
                          x: {
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          }
                        },
                        plugins: {
                          legend: {
                            labels: { color: 'rgba(134, 239, 172, 0.8)' }
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
              
              {/* Approval Status Breakdown */}
              <div className="border border-green-300 p-4">
                <h3 className="text-lg mb-4">Approval Status</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {approvalStatusData ? (
                    <Pie 
                      data={approvalStatusData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                            labels: { color: 'rgba(134, 239, 172, 0.8)' }
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
              
              {/* Users by Country */}
              <div className="border border-green-300 p-4">
                <h3 className="text-lg mb-4">Users by Country</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {countryDistributionData ? (
                    <Bar 
                      data={countryDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        scales: {
                          y: {
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          },
                          x: {
                            beginAtZero: true,
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          }
                        },
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
              
              {/* Users by Chain */}
              <div className="border border-green-300 p-4">
                <h3 className="text-lg mb-4">Users by Chain</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {chainDistributionData ? (
                    <Bar 
                      data={chainDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          },
                          x: {
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          }
                        },
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
              
              {/* Users by Content Type */}
              <div className="border border-green-300 p-4">
                <h3 className="text-lg mb-4">Content Type Distribution</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {contentTypeData ? (
                    <Pie 
                      data={contentTypeData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                            labels: { color: 'rgba(134, 239, 172, 0.8)' }
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
              
              {/* Wallet Connection Ratio */}
              <div className="border border-green-300 p-4">
                <h3 className="text-lg mb-4">Wallet Connection Ratio</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {walletConnectionData ? (
                    <Doughnut 
                      data={walletConnectionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                            labels: { color: 'rgba(134, 239, 172, 0.8)' }
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
              
              {/* Platform Distribution */}
              <div className="border border-green-300 p-4 col-span-1 md:col-span-2">
                <h3 className="text-lg mb-4">Platform Distribution</h3>
                <div className="h-64 bg-black flex items-center justify-center">
                  {platformsDistributionData ? (
                    <Bar 
                      data={platformsDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          },
                          x: {
                            ticks: { color: 'rgba(134, 239, 172, 0.8)' },
                            grid: { color: 'rgba(134, 239, 172, 0.1)' }
                          }
                        },
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  ) : (
                    <PixelLoader />
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <h2 className="text-lg mb-2">Recent Users</h2>
              {users.slice(0, 5).map(user => (
                <div key={user.id} className="border border-green-300 p-2 mb-2 flex items-center">
                  <div className="w-6 h-6 bg-green-800 rounded-full mr-2"></div>
                  <div className="flex-1">
                    <div className="font-bold">{user.name}</div>
                    <div className="text-xs">{user.handle}</div>
                  </div>
                  <div className="text-xs">
                    <span 
                      className={`px-2 py-0.5 rounded ${
                        user.approvalStatus === 'approved' 
                          ? 'bg-green-900 text-green-300' 
                          : user.approvalStatus === 'rejected'
                            ? 'bg-red-900 text-red-300'
                            : 'bg-yellow-900 text-yellow-300'
                      }`}
                    >
                      {user.approvalStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Search by name or handle..."
                className="w-full bg-black border border-green-300 p-2"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              
              <div className="flex gap-2 flex-wrap">
                <button 
                  className={`px-2 py-1 text-xs ${statusFilter === 'all' ? 'bg-green-800 text-green-100' : 'border border-green-300'}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`px-2 py-1 text-xs ${statusFilter === 'approved' ? 'bg-green-800 text-green-100' : 'border border-green-300'}`}
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved ({statusTotals.approved || 0})
                </button>
                <button 
                  className={`px-2 py-1 text-xs ${statusFilter === 'pending' ? 'bg-yellow-800 text-yellow-100' : 'border border-green-300'}`}
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending ({statusTotals.pending || 0})
                </button>
                <button 
                  className={`px-2 py-1 text-xs ${statusFilter === 'rejected' ? 'bg-red-800 text-red-100' : 'border border-green-300'}`}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Rejected ({statusTotals.rejected || 0})
                </button>
              </div>
              
              {/* Advanced Filters */}
              <div className="border border-green-300 p-3 mt-3">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold">Advanced Filters</h3>
                  <button 
                    className="text-xs border border-green-300 px-2 py-1 hover:bg-green-800"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    {showAdvancedFilters ? 'Hide Filters' : 'Show Filters'}
                  </button>
                </div>
                
                {showAdvancedFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Country Filter */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">Countries</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search countries..."
                          className="w-full bg-black border border-green-300 p-2 text-xs"
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          onFocus={() => setShowCountryDropdown(true)}
                        />
                        {showCountryDropdown && (
                          <div className="absolute z-10 mt-1 w-full bg-black border border-green-300 max-h-40 overflow-y-auto">
                            {countries
                              .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
                              .map(country => (
                                <div
                                  key={country.name}
                                  className={`p-2 text-xs cursor-pointer hover:bg-green-900 ${
                                    audienceLocations.includes(country.name) ? 'bg-green-800' : ''
                                  }`}
                                  onClick={() => {
                                    setAudienceLocations(prev => 
                                      prev.includes(country.name) 
                                        ? prev.filter(c => c !== country.name) 
                                        : [...prev, country.name]
                                    );
                                  }}
                                >
                                  {country.name}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      {audienceLocations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {audienceLocations.map(country => (
                            <span 
                              key={country} 
                              className="inline-flex items-center px-2 py-1 bg-green-900 text-xs rounded"
                            >
                              {country}
                              <button 
                                className="ml-1 text-red-400" 
                                onClick={() => setAudienceLocations(prev => prev.filter(c => c !== country))}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Target Audience */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">Target Audience</label>
                      <div className="max-h-40 overflow-y-auto border border-green-300 p-2">
                        {targetAudienceOptions.map(audience => (
                          <div key={audience} className="flex items-center mb-1">
                            <input 
                              type="checkbox" 
                              id={`audience-${audience}`}
                              checked={targetAudience.includes(audience)}
                              onChange={() => {
                                setTargetAudience(prev => 
                                  prev.includes(audience) 
                                    ? prev.filter(a => a !== audience) 
                                    : [...prev, audience]
                                );
                              }}
                              className="mr-2"
                            />
                            <label htmlFor={`audience-${audience}`} className="text-xs">
                              {audience}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Active Chains */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">Active Chains</label>
                      <div className="max-h-40 overflow-y-auto border border-green-300 p-2">
                        {chainOptions.map(chain => (
                          <div key={chain} className="flex items-center mb-1">
                            <input 
                              type="checkbox" 
                              id={`chain-${chain}`}
                              checked={activeChains.includes(chain)}
                              onChange={() => {
                                setActiveChains(prev => 
                                  prev.includes(chain) 
                                    ? prev.filter(c => c !== chain) 
                                    : [...prev, chain]
                                );
                              }}
                              className="mr-2"
                            />
                            <label htmlFor={`chain-${chain}`} className="text-xs">
                              {chain}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Content Types */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">Content Types</label>
                      <div className="max-h-40 overflow-y-auto border border-green-300 p-2">
                        {contentTypeOptions.map(type => (
                          <div key={type} className="flex items-center mb-1">
                            <input 
                              type="checkbox" 
                              id={`content-${type}`}
                              checked={contentTypes.includes(type)}
                              onChange={() => {
                                setContentTypes(prev => 
                                  prev.includes(type) 
                                    ? prev.filter(t => t !== type) 
                                    : [...prev, type]
                                );
                              }}
                              className="mr-2"
                            />
                            <label htmlFor={`content-${type}`} className="text-xs">
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Platforms Filter */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">Platforms</label>
                      <div className="max-h-40 overflow-y-auto border border-green-300 p-2">
                        {platformOptions.map(platform => (
                          <div key={platform} className="flex items-center mb-1">
                            <input 
                              type="checkbox" 
                              id={`platform-${platform}`}
                              checked={platforms.includes(platform)}
                              onChange={() => {
                                setPlatforms(prev => 
                                  prev.includes(platform) 
                                    ? prev.filter(p => p !== platform) 
                                    : [...prev, platform]
                                );
                              }}
                              className="mr-2"
                            />
                            <label htmlFor={`platform-${platform}`} className="text-xs">
                              {platform}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Price Per Post Range */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">
                        Price Per Post Range: ${pricePerPostRange.min} - ${pricePerPostRange.max}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          className="w-1/2 bg-black border border-green-300 p-2 text-xs"
                          value={pricePerPostRange.min}
                          onChange={e => setPricePerPostRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          className="w-1/2 bg-black border border-green-300 p-2 text-xs"
                          value={pricePerPostRange.max}
                          onChange={e => setPricePerPostRange(prev => ({ ...prev, max: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    
                    {/* Monthly Price Range */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">
                        Monthly Price Range: ${priceMonthlyRange.min} - ${priceMonthlyRange.max}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          className="w-1/2 bg-black border border-green-300 p-2 text-xs"
                          value={priceMonthlyRange.min}
                          onChange={e => setPriceMonthlyRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          className="w-1/2 bg-black border border-green-300 p-2 text-xs"
                          value={priceMonthlyRange.max}
                          onChange={e => setPriceMonthlyRange(prev => ({ ...prev, max: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    
                    {/* Follower Range */}
                    <div className="filter-group">
                      <label className="text-xs uppercase block mb-1">
                        Followers Range: {followerRange.min} - {followerRange.max}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          className="w-1/2 bg-black border border-green-300 p-2 text-xs"
                          value={followerRange.min}
                          onChange={e => setFollowerRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          className="w-1/2 bg-black border border-green-300 p-2 text-xs"
                          value={followerRange.max}
                          onChange={e => setFollowerRange(prev => ({ ...prev, max: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    
                    {/* Clear Filters Button */}
                    <div className="filter-group col-span-1 md:col-span-2 flex justify-center">
                      <button 
                        className="text-xs border border-red-500 px-4 py-2 text-red-400 hover:bg-red-900"
                        onClick={() => {
                          setAudienceLocations([]);
                          setTargetAudience([]);
                          setActiveChains([]);
                          setContentTypes([]);
                          setPlatforms([]);
                          setPricePerPostRange({min: 0, max: 10000});
                          setPriceMonthlyRange({min: 0, max: 50000});
                          setFollowerRange({min: 0, max: 1000000});
                          setCountrySearch('');
                        }}
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="users-table">
              <div className="mb-2 text-xs opacity-70">{filteredUsers.length} results</div>
              {filteredUsers.map(user => (
                <div key={user.id} className="border border-green-300 p-3 mb-3 hover:bg-green-900/10">
                  <div className="flex gap-4">
                    {/* Profile Image */}
                    <div 
                      className="w-16 h-16 rounded-lg overflow-hidden border border-green-400 flex items-center justify-center bg-black/50 cursor-pointer"
                      onClick={() => handleView(user.id)}
                    >
                      {user.profileImageUrl ? (
                        <img 
                          src={user.profileImageUrl?.replace('_normal', '_400x400')} 
                          alt={user.name || 'Profile'} 
                          className="w-full h-full object-cover" 
                        />
                      ) : user.handle?.startsWith('@') ? (
                        <div className="text-2xl font-bold text-green-300">{user.handle.substring(1, 3).toUpperCase()}</div>
                      ) : (
                        <div className="text-2xl font-bold text-green-300">{(user.name || "User").substring(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                    
                    {/* User Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <div 
                          className="font-bold cursor-pointer hover:text-green-400" 
                          onClick={() => handleView(user.id)}
                        >
                          {user.name}
                        </div>
                        <div className="text-xs text-green-400">{user.handle}</div>
                        
                        {/* Status Badge */}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          user.approvalStatus === 'approved' 
                            ? 'bg-green-900/50 text-green-300' 
                            : user.approvalStatus === 'rejected'
                              ? 'bg-red-900/50 text-red-300'
                              : 'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          {user.approvalStatus || 'pending'}
                        </span>
                        
                        {/* Role Badge (if exists) */}
                        {user.role && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded uppercase">
                            {user.role}
                          </span>
                        )}
                      </div>
                      
                      {/* User Stats - First Row */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mb-2">
                        {/* Followers */}
                        <div className="text-xs flex items-center">
                          <span className="opacity-70 mr-1">👥</span>
                          <span>{user.followers?.toLocaleString() || 0} followers</span>
                        </div>
                        
                        {/* Country */}
                        {user.country && (
                          <div className="text-xs flex items-center hidden-mobile">
                            <span className="opacity-70 mr-1">🌍</span>
                            <span>{typeof user.country === 'string' 
                              ? user.country 
                              : Array.isArray(user.country) 
                                ? user.country[0] + (user.country.length > 1 ? ` +${user.country.length-1}` : '')
                                : 'Unknown'}</span>
                          </div>
                        )}
                        
                        {/* Joined Date */}
                        {user.createdAt && (
                          <div className="text-xs flex items-center hidden sm:flex">
                            <span className="opacity-70 mr-1">📅</span>
                            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        {/* Pricing info */}
                        {(user.pricePerPost || user.postPricePerPost) && (
                          <div className="text-xs flex items-center">
                            <span className="opacity-70 mr-1">💲</span>
                            <span>${user.pricePerPost || user.postPricePerPost}/post</span>
                          </div>
                        )}
                        
                        {/* Monthly budget */}
                        {(user.priceMonthly || user.monthlySupportBudget) && (
                          <div className="text-xs flex items-center hidden sm:flex">
                            <span className="opacity-70 mr-1">💰</span>
                            <span>${user.priceMonthly || user.monthlySupportBudget}/month</span>
                          </div>
                        )}
                        
                        {/* Wallet count */}
                        {user.walletCount !== undefined && (
                          <div className="text-xs flex items-center hidden md:flex">
                            <span className="opacity-70 mr-1">🔑</span>
                            <span>{user.walletCount} wallet{user.walletCount !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* User Stats - Second Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Active Chains */}
                        {user.chains && user.chains.length > 0 && (
                          <div className="flex flex-wrap gap-1 hidden sm:flex">
                            {Array.isArray(user.chains) 
                              ? user.chains.slice(0, 3).map(chain => (
                                <span key={chain} className="px-1.5 py-0.5 bg-green-900/30 text-xs rounded">
                                  {chain}
                                </span>
                              ))
                              : <span className="px-1.5 py-0.5 bg-green-900/30 text-xs rounded">{String(user.chains)}</span>
                            }
                            {Array.isArray(user.chains) && user.chains.length > 3 && (
                              <span className="text-xs text-green-400">+{user.chains.length - 3} more</span>
                            )}
                          </div>
                        )}
                        
                        {/* Content Types */}
                        {user.contentType && (
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(user.contentType) 
                              ? user.contentType.slice(0, 2).map(type => (
                                <span key={type} className="px-1.5 py-0.5 bg-blue-900/30 text-blue-200 text-xs rounded">
                                  {type}
                                </span>
                              ))
                              : <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-200 text-xs rounded">{String(user.contentType)}</span>
                            }
                            {Array.isArray(user.contentType) && user.contentType.length > 2 && (
                              <span className="text-xs text-blue-400">+{user.contentType.length - 2} more</span>
                            )}
                          </div>
                        )}
                        
                        {/* Social Platforms */}
                        {user.socialAccounts && Object.keys(user.socialAccounts).length > 0 && (
                          <div className="flex gap-1 hidden-mobile">
                            {Object.entries(user.socialAccounts).slice(0, 4).map(([platform]) => {
                              let icon = '🌐';
                              if (platform.toLowerCase().includes('twitter')) icon = '𝕏';
                              if (platform.toLowerCase().includes('instagram')) icon = '📷';
                              if (platform.toLowerCase().includes('youtube')) icon = '▶️';
                              if (platform.toLowerCase().includes('tiktok')) icon = '📱';
                              if (platform.toLowerCase().includes('discord')) icon = '💬';
                              if (platform.toLowerCase().includes('twitch')) icon = '🎮';
                              return (
                                <span key={platform} className="w-6 h-6 flex items-center justify-center bg-green-900/30 rounded-full text-xs">
                                  {icon}
                                </span>
                              );
                            })}
                            {Object.keys(user.socialAccounts).length > 4 && (
                              <span className="text-xs text-green-400">+{Object.keys(user.socialAccounts).length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <select
                        value={user.approvalStatus || 'pending'}
                        onChange={(e) => updateUserStatus(user.id, e.target.value as 'approved' | 'pending' | 'rejected')}
                        className={`text-xs p-1 bg-black border ${
                          user.approvalStatus === 'approved' 
                            ? 'border-green-500 text-green-400' 
                            : user.approvalStatus === 'rejected'
                              ? 'border-red-500 text-red-400'
                              : 'border-yellow-500 text-yellow-400'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <button
                        onClick={() => handleView(user.id)}
                        className="text-xs p-1 bg-black border border-blue-400 text-blue-400 hover:bg-blue-900/30"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div>
            <h2 className="text-lg mb-4">Top KOLs by Followers</h2>
            <table className="w-full text-xs">
              <thead className="border-b border-green-300">
                <tr>
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-right p-2">Followers</th>
                </tr>
              </thead>
              <tbody>
                {[...users]
                  .sort((a, b) => (b.followers || 0) - (a.followers || 0))
                  .slice(0, 10)
                  .map((user, index) => (
                    <tr key={user.id} className="border-b border-green-300/30">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">
                        <div className="flex items-center">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl?.replace('_normal', '_400x400')}
                              alt={user.name}
                              className="w-6 h-6 rounded-full mr-2 object-cover"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          ) : (
                            <div className="w-6 h-6 bg-green-800 rounded-full mr-2" />
                          )}
                          <div>
                            <div 
                              className="font-bold cursor-pointer hover:text-green-400" 
                              onClick={() => handleView(user.id)}
                            >
                              {user.name}
                            </div>
                            <div className="text-xs opacity-70">{user.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-right">{user.followers?.toLocaleString()}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
        
        {/* Roles Management Tab */}
        {/* Roles management section removed */}
        
        {/* Twitter Roles Management Tab */}
        {activeTab === 'twitter-roles' && (
          <div className="space-y-6">
            <h2 className="text-lg mb-4">Twitter Roles Management</h2>
            <p className="text-xs opacity-70 mb-4">Manage roles for users who have logged in with Twitter</p>
 
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by Twitter handle..."
                value={twitterRoleSearch}
                onChange={e => setTwitterRoleSearch(e.target.value)}
                className="w-full bg-black border border-green-300 p-2"
              />
            </div>
 
            {/* Status message */}
            {twitterRoleStatus && (
              <div className={`mb-4 text-sm ${twitterRoleStatus.isError ? 'text-red-400' : 'text-green-400'}`}>
                {twitterRoleStatus.message}
              </div>
            )}
 
            {/* Loading state */}
            {loadingTwitterRoles ? (
              <PixelLoader text="Loading Twitter users..." />
            ) : twitterRoles.filter(u => 
                !twitterRoleSearch || u.handle.toLowerCase().includes(twitterRoleSearch.toLowerCase())
              ).length === 0 ? (
              <div className="border border-green-300 p-4 text-center text-sm opacity-70">
                {twitterRoleSearch ? 'No users found matching your search.' : 'No Twitter users found.'}
              </div>
            ) : (
              <div className="border border-green-300 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-green-900/30">
                    <tr>
                      <th className="p-2 text-left">Avatar</th>
                      <th className="p-2 text-left">Handle</th>
                      <th className="p-2 text-left">Current Role</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {twitterRoles
                      .filter(u => !twitterRoleSearch || u.handle.toLowerCase().includes(twitterRoleSearch.toLowerCase()))
                      .map(({ handle, role, profileImage }) => (
                      <tr key={handle} className="border-t border-green-800">
                        <td className="p-2">
                          <img 
                            src={profileImage || `https://unavatar.io/twitter/${handle.replace('@', '')}`}
                            alt={handle}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => {
                              e.currentTarget.src = `https://api.dicebear.com/8.x/identicon/svg?seed=${handle}`;
                            }}
                          />
                        </td>
                        <td className="p-2">{handle}</td>
                        <td className="p-2">
                          <select
                            value={role}
                            onChange={e => updateTwitterRole(handle, e.target.value)}
                            className="bg-black border border-green-300 p-1 text-xs"
                          >
                            {roleOptions.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <span className="text-xs text-green-500">{role === 'admin' ? '👑' : role === 'core' ? '⭐' : role === 'scout' ? '🔍' : ''}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <h2 className="text-lg mb-4">Products Management</h2>
            <p className="text-sm opacity-70 mb-4">Manage products that can be assigned to campaigns and KOLs</p>
            
            {/* Redirect to products page */}
            <div className="border border-green-300 p-8 text-center">
              <p className="mb-4 text-green-300">Products management has its own dedicated page for better organization.</p>
              <button
                onClick={() => window.location.href = '/admin/products'}
                className="px-6 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
              >
                Go to Products Page →
              </button>
            </div>
          </div>
        )}

        {/* Discord Tab */}
        {activeTab === 'discord' && (
          <div className="space-y-6">
            <h2 className="text-lg mb-4">Discord Analytics</h2>
            <p className="text-sm opacity-70 mb-4">Monitor Discord server activity, sentiment analysis, and engagement metrics</p>
            
            {/* Redirect to Discord page */}
            <div className="border border-green-300 p-8 text-center">
              <p className="mb-4 text-green-300">Discord analytics has its own dedicated page for managing servers and viewing reports.</p>
              <button
                onClick={() => window.location.href = '/admin/discord'}
                className="px-6 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
              >
                Go to Discord Analytics →
              </button>
            </div>
          </div>
        )}
      </div>
      {/* User Profile Modal */}
      {showProfileModal && selectedUser && (
        <ProfileModal
          user={selectedUser}
          onClose={() => setShowProfileModal(false)}
          onStatusChange={updateUserStatus}
          onDelete={handleDeleteUser}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
}

// Helper functions for cookies
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : undefined;
}

const setCookie = (name: string, value: string, days: number = 1) => {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}