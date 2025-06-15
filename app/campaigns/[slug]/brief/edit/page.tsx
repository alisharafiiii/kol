'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Save, Eye, Upload } from '@/components/icons'
import { sanitizeHtml } from '@/lib/sanitize-html'
import type { Campaign } from '@/lib/campaign'

interface Asset {
  id: string
  type: 'image' | 'video'
  url: string
  name: string
}

interface BriefTemplate {
  id: string
  name: string
  content: string
}

const BRIEF_TEMPLATES: BriefTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch',
    content: `
<h2>Campaign Brief: [Campaign Name]</h2>

<h3>📋 Overview</h3>
<p>We're excited to partner with you for the launch of [Product Name]. This campaign aims to generate awareness and drive engagement for our new product.</p>

<h3>🎯 Campaign Objectives</h3>
<ul>
  <li>Create authentic content showcasing the product</li>
  <li>Drive awareness among your audience</li>
  <li>Generate engagement and conversations</li>
  <li>Share your genuine experience with the product</li>
</ul>

<h3>📱 Content Requirements</h3>
<ul>
  <li><strong>Platform:</strong> [Twitter/Instagram/TikTok]</li>
  <li><strong>Content Type:</strong> [Thread/Post/Video]</li>
  <li><strong>Posting Date:</strong> [Date Range]</li>
  <li><strong>Hashtags:</strong> #[Required] #[Hashtags]</li>
  <li><strong>Mentions:</strong> @[Brand Handle]</li>
</ul>

<h3>💡 Key Messages</h3>
<ul>
  <li>[Key message 1]</li>
  <li>[Key message 2]</li>
  <li>[Key message 3]</li>
</ul>

<h3>🚫 Do's and Don'ts</h3>
<p><strong>Do:</strong></p>
<ul>
  <li>Be authentic and share your genuine experience</li>
  <li>Use high-quality images/videos</li>
  <li>Engage with your audience's comments</li>
</ul>
<p><strong>Don't:</strong></p>
<ul>
  <li>Make unsubstantiated claims</li>
  <li>Copy/paste provided text verbatim</li>
  <li>Delete the post without prior discussion</li>
</ul>

<h3>📊 Performance Expectations</h3>
<p>We're looking for quality engagement over raw numbers. Focus on creating content that resonates with your audience.</p>

<h3>💰 Compensation</h3>
<p>[Payment details and timeline]</p>

<h3>📞 Contact</h3>
<p>For questions or clarifications, please reach out to:<br/>
[Contact Name] - [Contact Method]</p>
`
  },
  {
    id: 'brand-awareness',
    name: 'Brand Awareness',
    content: `
<h2>Brand Awareness Campaign Brief</h2>

<h3>🌟 About [Brand Name]</h3>
<p>[Brand introduction and values]</p>

<h3>🎯 Campaign Goals</h3>
<ul>
  <li>Increase brand visibility</li>
  <li>Share brand story and values</li>
  <li>Connect with new audiences</li>
</ul>

<h3>📝 Content Guidelines</h3>
<p>Create content that highlights:</p>
<ul>
  <li>Your personal connection to the brand</li>
  <li>How the brand fits into your lifestyle</li>
  <li>What makes the brand unique</li>
</ul>

<h3>🎨 Creative Direction</h3>
<p>[Visual style, tone, and mood guidelines]</p>

<h3>⏰ Timeline</h3>
<ul>
  <li><strong>Brief Sent:</strong> [Date]</li>
  <li><strong>Content Review:</strong> [Date]</li>
  <li><strong>Go Live:</strong> [Date]</li>
</ul>
`
  },
  {
    id: 'event-promotion',
    name: 'Event Promotion',
    content: `
<h2>Event Promotion Brief</h2>

<h3>🎉 Event Details</h3>
<ul>
  <li><strong>Event Name:</strong> [Name]</li>
  <li><strong>Date:</strong> [Date]</li>
  <li><strong>Location:</strong> [Venue/Online]</li>
  <li><strong>Time:</strong> [Time & Timezone]</li>
</ul>

<h3>📱 Promotion Timeline</h3>
<ul>
  <li><strong>Announcement Post:</strong> [Date]</li>
  <li><strong>Reminder Posts:</strong> [Dates]</li>
  <li><strong>Live Coverage:</strong> [If applicable]</li>
  <li><strong>Recap Post:</strong> [Date]</li>
</ul>

<h3>🎯 Key Information to Share</h3>
<ul>
  <li>Event highlights and speakers</li>
  <li>Registration/ticket information</li>
  <li>What attendees can expect</li>
  <li>Your excitement about the event</li>
</ul>
`
  }
]

export default function BriefEditPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const slug = params.slug as string
  
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Load campaign data
  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await fetch(`/api/campaigns/slug/${slug}`)
        if (!res.ok) throw new Error('Failed to fetch campaign')
        const data = await res.json()
        setCampaign(data)
        
        // Load existing brief content
        if (data.brief) {
          const sanitizedBrief = sanitizeHtml(data.brief)
          setContent(sanitizedBrief)
          if (editorRef.current && !showPreview) {
            editorRef.current.innerHTML = sanitizedBrief
          }
        }
      } catch (err) {
        console.error('Error fetching campaign:', err)
        setError('Failed to load campaign')
      } finally {
        setLoading(false)
      }
    }
    
    fetchCampaign()
  }, [slug])
  
  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !campaign) return
    
    for (const file of Array.from(files)) {
      try {
        // Create FormData and upload to server
        const formData = new FormData()
        formData.append('file', file)
        formData.append('campaignId', campaign.id)
        
        const response = await fetch('/api/upload/brief-image', {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          const error = await response.json()
          alert(error.error || 'Failed to upload image')
          continue
        }
        
        const data = await response.json()
        
        // Insert image at cursor position
        const imgHtml = `<img src="${data.url}" alt="${file.name}" style="max-width: 100%; height: auto; margin: 1rem 0;" />`
        document.execCommand('insertHTML', false, imgHtml)
        updateContent()
      } catch (error) {
        console.error('Error uploading file:', error)
        alert('Failed to upload file')
      }
    }
  }
  
  const updateContent = () => {
    if (editorRef.current && !showPreview) {
      setContent(editorRef.current.innerHTML)
    }
  }
  
  const formatText = (command: string, value?: string) => {
    if (showPreview) return
    document.execCommand(command, false, value)
    updateContent()
    editorRef.current?.focus()
  }
  
  const insertElement = (type: string) => {
    let html = ''
    switch (type) {
      case 'h1':
        html = '<h1>Heading 1</h1>'
        break
      case 'h2':
        html = '<h2>Heading 2</h2>'
        break
      case 'h3':
        html = '<h3>Heading 3</h3>'
        break
      case 'quote':
        html = '<blockquote style="border-left: 4px solid #86efac; padding-left: 1rem; margin: 1rem 0; color: #86efac;">Quote text here</blockquote>'
        break
      case 'code':
        html = '<pre style="background: #1a1a1a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;"><code>Code here</code></pre>'
        break
      case 'divider':
        html = '<hr style="border: 0; height: 1px; background: #065f46; margin: 2rem 0;" />'
        break
      case 'table':
        html = `
          <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
            <thead>
              <tr style="border-bottom: 2px solid #065f46;">
                <th style="padding: 0.5rem; text-align: left;">Header 1</th>
                <th style="padding: 0.5rem; text-align: left;">Header 2</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #065f46;">
                <td style="padding: 0.5rem;">Cell 1</td>
                <td style="padding: 0.5rem;">Cell 2</td>
              </tr>
            </tbody>
          </table>
        `
        break
    }
    
    document.execCommand('insertHTML', false, html)
    updateContent()
  }
  
  const applyTemplate = (templateId: string) => {
    const template = BRIEF_TEMPLATES.find(t => t.id === templateId)
    if (template && campaign) {
      const processedContent = template.content.trim().replace('[Campaign Name]', campaign.name)
      const sanitizedContent = sanitizeHtml(processedContent)
      setContent(sanitizedContent)
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizedContent
      }
      setSelectedTemplate(templateId)
    }
  }
  
  const handleSave = async () => {
    if (!campaign) return
    
    setIsSaving(true)
    try {
      console.log('Saving brief for campaign:', campaign.id)
      console.log('Brief content length:', content.length)
      
      const res = await fetch(`/api/campaigns/${campaign.id}/brief`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brief: content }),
      })
      
      const data = await res.json()
      console.log('Save response:', res.status, data)
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save brief')
      }
      
      alert('Brief saved successfully!')
      router.push(`/campaigns/${slug}`)
    } catch (error) {
      console.error('Error saving brief:', error)
      alert(`Failed to save brief: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }
  
  const copyBriefLink = () => {
    if (!campaign) return
    const briefUrl = `${window.location.origin}/brief/${campaign.id}`
    navigator.clipboard.writeText(briefUrl).then(() => {
      alert('Brief link copied to clipboard!')
    })
  }
  
  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-green-300">Loading...</div>
  }
  
  if (error || !campaign) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-red-400">{error || 'Campaign not found'}</div>
  }
  
  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap');
        body { font-family: 'IBM Plex Sans', sans-serif; }
        [contenteditable] { outline: none; }
        [contenteditable]:empty:before { 
          content: attr(data-placeholder); 
          color: #6b7280; 
          pointer-events: none; 
          display: block;
        }
        
        /* Ensure consistent styling in editor and preview */
        .editor-content h1,
        .preview-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 2rem 0 1.5rem;
          color: #86efac;
        }
        
        .editor-content h2,
        .preview-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.5rem 0 1rem;
          color: #86efac;
        }
        
        .editor-content h3,
        .preview-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.25rem 0 0.75rem;
          color: #86efac;
        }
        
        .editor-content p,
        .preview-content p {
          margin: 0.75rem 0;
          line-height: 1.8;
        }
        
        .editor-content ul, .editor-content ol,
        .preview-content ul, .preview-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }
        
        .editor-content li,
        .preview-content li {
          margin: 0.5rem 0;
          line-height: 1.8;
        }
        
        .editor-content strong,
        .preview-content strong {
          color: #86efac;
          font-weight: 600;
        }
        
        .editor-content a,
        .preview-content a {
          color: #60a5fa;
          text-decoration: underline;
        }
        
        .editor-content img, .editor-content video,
        .preview-content img, .preview-content video {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1rem auto;
          border-radius: 0.5rem;
          border: 1px solid #065f46;
        }
      `}</style>
      
      {/* Header */}
      <div className="border-b border-green-500 bg-black sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/campaigns/${slug}`)} className="p-2 hover:bg-green-900/30 rounded">
              <ArrowLeft className="w-5 h-5 text-green-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-green-300">Edit Campaign Brief</h1>
              <p className="text-sm text-green-400">{campaign.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={copyBriefLink}
              className="px-4 py-2 border border-purple-500 text-purple-300 rounded hover:bg-purple-900/30"
            >
              🔗 Copy Brief Link
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Brief</>}
            </button>
          </div>
        </div>
      </div>
      
      {/* Toolbar */}
      {!showPreview && (
        <div className="border-b border-green-500 bg-black/95 sticky top-[73px] z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
            {/* Template selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-green-400">Template:</label>
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="px-3 py-1 bg-black border border-green-500 rounded text-green-300 text-sm focus:outline-none focus:border-green-400"
              >
                <option value="">Choose a template...</option>
                {BRIEF_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Formatting buttons */}
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
                <button
                  onClick={() => formatText('bold')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm font-bold text-green-300"
                  title="Bold (Ctrl+B)"
                >
                  B
                </button>
                <button
                  onClick={() => formatText('italic')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm italic text-green-300"
                  title="Italic (Ctrl+I)"
                >
                  I
                </button>
                <button
                  onClick={() => formatText('underline')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm underline text-green-300"
                  title="Underline (Ctrl+U)"
                >
                  U
                </button>
                <button
                  onClick={() => formatText('strikeThrough')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm line-through text-green-300"
                  title="Strikethrough"
                >
                  S
                </button>
              </div>
              
              <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
                <button
                  onClick={() => insertElement('h1')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Heading 1"
                >
                  H1
                </button>
                <button
                  onClick={() => insertElement('h2')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Heading 2"
                >
                  H2
                </button>
                <button
                  onClick={() => insertElement('h3')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Heading 3"
                >
                  H3
                </button>
              </div>
              
              <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
                <button
                  onClick={() => formatText('insertUnorderedList')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Bullet List"
                >
                  • List
                </button>
                <button
                  onClick={() => formatText('insertOrderedList')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Numbered List"
                >
                  1. List
                </button>
                <button
                  onClick={() => insertElement('quote')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Blockquote"
                >
                  " Quote
                </button>
              </div>
              
              <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
                <button
                  onClick={() => {
                    const url = prompt('Enter URL:')
                    if (url) {
                      formatText('createLink', url)
                    }
                  }}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Insert Link"
                >
                  🔗 Link
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm flex items-center gap-1 text-green-300"
                  title="Upload Images/Videos"
                >
                  <Upload className="w-4 h-4" />
                  Media
                </button>
              </div>
              
              <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
                <button
                  onClick={() => formatText('justifyLeft')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Align Left"
                >
                  ◀️
                </button>
                <button
                  onClick={() => formatText('justifyCenter')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Align Center"
                >
                  ⏸️
                </button>
                <button
                  onClick={() => formatText('justifyRight')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Align Right"
                >
                  ▶️
                </button>
              </div>
              
              <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
                <button
                  onClick={() => insertElement('table')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Insert Table"
                >
                  ⊞ Table
                </button>
                <button
                  onClick={() => insertElement('divider')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Horizontal Rule"
                >
                  — Divider
                </button>
                <button
                  onClick={() => formatText('removeFormat')}
                  className="px-2 py-1 hover:bg-green-900/50 rounded text-sm text-green-300"
                  title="Clear Formatting"
                >
                  🧹 Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Content Area */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {showPreview ? (
          <div 
            className="preview-content prose prose-invert prose-green max-w-none p-6 bg-black/50 rounded-lg border border-green-500/30" 
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            style={{ color: '#bbf7d0' }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={updateContent}
            className="editor-content min-h-[600px] p-6 bg-black/50 rounded-lg border border-green-500/30 focus:border-green-500"
            data-placeholder="Start typing your brief or select a template..."
            style={{ lineHeight: 1.8, fontSize: '16px', color: '#bbf7d0' }}
          />
        )}
      </div>
    </div>
  )
} 