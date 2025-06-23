import React, { useState, useEffect, useMemo } from 'react';
import { Project } from '@/lib/project';

// Import social platform base URLs
const socialPlatformUrls = {
  twitter: 'https://twitter.com/',
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/@',
  discord: 'https://discord.gg/',
  telegram: 'https://t.me/',
  other: ''
};

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  showCreator?: boolean;
  creatorProfileUrl?: string;
}

const getBadgeColor = (type?: string) => {
  switch (type) {
    case 'gold': return 'bg-yellow-500 text-yellow-900 shadow-glow-yellow';
    case 'blue': return 'bg-blue-500 text-blue-900 shadow-glow-blue';
    default: return 'bg-gray-500 text-gray-900';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-red-900/30 border-red-500 text-red-400';
    case 'medium': return 'bg-yellow-900/30 border-yellow-500 text-yellow-400';
    case 'low': return 'bg-green-900/30 border-green-500 text-green-400';
    default: return 'bg-gray-900/30 border-gray-500 text-gray-400';
  }
};

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'dmd': return 'bg-blue-900/30 text-blue-400';
    case 'replied': return 'bg-green-900/30 text-green-400';
    case 'no-reply': return 'bg-red-900/30 text-red-400';
    case 'meeting': return 'bg-purple-900/30 text-purple-400';
    case 'no-budget': return 'bg-gray-900/30 text-gray-400';
    case 'high-budget': return 'bg-yellow-900/30 text-yellow-400';
    case 'completed': return 'bg-green-900/30 text-green-400';
    case 'rejected': return 'bg-red-900/30 text-red-400';
    default: return 'bg-gray-900/30 text-gray-400';
  }
};

const getStageName = (stage: string) => {
  switch (stage) {
    case 'dmd': return 'DMD';
    case 'replied': return 'Replied';
    case 'no-reply': return 'No Reply';
    case 'meeting': return 'Meeting';
    case 'no-budget': return 'No Budget';
    case 'high-budget': return 'High Budget';
    case 'completed': return 'Completed';
    case 'rejected': return 'Rejected';
    default: return stage;
  }
};

// Get social platform icon
const getSocialIcon = (platform: string): string => {
  switch (platform) {
    case 'twitter': return '𝕏';
    case 'instagram': return '📷';
    case 'tiktok': return '📱';
    case 'youtube': return '▶️';
    case 'discord': return '💬';
    case 'telegram': return '📢';
    default: return '🔗';
  }
};

// Get social link URL from username
const getSocialLink = (platform: string, username: string): string => {
  if (platform === 'other') return username;
  return platform in socialPlatformUrls 
    ? `${socialPlatformUrls[platform as keyof typeof socialPlatformUrls]}${username}`
    : username;
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, showCreator = false, creatorProfileUrl }) => {
  const [creatorImage, setCreatorImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingCreator, setIsLoadingCreator] = useState(false);
  
  // Memoize the creator identicon to prevent flickering
  const creatorIdenticon = useMemo(() => 
    `https://api.dicebear.com/8.x/identicon/svg?seed=${project.createdBy || 'unknown'}`,
    [project.createdBy]
  );
  
  console.log(`[ProjectCard] Rendering project: ${project.id} - ${project.twitterHandle}`);
  console.log(`[ProjectCard] Project profile image: ${project.profileImageUrl || 'none'}`);
  console.log(`[ProjectCard] Creator: ${project.createdBy}`);
  
  // Fetch creator profile picture
  useEffect(() => {
    let mounted = true;
    
    const fetchCreatorProfile = async () => {
      // Skip if already loading or if we have an image
      if (isLoadingCreator || creatorImage) return;
      
      try {
        if (project.createdBy) {
          setIsLoadingCreator(true);
          // Clean the handle - remove @ if present
          const cleanHandle = project.createdBy.replace('@', '');
          const response = await fetch(`/api/user/profile?handle=${encodeURIComponent(cleanHandle)}`);
          
          if (mounted && response.ok) {
            const data = await response.json();
            
            if (data.user && data.user.profileImageUrl) {
              setCreatorImage(data.user.profileImageUrl);
            }
          }
        }
      } catch (error) {
        console.error('[ProjectCard] Error fetching creator profile:', error);
      } finally {
        if (mounted) {
          setIsLoadingCreator(false);
        }
      }
    };

    fetchCreatorProfile();
    
    return () => {
      mounted = false;
    };
  }, [project.createdBy]); // Remove creatorImage from dependencies to prevent loops

  return (
    <div 
      className="license-card relative border-4 border-green-400 p-3 bg-black mb-3 cursor-pointer hover:bg-green-900/10 transition-colors rounded-md shadow-lg hover:shadow-green-900/50"
      onClick={onClick}
      style={{ 
        backgroundImage: 'radial-gradient(circle at top right, rgba(0, 50, 20, 0.2), transparent 70%)',
        transition: 'all 0.3s ease' 
      }}
    >
      <div className="absolute top-0 right-0 h-20 w-20 opacity-10 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-green-400">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
        </svg>
      </div>

      <div className="flex justify-between items-start mb-3">
        <div className="license-header text-xs uppercase font-bold tracking-widest text-green-300">
          Project Profile
        </div>
      </div>
      
      <div className="flex gap-3">
        <div className="license-photo w-28 h-28 border-2 border-green-300 overflow-hidden relative rounded-md shadow-inner">
          {/* Show a single circular checkmark overlay for gold/blue badge */}
          {project.badgeType && project.badgeType !== 'none' && (
            <svg
              className={`absolute top-1 right-1 w-5 h-5 ${
                project.badgeType === 'gold' ? 'text-yellow-400' : 'text-blue-400'
              }`}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-label="Verified badge"
            >
              {/* Outer circle with slight opacity so it shows on any background */}
              <circle cx="12" cy="12" r="11" className="opacity-25" />
              {/* Tick */}
              <path
                d="M16 8l-5 6-3-2.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}

          {project.profileImageUrl ? (
            <img 
              src={project.profileImageUrl} 
              alt={project.twitterHandle} 
              className="w-full h-full object-cover transition-transform hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/100?text=Invalid';
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-green-900 flex items-center justify-center">
              <span className="text-xs text-green-300">NO IMAGE</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-center">
            <div className="text-[8px] text-green-300">ID-{(project.id || 'unknown').substring(0, 4)}</div>
          </div>
          {/* Creator avatar overlay */}
          {creatorImage && (
            <img
              src={creatorImage}
              alt="Creator"
              className="w-10 h-10 rounded-full border-2 border-green-300 absolute bottom-1 right-1 bg-black object-cover shadow-lg"
            />
          )}
        </div>
        
        <div className="license-data flex-1 text-xs flex flex-col gap-1">
          <div className="license-field">
            <span className="opacity-70">HANDLE:</span> 
            {project.twitterHandle ? (
              <a 
                href={`https://twitter.com/${project.twitterHandle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold ml-1 hover:text-blue-400"
                onClick={(e) => e.stopPropagation()}
              >
                {project.twitterHandle}
              </a>
            ) : (
              <span className="font-bold ml-1 text-gray-500">N/A</span>
            )}
          </div>
          <div className="license-field">
            <span className="opacity-70">FOLLOWERS:</span> <span className="font-bold">{project.followerCount?.toLocaleString() || 'N/A'}</span>
          </div>
          <div className="license-field flex items-center">
            <span className="opacity-70 mr-1">PRIORITY:</span> 
            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${getPriorityColor(project.priority || 'low')}`}>
              {(project.priority || 'low').toUpperCase()}
            </span>
          </div>
          <div className="license-field flex items-center">
            <span className="opacity-70 mr-1">STAGE:</span>
            <span className={`font-bold text-[10px] ${getStageColor(project.stage || 'dmd')}`}>{getStageName(project.stage || 'dmd')}</span>
          </div>
          
          {project.website && (
            <div className="license-field truncate">
              <span className="opacity-70">WEB:</span>
              <a 
                href={project.website}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-400 hover:underline truncate max-w-[150px] inline-block"
                onClick={(e) => e.stopPropagation()}
              >
                {project.website.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            </div>
          )}
        </div>
      </div>
      
      <div className="license-footer mt-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* If creatorImage failed earlier, identicon is set; this fallback rarely triggers */}
          {!creatorImage && (
            <img
              src={creatorIdenticon}
              alt="Creator"
              className="w-6 h-6 rounded-full border border-green-300"
            />
          )}
          
          {showCreator && project.assignedTo ? (
            <div className="license-creator text-[8px] opacity-70">
              ASSIGNED TO: {(project.assignedTo || 'Unknown').substring(0, 8)}...
            </div>
          ) : (
            <div className="license-creator text-[8px] opacity-70">
              BY: {(project.createdBy || 'Unknown').substring(0, 8)}...
            </div>
          )}
        </div>
        
        {/* Social links with interactive icons */}
        <div className="social-links flex gap-1">
          {project.socialLinks && Object.entries(project.socialLinks).map(([platform, username]) => (
            <a
              key={platform}
              href={getSocialLink(platform, username)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 rounded border border-green-300 flex items-center justify-center text-[10px] bg-green-900/20 hover:bg-green-900/50 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title={`${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${username}`}
            >
              {getSocialIcon(platform)}
            </a>
          ))}
          {project.website && (
            <a
              href={project.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 rounded border border-green-300 flex items-center justify-center text-[10px] bg-green-900/20 hover:bg-green-900/50 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Website"
            >
              🌐
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard; 