import DOMPurify from 'isomorphic-dompurify'

// Allowed HTML tags for campaign briefs
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'b', 'i',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'div', 'span'
]

// Allowed attributes for specific tags
const ALLOWED_ATTR = [
  'href', 'target', 'rel', // for links
  'src', 'alt', 'width', 'height', // for images
  'class', 'style' // for styling
]

// DOMPurify configuration
const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
  // Prevent window.open and other JS execution
  ADD_ATTR: ['target'],
  // Force external links to open in new tab with proper security
  FORCE_BODY: true,
  IN_PLACE: false
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The potentially unsafe HTML string
 * @param options - Optional override configuration
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string, options?: Partial<typeof PURIFY_CONFIG>): string {
  if (!dirty) return ''
  
  const config = { ...PURIFY_CONFIG, ...options }
  
  // Add hook to make external links safer
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href')
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    }
  })
  
  const clean = DOMPurify.sanitize(dirty, config)
  
  // Remove the hook after use
  DOMPurify.removeHook('afterSanitizeAttributes')
  
  return clean
}

/**
 * Sanitize HTML for display in a text-only context
 * Removes all HTML tags and returns plain text
 */
export function sanitizeToText(dirty: string): string {
  if (!dirty) return ''
  
  // Remove all HTML tags
  const clean = DOMPurify.sanitize(dirty, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
  
  // For server-side, just return the cleaned string
  // HTML entities will be decoded on the client if needed
  if (typeof window === 'undefined') {
    return clean
  }
  
  // Decode HTML entities on client-side
  const textArea = document.createElement('textarea')
  textArea.innerHTML = clean
  return textArea.value
}

/**
 * Check if HTML content is safe without modifying it
 * @returns true if content is safe, false if it contains dangerous elements
 */
export function isHtmlSafe(html: string): boolean {
  if (!html) return true
  
  const clean = DOMPurify.sanitize(html, PURIFY_CONFIG)
  return clean === html
} 