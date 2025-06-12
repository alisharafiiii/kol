'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Save, Eye, FileText, Copy, Upload } from '@/components/icons'

interface BriefComposerProps {
  campaignId: string
  campaignName: string
  initialBrief?: string
  onClose: () => void
  onSave: (brief: string) => void
}

interface BriefTemplate {
  id: string
  name: string
  content: string
}

interface Asset {
  id: string
  type: 'image' | 'video'
  url: string
  name: string
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

export default function BriefComposer({ campaignId, campaignName, initialBrief, onClose, onSave }: BriefComposerProps) {
  const [content, setContent] = useState(initialBrief || '')
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [showSourceCode, setShowSourceCode] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Load IBM Plex font
  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    
    return () => {
      document.head.removeChild(link)
    }
  }, [])
  
  // Load initial brief or template
  useEffect(() => {
    if (initialBrief) {
      setContent(initialBrief)
      if (editorRef.current) {
        editorRef.current.innerHTML = initialBrief
      }
    }
  }, [initialBrief])
  
  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    for (const file of Array.from(files)) {
      try {
        // Create FormData and upload to server
        const formData = new FormData()
        formData.append('file', file)
        formData.append('campaignId', campaignId)
        
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
        
        const asset: Asset = {
          id: Date.now().toString() + Math.random(),
          type: file.type.startsWith('video/') ? 'video' : 'image',
          url: data.url,
          name: file.name
        }
        setAssets(prev => [...prev, asset])
        
        // Insert asset at cursor position
        insertAtCursor(asset)
      } catch (error) {
        console.error('Error uploading file:', error)
        alert('Failed to upload file')
      }
    }
  }
  
  // Insert asset at cursor
  const insertAtCursor = (asset: Asset) => {
    const assetHtml = asset.type === 'image' 
      ? `<img src="${asset.url}" alt="${asset.name}" style="max-width: 100%; height: auto; margin: 1rem 0;" />`
      : `<video src="${asset.url}" controls style="max-width: 100%; height: auto; margin: 1rem 0;">${asset.name}</video>`
    
    document.execCommand('insertHTML', false, assetHtml)
    updateContent()
  }
  
  // Update content state from editor
  const updateContent = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML)
    }
  }
  
  // Format selected text
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    updateContent()
    editorRef.current?.focus()
  }
  
  // Insert element
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
  
  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = BRIEF_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      const processedContent = template.content.trim().replace('[Campaign Name]', campaignName)
      setContent(processedContent)
      if (editorRef.current) {
        editorRef.current.innerHTML = processedContent
      }
      setSelectedTemplate(templateId)
    }
  }
  
  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(content)
      onClose()
    } catch (error) {
      console.error('Error saving brief:', error)
    } finally {
      setIsSaving(false)
    }
  }
  
  // Copy brief link to clipboard
  const copyBriefLink = () => {
    const briefUrl = `${window.location.origin}/brief/${campaignId}`
    navigator.clipboard.writeText(briefUrl).then(() => {
      alert('Brief link copied to clipboard! You can now test the access control.')
    })
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-500 rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-green-500">
          <h2 className="text-xl font-bold text-green-300">Campaign Brief Editor</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-green-900/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-green-300" />
          </button>
        </div>
        
        {/* Toolbar */}
        <div className="p-4 border-b border-green-500 space-y-3">
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
          
          {/* Formatting buttons - Row 1 */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
              <button
                onClick={() => formatText('bold')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm font-bold"
                title="Bold (Ctrl+B)"
              >
                B
              </button>
              <button
                onClick={() => formatText('italic')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm italic"
                title="Italic (Ctrl+I)"
              >
                I
              </button>
              <button
                onClick={() => formatText('underline')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm underline"
                title="Underline (Ctrl+U)"
              >
                U
              </button>
              <button
                onClick={() => formatText('strikeThrough')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm line-through"
                title="Strikethrough"
              >
                S
              </button>
            </div>
            
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
              <button
                onClick={() => insertElement('h1')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Heading 1"
              >
                H1
              </button>
              <button
                onClick={() => insertElement('h2')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Heading 2"
              >
                H2
              </button>
              <button
                onClick={() => insertElement('h3')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Heading 3"
              >
                H3
              </button>
            </div>
            
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
              <button
                onClick={() => formatText('insertUnorderedList')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Bullet List"
              >
                • List
              </button>
              <button
                onClick={() => formatText('insertOrderedList')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Numbered List"
              >
                1. List
              </button>
              <button
                onClick={() => insertElement('quote')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
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
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Insert Link"
              >
                🔗 Link
              </button>
              <button
                onClick={() => formatText('unlink')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Remove Link"
              >
                ⛓️‍💥 Unlink
              </button>
            </div>
          </div>
          
          {/* Formatting buttons - Row 2 */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
              <button
                onClick={() => formatText('justifyLeft')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Align Left"
              >
                ◀️ Left
              </button>
              <button
                onClick={() => formatText('justifyCenter')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Align Center"
              >
                ⏸️ Center
              </button>
              <button
                onClick={() => formatText('justifyRight')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Align Right"
              >
                ▶️ Right
              </button>
            </div>
            
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
              <button
                onClick={() => insertElement('code')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Code Block"
              >
                {'<>'} Code
              </button>
              <button
                onClick={() => insertElement('table')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Insert Table"
              >
                ⊞ Table
              </button>
              <button
                onClick={() => insertElement('divider')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Horizontal Rule"
              >
                — Divider
              </button>
            </div>
            
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded">
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
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm flex items-center gap-1"
                title="Upload Images/Videos"
              >
                <Upload className="w-4 h-4" />
                Media
              </button>
              <button
                onClick={() => formatText('removeFormat')}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="Clear Formatting"
              >
                🧹 Clear
              </button>
            </div>
            
            <div className="flex gap-1 px-2 py-1 bg-green-900/20 rounded ml-auto">
              <button
                onClick={() => setShowSourceCode(!showSourceCode)}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm"
                title="View HTML Source"
              >
                {'</>'} HTML
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-2 py-1 hover:bg-green-900/50 rounded text-sm flex items-center gap-1"
                title="Toggle Preview"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            </div>
          </div>
          
          {/* Assets preview */}
          {assets.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-green-900/10 rounded">
              <span className="text-xs text-green-400">Assets:</span>
              {assets.map(asset => (
                <div key={asset.id} className="relative group">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.name} className="w-16 h-16 object-cover border border-green-500 rounded" />
                  ) : (
                    <div className="w-16 h-16 border border-green-500 rounded flex items-center justify-center bg-green-900/20">
                      <span className="text-lg">🎬</span>
                    </div>
                  )}
                  <span className="absolute -bottom-5 left-0 right-0 text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.name.substring(0, 10)}...
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 240px)' }}>
          {showPreview ? (
            <div className="p-6 overflow-y-auto h-full bg-white/5">
              <div className="prose prose-invert prose-green max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ __html: content }}
                  className="brief-preview"
                  style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}
                />
              </div>
            </div>
          ) : showSourceCode ? (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (editorRef.current) {
                  editorRef.current.innerHTML = e.target.value
                }
              }}
              className="w-full h-full p-6 bg-black text-green-300 focus:outline-none resize-none"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '13px',
              }}
              placeholder="HTML source code..."
            />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              onInput={updateContent}
              className="w-full h-full p-6 overflow-y-auto focus:outline-none"
              data-placeholder="Start typing your brief or select a template..."
              style={{
                fontFamily: '"IBM Plex Sans", sans-serif',
                lineHeight: 1.8,
                fontSize: '16px',
                color: '#bbf7d0',
                minHeight: '400px',
              }}
            />
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-green-500 flex justify-between">
          <button
            onClick={copyBriefLink}
            className="px-4 py-2 border border-purple-500 text-purple-300 rounded hover:bg-purple-900/30 transition-colors flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Brief Link
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-green-300 hover:text-green-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-green-100 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Brief
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .brief-preview h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 2rem 0 1.5rem;
          color: #86efac;
          font-family: "IBM Plex Sans", sans-serif;
        }
        .brief-preview h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.5rem 0 1rem;
          color: #86efac;
          font-family: "IBM Plex Sans", sans-serif;
        }
        .brief-preview h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.25rem 0 0.75rem;
          color: #86efac;
          font-family: "IBM Plex Sans", sans-serif;
        }
        .brief-preview p {
          margin: 0.75rem 0;
          color: #bbf7d0;
          font-family: "IBM Plex Sans", sans-serif;
          line-height: 1.8;
        }
        .brief-preview ul, .brief-preview ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          color: #bbf7d0;
          font-family: "IBM Plex Sans", sans-serif;
        }
        .brief-preview li {
          margin: 0.5rem 0;
          line-height: 1.8;
        }
        .brief-preview strong {
          color: #86efac;
          font-weight: 600;
        }
        .brief-preview em {
          font-style: italic;
        }
        .brief-preview u {
          text-decoration: underline;
        }
        .brief-preview s {
          text-decoration: line-through;
          opacity: 0.7;
        }
        .brief-preview a {
          color: #60a5fa;
          text-decoration: underline;
        }
        .brief-preview a:hover {
          color: #93c5fd;
        }
        .brief-preview blockquote {
          border-left: 4px solid #86efac;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #86efac;
          font-style: italic;
        }
        .brief-preview pre {
          background: #1a1a1a;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .brief-preview code {
          font-family: "IBM Plex Mono", monospace;
          font-size: 0.9em;
          color: #fbbf24;
        }
        .brief-preview hr {
          border: 0;
          height: 1px;
          background: #065f46;
          margin: 2rem 0;
        }
        .brief-preview table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .brief-preview th {
          padding: 0.5rem;
          text-align: left;
          border-bottom: 2px solid #065f46;
          color: #86efac;
        }
        .brief-preview td {
          padding: 0.5rem;
          border-bottom: 1px solid #065f46;
        }
        .brief-preview img, .brief-preview video {
          margin: 1rem 0;
          border-radius: 0.5rem;
          border: 1px solid #065f46;
          max-width: 100%;
          height: auto;
        }
        
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
        }
        
        [contenteditable] {
          outline: none;
        }
        
        [contenteditable] h1,
        [contenteditable] h2,
        [contenteditable] h3 {
          color: #86efac;
          margin: 1rem 0 0.5rem;
        }
        
        [contenteditable] a {
          color: #60a5fa;
          text-decoration: underline;
        }
        
        [contenteditable] blockquote {
          border-left: 4px solid #86efac;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #86efac;
        }
        
        [contenteditable] pre {
          background: #1a1a1a;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        
        [contenteditable] code {
          font-family: "IBM Plex Mono", monospace;
          color: #fbbf24;
        }
      `}</style>
    </div>
  )
} 