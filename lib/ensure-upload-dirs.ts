import { mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// List of directories to ensure exist
const UPLOAD_DIRS = [
  join(process.cwd(), 'public', 'uploads'),
  join(process.cwd(), 'public', 'uploads', 'briefs')
]

export async function ensureUploadDirectories() {
  for (const dir of UPLOAD_DIRS) {
    if (!existsSync(dir)) {
      try {
        await mkdir(dir, { recursive: true })
        console.log(`Created upload directory: ${dir}`)
      } catch (error) {
        console.error(`Failed to create upload directory ${dir}:`, error)
      }
    }
  }
}

// Run on import
ensureUploadDirectories().catch(console.error)

// Ensure upload directories exist
async function ensureUploadDirs() {
  try {
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    console.log('Upload directory ensured:', uploadDir)
  } catch (error) {
    console.error('Error creating upload directory:', error)
  }
}

// Run on module load
if (typeof window === 'undefined') {
  ensureUploadDirs()
} 