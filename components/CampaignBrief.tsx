'use client'

import { useState } from 'react'
import { FileText } from '@/components/icons'
import { sanitizeHtml } from '@/lib/sanitize-html'

interface CampaignBriefProps {
  brief?: string
  briefUpdatedAt?: string
  briefUpdatedBy?: string
}

export default function CampaignBrief({ brief, briefUpdatedAt, briefUpdatedBy }: CampaignBriefProps) {
  const [expanded, setExpanded] = useState(false)
  
  if (!brief) {
    return (
      <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
        <div className="flex items-center gap-3 text-green-400">
          <FileText className="w-5 h-5" />
          <p>No campaign brief available yet.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-green-900/20 border border-green-500 rounded-lg overflow-hidden">
      <div 
        className="p-6 cursor-pointer hover:bg-green-900/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-green-300" />
            <div>
              <h3 className="text-xl font-semibold text-green-300">Campaign Brief</h3>
              {briefUpdatedAt && (
                <p className="text-sm text-green-500">
                  Last updated {new Date(briefUpdatedAt).toLocaleDateString()} 
                  {briefUpdatedBy && ` by @${briefUpdatedBy}`}
                </p>
              )}
            </div>
          </div>
          <div className={`text-green-300 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </div>
        </div>
      </div>
      
      {expanded && (
        <div className="p-6 pt-0">
          <div className="max-w-none prose prose-invert prose-green">
            <div 
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(brief) }}
              className="campaign-brief"
            />
          </div>
        </div>
      )}
      
      <style jsx>{`
        .campaign-brief h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 1.5rem 0 1rem;
          color: #86efac;
        }
        .campaign-brief h3 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 1.25rem 0 0.75rem;
          color: #86efac;
        }
        .campaign-brief p {
          margin: 0.75rem 0;
          color: #bbf7d0;
          line-height: 1.6;
        }
        .campaign-brief ul, .campaign-brief ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          color: #bbf7d0;
        }
        .campaign-brief li {
          margin: 0.5rem 0;
          line-height: 1.6;
        }
        .campaign-brief strong {
          color: #86efac;
          font-weight: bold;
        }
        .campaign-brief a {
          color: #60a5fa;
          text-decoration: underline;
        }
        .campaign-brief a:hover {
          color: #93c5fd;
        }
        .campaign-brief blockquote {
          border-left: 3px solid #86efac;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #d1fae5;
        }
      `}</style>
    </div>
  )
} 