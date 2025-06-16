'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Upload } from '@/components/icons'
import type { UnifiedProfile } from '@/lib/types/profile'

export default function EditProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UnifiedProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    email: '',
    phone: '',
    telegram: '',
    discord: '',
    country: '',
    city: '',
    languages: [] as string[],
    instagram: '',
    youtube: '',
    tiktok: '',
    website: '',
    profileImage: '',
  })
  
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/login')
      return
    }
    
    loadProfile()
  }, [session, status])
  
  const loadProfile = async () => {
    try {
      setLoading(true)
      const handle = (session as any)?.twitterHandle || session?.user?.name
      
      const res = await fetch(`/api/profile/${handle}`)
      if (!res.ok) {
        throw new Error('Failed to load profile')
      }
      
      const data = await res.json()
      setProfile(data)
      
      // Initialize form with existing data
      setFormData({
        name: data.name || '',
        bio: data.bio || '',
        email: data.email || '',
        phone: data.phone || '',
        telegram: data.contacts?.telegram || '',
        discord: data.contacts?.discord || '',
        country: data.country || '',
        city: data.city || '',
        languages: data.languages || [],
        instagram: data.socialLinks?.instagram || '',
        youtube: data.socialLinks?.youtube || '',
        tiktok: data.socialLinks?.tiktok || '',
        website: data.socialLinks?.website || '',
        profileImage: data.profileImageUrl || '',
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const handle = (session as any)?.twitterHandle || session?.user?.name
      
      // Debug logging for Atitty
      if (handle?.toLowerCase().includes('atitty')) {
        console.log('=== ATITTY PROFILE EDIT DEBUG ===')
        console.log('Session:', session)
        console.log('Handle being used:', handle)
        console.log('Profile handle:', profile?.twitterHandle)
      }
      
      const updateData = {
        name: formData.name,
        bio: formData.bio,
        email: formData.email,
        phone: formData.phone,
        contacts: {
          telegram: formData.telegram,
          discord: formData.discord,
        },
        country: formData.country,
        city: formData.city,
        languages: formData.languages.filter(Boolean),
        socialLinks: {
          instagram: formData.instagram,
          youtube: formData.youtube,
          tiktok: formData.tiktok,
          website: formData.website,
        },
        profileImageUrl: formData.profileImage,
      }
      
      const res = await fetch(`/api/profile/${handle}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }
      
      setSuccessMessage('Profile updated successfully!')
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/profile/${handle}`)
      }, 2000)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // For now, convert to base64 - in production, upload to a service
    const reader = new FileReader()
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        profileImage: e.target?.result as string
      }))
    }
    reader.readAsDataURL(file)
  }
  
  const handleLanguageChange = (index: number, value: string) => {
    const newLanguages = [...formData.languages]
    newLanguages[index] = value
    setFormData(prev => ({ ...prev, languages: newLanguages }))
  }
  
  const addLanguage = () => {
    setFormData(prev => ({ ...prev, languages: [...prev.languages, ''] }))
  }
  
  const removeLanguage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index)
    }))
  }
  
  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-green-300 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }
  
  if (error && !profile) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black text-green-300 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-green-900/50 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold">Edit Profile</h1>
          </div>
        </div>
        
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <p className="text-green-300">{successMessage}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Profile Picture</h3>
            <div className="flex items-center gap-6">
              <img
                src={formData.profileImage || `https://unavatar.io/twitter/${profile?.twitterHandle}`}
                alt="Profile"
                className="w-24 h-24 rounded-full border-2 border-green-500"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Change Picture
                </div>
              </label>
            </div>
          </div>
          
          {/* Basic Information */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Twitter Handle
                </label>
                <input
                  type="text"
                  value={`@${profile?.twitterHandle || ''}`}
                  className="w-full px-3 py-2 bg-black/50 border border-green-500/50 rounded text-green-500 cursor-not-allowed"
                  disabled
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>
          </div>
          
          {/* Contact Information */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="+1234567890"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Telegram
                </label>
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Discord
                </label>
                <input
                  type="text"
                  value={formData.discord}
                  onChange={(e) => setFormData(prev => ({ ...prev, discord: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="username#1234"
                />
              </div>
            </div>
          </div>
          
          {/* Location & Languages */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Location & Languages</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="United States"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="New York"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Languages
              </label>
              <div className="space-y-2">
                {formData.languages.map((lang, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={lang}
                      onChange={(e) => handleLanguageChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                      placeholder="English"
                    />
                    <button
                      type="button"
                      onClick={() => removeLanguage(index)}
                      className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLanguage}
                  className="px-3 py-1 text-sm text-green-400 hover:text-green-300 transition-colors"
                >
                  + Add Language
                </button>
              </div>
            </div>
          </div>
          
          {/* Social Media */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Social Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Instagram
                </label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  TikTok
                </label>
                <input
                  type="text"
                  value={formData.tiktok}
                  onChange={(e) => setFormData(prev => ({ ...prev, tiktok: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  YouTube
                </label>
                <input
                  type="text"
                  value={formData.youtube}
                  onChange={(e) => setFormData(prev => ({ ...prev, youtube: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="https://youtube.com/@channel"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>
          
          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-green-100 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-green-500 text-green-300 rounded hover:bg-green-900/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 