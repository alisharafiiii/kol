'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { data: session } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    email: '',
    phone: '',
    telegram: '',
    country: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    languages: [] as string[],
    instagram: '',
    youtube: '',
    tiktok: '',
    website: '',
    audienceTypes: [] as string[],
    chains: [] as string[],
    primaryLanguage: '',
  })
  
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)

  useEffect(() => {
    if (isOpen && session) {
      loadProfile()
    }
  }, [isOpen, session])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const handle = (session as any)?.twitterHandle || session?.user?.name
      
      // Get the full profile data from Redis
      const fullProfileRes = await fetch(`/api/user/full-profile?handle=${encodeURIComponent(handle)}`)
      if (fullProfileRes.ok) {
        const fullProfile = await fullProfileRes.json()
        
        setProfileData(fullProfile)
        
        // Initialize form with existing data
                  setFormData({
            name: fullProfile.name || '',
            bio: fullProfile.bio || '',
            email: fullProfile.email || '',
            phone: fullProfile.phone || '',
            telegram: fullProfile.socialAccounts?.telegram?.handle || '',
            country: fullProfile.country || '',
            city: fullProfile.city || '',
            addressLine1: fullProfile.shippingAddress?.addressLine1 || '',
            addressLine2: fullProfile.shippingAddress?.addressLine2 || '',
            postalCode: fullProfile.shippingAddress?.postalCode || '',
            languages: fullProfile.languages || [],
            instagram: fullProfile.socialAccounts?.instagram?.handle || '',
            youtube: fullProfile.socialAccounts?.youtube?.handle || '',
            tiktok: fullProfile.socialAccounts?.tiktok?.handle || '',
            website: fullProfile.website || '',
            audienceTypes: fullProfile.audienceTypes || [],
            chains: fullProfile.chains || [],
            primaryLanguage: fullProfile.primaryLanguage || '',
          })
      } else {
        // Fallback to basic profile
        const userRes = await fetch(`/api/user/profile?handle=${encodeURIComponent(handle)}`)
        if (userRes.ok) {
          const userData = await userRes.json()
          setProfileData(userData.user)
          
          setFormData({
            name: userData.user.name || '',
            bio: '',
            email: '',
            phone: '',
            telegram: '',
            country: '',
            city: '',
            addressLine1: '',
            addressLine2: '',
            postalCode: '',
            languages: [],
            instagram: '',
            youtube: '',
            tiktok: '',
            website: '',
            audienceTypes: [],
            chains: [],
            primaryLanguage: '',
          })
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const handle = (session as any)?.twitterHandle || session?.user?.name
      
      const updateData = {
        name: formData.name,
        bio: formData.bio,
        email: formData.email,
        phone: formData.phone,
        country: formData.country,
        city: formData.city,
        shippingAddress: {
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        languages: formData.languages.filter(Boolean),
        primaryLanguage: formData.primaryLanguage,
        audienceTypes: formData.audienceTypes.filter(Boolean),
        chains: formData.chains.filter(Boolean),
        socialAccounts: {
          ...(profileData?.socialAccounts || {}),
          telegram: formData.telegram ? { handle: formData.telegram, followers: profileData?.socialAccounts?.telegram?.followers || 0 } : undefined,
          instagram: formData.instagram ? { handle: formData.instagram, followers: profileData?.socialAccounts?.instagram?.followers || 0 } : undefined,
          youtube: formData.youtube ? { handle: formData.youtube, subscribers: profileData?.socialAccounts?.youtube?.subscribers || 0 } : undefined,
          tiktok: formData.tiktok ? { handle: formData.tiktok, followers: profileData?.socialAccounts?.tiktok?.followers || 0 } : undefined,
        },
        website: formData.website,
      }
      
      const res = await fetch(`/api/user/full-profile?handle=${encodeURIComponent(handle)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      
      if (res.ok) {
        const updatedProfile = await res.json()
        setProfileData(updatedProfile)
        setIsEditing(false)
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const addLanguage = () => {
    setFormData(prev => ({ ...prev, languages: [...prev.languages, ''] }))
  }

  const updateLanguage = (index: number, value: string) => {
    const newLanguages = [...formData.languages]
    newLanguages[index] = value
    setFormData(prev => ({ ...prev, languages: newLanguages }))
  }

  const removeLanguage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index)
    }))
  }

  // Address autocomplete functionality
  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, addressLine1: value }))
    
    // Simulate address suggestions (in production, use a real geocoding API)
    if (value.length > 2) {
      const mockSuggestions = [
        `${value} Street, New York, NY 10001`,
        `${value} Avenue, Los Angeles, CA 90001`,
        `${value} Road, Chicago, IL 60601`,
        `${value} Boulevard, Houston, TX 77001`,
        `${value} Lane, Phoenix, AZ 85001`,
      ].filter(s => s.toLowerCase().includes(value.toLowerCase()))
      
      setAddressSuggestions(mockSuggestions)
      setShowAddressSuggestions(true)
    } else {
      setShowAddressSuggestions(false)
    }
  }
  
  const selectAddressSuggestion = (suggestion: string) => {
    const parts = suggestion.split(', ')
    setFormData(prev => ({
      ...prev,
      addressLine1: parts[0] || '',
      city: parts[1] || prev.city,
      postalCode: parts[2]?.split(' ')[1] || prev.postalCode,
    }))
    setShowAddressSuggestions(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-black border-2 border-green-300 p-4 sm:p-6 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-green-300 flex items-center gap-2">
            <span className="text-2xl">▶</span>
            Profile Information
          </h2>
          <button
            onClick={onClose}
            className="text-green-300 hover:text-green-100 transition-colors"
          >
            <span className="text-2xl">✕</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-green-300">
            <div className="animate-pulse">Loading profile...</div>
          </div>
        ) : (
          <div className="space-y-6 text-green-300">
            {/* Profile Header */}
            <div className="flex items-start gap-4 pb-6 border-b border-green-800">
              <img
                src={profileData?.profileImageUrl?.replace('_normal', '_400x400') || session?.user?.image?.replace('_normal', '_400x400') || `https://unavatar.io/twitter/${session?.user?.name}`}
                alt="Profile"
                className="w-20 h-20 rounded-full border-2 border-green-500"
              />
              <div className="flex-1">
                <h3 className="text-lg font-bold">{profileData?.name || session?.user?.name}</h3>
                <p className="text-green-400">@{profileData?.twitterHandle || (session as any)?.twitterHandle || session?.user?.name}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className={`px-2 py-1 rounded ${
                    profileData?.role === 'admin' ? 'bg-purple-900 text-purple-300' :
                    profileData?.role === 'core' ? 'bg-blue-900 text-blue-300' :
                    'bg-green-900 text-green-300'
                  }`}>
                    {profileData?.role?.toUpperCase() || 'USER'}
                  </span>
                  <span className={`px-2 py-1 rounded ${
                    profileData?.approvalStatus === 'approved' ? 'bg-green-900 text-green-300' :
                    profileData?.approvalStatus === 'rejected' ? 'bg-red-900 text-red-300' :
                    'bg-yellow-900 text-yellow-300'
                  }`}>
                    {profileData?.approvalStatus?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 border border-green-300 hover:bg-green-900 transition-colors flex items-center gap-2"
                >
                  <span className="text-sm">✏</span>
                  Edit
                </button>
              )}
            </div>

            {/* Profile Content */}
            {isEditing ? (
              <>
                {/* Edit Mode */}
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-3">Basic Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs mb-1">Display Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Bio</label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-3">Contact Information</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Phone</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+1 234 567 8900"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Telegram</label>
                        <input
                          type="text"
                          value={formData.telegram}
                          onChange={(e) => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                          placeholder="@username"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address & Location */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-3">Address & Location</h4>
                    <div className="space-y-3">
                      <div className="relative address-autocomplete">
                        <label className="block text-xs mb-1">Address Line 1</label>
                        <input
                          type="text"
                          value={formData.addressLine1}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          onFocus={() => formData.addressLine1.length > 2 && setShowAddressSuggestions(true)}
                          placeholder="123 Main Street"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                        {showAddressSuggestions && addressSuggestions.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-black border border-green-500 max-h-40 overflow-y-auto">
                            {addressSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selectAddressSuggestion(suggestion)}
                                className="w-full px-3 py-2 text-left text-green-300 hover:bg-green-900 hover:text-green-100 text-sm border-b border-green-800 last:border-b-0"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Address Line 2</label>
                        <input
                          type="text"
                          value={formData.addressLine2}
                          onChange={(e) => setFormData(prev => ({ ...prev, addressLine2: e.target.value }))}
                          placeholder="Apt, Suite, Floor (optional)"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs mb-1">City</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Postal Code</label>
                          <input
                            type="text"
                            value={formData.postalCode}
                            onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                            className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Country</label>
                          <input
                            type="text"
                            value={formData.country}
                            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                            className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-3">Languages</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs mb-1">Primary Language</label>
                        <input
                          type="text"
                          value={formData.primaryLanguage}
                          onChange={(e) => setFormData(prev => ({ ...prev, primaryLanguage: e.target.value }))}
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Additional Languages</label>
                        <div className="space-y-2">
                          {formData.languages.map((lang, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={lang}
                                onChange={(e) => updateLanguage(index, e.target.value)}
                                className="flex-1 px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                              />
                              <button
                                onClick={() => removeLanguage(index)}
                                className="px-3 py-2 text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addLanguage}
                            className="text-xs text-green-400 hover:text-green-300"
                          >
                            + Add Language
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Social Media */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-3">Social Media</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Instagram</label>
                        <input
                          type="text"
                          value={formData.instagram}
                          onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                          placeholder="@username"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">TikTok</label>
                        <input
                          type="text"
                          value={formData.tiktok}
                          onChange={(e) => setFormData(prev => ({ ...prev, tiktok: e.target.value }))}
                          placeholder="@username"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">YouTube</label>
                        <input
                          type="text"
                          value={formData.youtube}
                          onChange={(e) => setFormData(prev => ({ ...prev, youtube: e.target.value }))}
                          placeholder="Channel URL"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Website</label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                          placeholder="https://"
                          className="w-full px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Campaign Fit Data */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-3">Campaign Fit</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs mb-1">Audience Types</label>
                        <div className="space-y-2">
                          {formData.audienceTypes.map((audience, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={audience}
                                onChange={(e) => {
                                  const newAudiences = [...formData.audienceTypes]
                                  newAudiences[index] = e.target.value
                                  setFormData(prev => ({ ...prev, audienceTypes: newAudiences }))
                                }}
                                placeholder="e.g. NFT Collectors, Traders"
                                className="flex-1 px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                              />
                              <button
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    audienceTypes: prev.audienceTypes.filter((_, i) => i !== index)
                                  }))
                                }}
                                className="px-3 py-2 text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, audienceTypes: [...prev.audienceTypes, ''] }))}
                            className="text-xs text-green-400 hover:text-green-300"
                          >
                            + Add Audience Type
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Active Chains</label>
                        <div className="space-y-2">
                          {formData.chains.map((chain, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={chain}
                                onChange={(e) => {
                                  const newChains = [...formData.chains]
                                  newChains[index] = e.target.value
                                  setFormData(prev => ({ ...prev, chains: newChains }))
                                }}
                                placeholder="e.g. Ethereum, Base, Solana"
                                className="flex-1 px-3 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400"
                              />
                              <button
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    chains: prev.chains.filter((_, i) => i !== index)
                                  }))
                                }}
                                className="px-3 py-2 text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, chains: [...prev.chains, ''] }))}
                            className="text-xs text-green-400 hover:text-green-300"
                          >
                            + Add Chain
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-6 border-t border-green-800">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-green-900 text-green-100 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-green-100 border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="text-sm">💾</span>
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-green-300 hover:bg-green-900 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* View Mode */}
                <div className="space-y-4">
                  {/* Bio */}
                  {profileData?.bio && (
                    <div>
                      <h4 className="text-sm font-bold uppercase mb-2">Bio</h4>
                      <p className="text-green-300">{profileData.bio}</p>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div>
                    <h4 className="text-sm font-bold uppercase mb-2">Contact</h4>
                    <div className="space-y-1 text-sm">
                      {profileData?.email && (
                        <div><span className="text-green-500">Email:</span> {profileData.email}</div>
                      )}
                      {profileData?.phone && (
                        <div><span className="text-green-500">Phone:</span> {profileData.phone}</div>
                      )}
                      {profileData?.socialAccounts?.telegram?.handle && (
                        <div><span className="text-green-500">Telegram:</span> @{profileData.socialAccounts.telegram.handle}</div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  {(profileData?.shippingAddress?.addressLine1 || profileData?.shippingAddress?.addressLine2 || profileData?.shippingAddress?.postalCode) && (
                    <div>
                      <h4 className="text-sm font-bold uppercase mb-2">Address</h4>
                      <div className="text-sm">
                        {profileData.shippingAddress.addressLine1 && (
                          <div>{profileData.shippingAddress.addressLine1}</div>
                        )}
                        {profileData.shippingAddress.addressLine2 && (
                          <div>{profileData.shippingAddress.addressLine2}</div>
                        )}
                        {(profileData.shippingAddress.city || profileData.shippingAddress.postalCode || profileData.shippingAddress.country) && (
                          <div>
                            {profileData.shippingAddress.city && `${profileData.shippingAddress.city}, `}
                            {profileData.shippingAddress.postalCode && `${profileData.shippingAddress.postalCode} `}
                            {profileData.shippingAddress.country}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {(profileData?.country || profileData?.city) && (
                    <div>
                      <h4 className="text-sm font-bold uppercase mb-2">Location</h4>
                      <p className="text-sm">
                        {profileData.city && `${profileData.city}, `}{profileData.country}
                      </p>
                    </div>
                  )}

                  {/* Languages */}
                  {(profileData?.primaryLanguage || (profileData?.languages && profileData.languages.length > 0)) && (
                    <div>
                      <h4 className="text-sm font-bold uppercase mb-2">Languages</h4>
                      <div className="text-sm">
                        {profileData.primaryLanguage && (
                          <div><span className="text-green-500">Primary:</span> {profileData.primaryLanguage}</div>
                        )}
                        {profileData.languages && profileData.languages.length > 0 && (
                          <div><span className="text-green-500">Others:</span> {profileData.languages.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Social Media */}
                  {profileData?.socialAccounts && Object.keys(profileData.socialAccounts).length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold uppercase mb-2">Social Media</h4>
                      <div className="space-y-1 text-sm">
                        {profileData.socialAccounts.twitter && (
                          <div><span className="text-green-500">Twitter:</span> @{profileData.socialAccounts.twitter.handle} ({profileData.socialAccounts.twitter.followers} followers)</div>
                        )}
                        {profileData.socialAccounts.instagram && (
                          <div><span className="text-green-500">Instagram:</span> @{profileData.socialAccounts.instagram.handle} ({profileData.socialAccounts.instagram.followers} followers)</div>
                        )}
                        {profileData.socialAccounts.tiktok && (
                          <div><span className="text-green-500">TikTok:</span> @{profileData.socialAccounts.tiktok.handle} ({profileData.socialAccounts.tiktok.followers} followers)</div>
                        )}
                        {profileData.socialAccounts.youtube && (
                          <div><span className="text-green-500">YouTube:</span> {profileData.socialAccounts.youtube.handle} ({profileData.socialAccounts.youtube.subscribers} subscribers)</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Campaign Fit Data */}
                  {(profileData?.audienceTypes || profileData?.chains || profileData?.followerCount) && (
                    <div>
                      <h4 className="text-sm font-bold uppercase mb-2">Campaign Fit</h4>
                      <div className="space-y-1 text-sm">
                        {profileData.audienceTypes && profileData.audienceTypes.length > 0 && (
                          <div><span className="text-green-500">Audiences:</span> {profileData.audienceTypes.join(', ')}</div>
                        )}
                        {profileData.chains && profileData.chains.length > 0 && (
                          <div><span className="text-green-500">Chains:</span> {profileData.chains.join(', ')}</div>
                        )}
                        {profileData.followerCount && (
                          <div><span className="text-green-500">Total Followers:</span> {profileData.followerCount.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 