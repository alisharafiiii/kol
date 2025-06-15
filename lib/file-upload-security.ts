import crypto from 'crypto'
import { promisify } from 'util'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

// File upload configuration
export const UPLOAD_CONFIG = {
  // Maximum file sizes by type
  maxSizes: {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    video: 50 * 1024 * 1024, // 50MB
  },
  // Allowed MIME types and their extensions
  allowedTypes: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  } as Record<string, string[]>,
  // Blocked file extensions (even if MIME type is allowed)
  blockedExtensions: [
    '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jse', 
    '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.ps2', '.psc1', '.psc2',
    '.msc', '.msi', '.msp', '.lnk', '.inf', '.reg', '.sct',
    '.php', '.jsp', '.asp', '.aspx', '.cgi', '.pl', '.py'
  ],
  // Magic number signatures for file type verification
  signatures: {
    jpeg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  }
}

/**
 * Verify file type by checking magic numbers (file signature)
 * @param buffer - File buffer
 * @param expectedType - Expected MIME type
 * @returns true if file signature matches expected type
 */
export function verifyFileSignature(buffer: Buffer, expectedType: string): boolean {
  const signatures: Record<string, number[]> = {
    'image/jpeg': UPLOAD_CONFIG.signatures.jpeg,
    'image/png': UPLOAD_CONFIG.signatures.png,
    'image/gif': UPLOAD_CONFIG.signatures.gif,
    'image/webp': UPLOAD_CONFIG.signatures.webp,
    'application/pdf': UPLOAD_CONFIG.signatures.pdf,
  }
  
  const expectedSignature = signatures[expectedType]
  if (!expectedSignature) return true // No signature check for this type
  
  // Check if file starts with expected signature
  for (let i = 0; i < expectedSignature.length; i++) {
    if (buffer[i] !== expectedSignature[i]) {
      return false
    }
  }
  
  // Special check for WebP
  if (expectedType === 'image/webp') {
    // Check for WEBP string at offset 8
    const webpString = buffer.toString('utf8', 8, 12)
    return webpString === 'WEBP'
  }
  
  return true
}

/**
 * Sanitize filename to prevent directory traversal and other attacks
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove any directory components
  const basename = path.basename(filename)
  
  // Remove special characters, only allow alphanumeric, dash, underscore, and dot
  const sanitized = basename.replace(/[^a-zA-Z0-9\-_.]/g, '_')
  
  // Ensure it doesn't start with a dot (hidden file)
  const finalName = sanitized.startsWith('.') ? `file_${sanitized}` : sanitized
  
  // Limit length
  if (finalName.length > 255) {
    const ext = path.extname(finalName)
    const name = path.basename(finalName, ext)
    return name.substring(0, 255 - ext.length) + ext
  }
  
  return finalName
}

/**
 * Generate secure random filename
 * @param originalFilename - Original filename (for extension)
 * @returns Secure random filename
 */
export function generateSecureFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase()
  const randomBytes = crypto.randomBytes(32)
  const hash = crypto.createHash('sha256').update(randomBytes).digest('hex')
  const timestamp = Date.now()
  
  return `${timestamp}_${hash}${ext}`
}

/**
 * Validate uploaded file
 * @param file - File object
 * @param buffer - File buffer
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateUploadedFile(
  file: File,
  buffer: Buffer,
  options: {
    maxSize?: number
    allowedTypes?: string[]
    category?: 'image' | 'document' | 'video'
  } = {}
): Promise<{
  valid: boolean
  error?: string
  sanitizedFilename?: string
  secureFilename?: string
}> {
  // Check file size
  const maxSize = options.maxSize || 
    (options.category ? UPLOAD_CONFIG.maxSizes[options.category] : UPLOAD_CONFIG.maxSizes.image)
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
    }
  }
  
  // Check MIME type
  const allowedTypes = options.allowedTypes || Object.keys(UPLOAD_CONFIG.allowedTypes)
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    }
  }
  
  // Check file extension
  const ext = path.extname(file.name).toLowerCase()
  const allowedExtensions = UPLOAD_CONFIG.allowedTypes[file.type] || []
  
  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File extension doesn't match file type`
    }
  }
  
  // Check blocked extensions
  if (UPLOAD_CONFIG.blockedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File type not allowed for security reasons`
    }
  }
  
  // Verify file signature
  if (!verifyFileSignature(buffer, file.type)) {
    return {
      valid: false,
      error: `File content doesn't match declared type`
    }
  }
  
  // Generate sanitized and secure filenames
  const sanitizedFilename = sanitizeFilename(file.name)
  const secureFilename = generateSecureFilename(file.name)
  
  return {
    valid: true,
    sanitizedFilename,
    secureFilename
  }
}

/**
 * Scan file for viruses using ClamAV (if available)
 * @param filepath - Path to file to scan
 * @returns Scan result
 */
export async function scanFileForViruses(filepath: string): Promise<{
  clean: boolean
  error?: string
}> {
  try {
    // Check if ClamAV is installed
    await execAsync('which clamscan')
    
    // Run virus scan
    const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filepath}"`)
    
    // Check result
    if (stderr || stdout.includes('FOUND')) {
      console.error('Virus detected:', stdout, stderr)
      return {
        clean: false,
        error: 'File contains malicious content'
      }
    }
    
    return { clean: true }
  } catch (error) {
    // ClamAV not installed or scan failed
    console.warn('Virus scanning not available:', error)
    // Return true to not block uploads if AV is not available
    // In production, you might want to make this required
    return { clean: true }
  }
}

/**
 * Process uploaded image (resize, optimize, strip metadata)
 * @param inputPath - Path to input image
 * @param outputPath - Path to output image
 * @param options - Processing options
 */
export async function processUploadedImage(
  inputPath: string,
  outputPath: string,
  options: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    stripMetadata?: boolean
  } = {}
): Promise<void> {
  const maxWidth = options.maxWidth || 2048
  const maxHeight = options.maxHeight || 2048
  const quality = options.quality || 85
  
  try {
    // Use ImageMagick to process image (if available)
    const command = [
      'convert',
      `"${inputPath}"`,
      '-auto-orient', // Fix orientation
      options.stripMetadata !== false ? '-strip' : '', // Strip metadata by default
      `-resize ${maxWidth}x${maxHeight}>`, // Resize only if larger
      `-quality ${quality}`,
      `"${outputPath}"`
    ].filter(Boolean).join(' ')
    
    await execAsync(command)
  } catch (error) {
    // ImageMagick not available, just copy the file
    console.warn('Image processing not available:', error)
    await fs.copyFile(inputPath, outputPath)
  }
}

/**
 * Create a secure file upload handler
 * @param uploadDir - Directory to store uploads
 * @param options - Upload options
 * @returns Upload handler function
 */
export function createSecureUploadHandler(
  uploadDir: string,
  options: {
    maxSize?: number
    allowedTypes?: string[]
    category?: 'image' | 'document' | 'video'
    processImages?: boolean
    scanViruses?: boolean
  } = {}
) {
  return async (file: File): Promise<{
    success: boolean
    url?: string
    error?: string
    details?: any
  }> => {
    try {
      // Read file buffer
      const buffer = Buffer.from(await file.arrayBuffer())
      
      // Validate file
      const validation = await validateUploadedFile(file, buffer, options)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }
      
      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true })
      
      // Generate file paths
      const tempPath = path.join(uploadDir, `temp_${validation.secureFilename}`)
      const finalPath = path.join(uploadDir, validation.secureFilename!)
      
      // Write temp file
      await fs.writeFile(tempPath, buffer)
      
      // Scan for viruses if enabled
      if (options.scanViruses) {
        const scanResult = await scanFileForViruses(tempPath)
        if (!scanResult.clean) {
          // Delete infected file
          await fs.unlink(tempPath)
          return {
            success: false,
            error: scanResult.error || 'File failed security scan'
          }
        }
      }
      
      // Process image if needed
      if (options.processImages && file.type.startsWith('image/')) {
        await processUploadedImage(tempPath, finalPath)
        await fs.unlink(tempPath) // Delete temp file
      } else {
        // Just move the file
        await fs.rename(tempPath, finalPath)
      }
      
      // Generate public URL
      const publicPath = path.relative(path.join(process.cwd(), 'public'), finalPath)
      const url = `/${publicPath.replace(/\\/g, '/')}`
      
      return {
        success: true,
        url,
        details: {
          originalName: file.name,
          sanitizedName: validation.sanitizedFilename,
          secureName: validation.secureFilename,
          size: file.size,
          type: file.type
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: 'Failed to process upload',
        details: error
      }
    }
  }
} 