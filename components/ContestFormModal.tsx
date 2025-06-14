import React, { useState } from 'react'
import { Contest, ContestSponsor, DEFAULT_PRIZE_DISTRIBUTIONS, PrizeTier, generatePokerDistribution } from '@/lib/types/contest'
import type { Project } from '@/lib/project'

interface ContestFormModalProps {
  isEditMode: boolean
  formData: {
    name: string
    description: string
    startTime: string
    endTime: string
    imageUrl: string
    sponsors: ContestSponsor[]
    sentimentTags: string[]
    prizePool: number
    prizeDistribution: {
      type: 'default' | 'custom'
      tiers: PrizeTier[]
    }
    status: Contest['status']
    visibility: Contest['visibility']
  }
  setFormData: React.Dispatch<React.SetStateAction<ContestFormModalProps['formData']>>
  projects: Project[]
  searchSponsor: string
  setSearchSponsor: React.Dispatch<React.SetStateAction<string>>
  showSponsorDropdown: boolean
  setShowSponsorDropdown: React.Dispatch<React.SetStateAction<boolean>>
  newTag: string
  setNewTag: React.Dispatch<React.SetStateAction<string>>
  customDistribution: PrizeTier[]
  totalPercentage: number
  onSubmit: () => void
  onCancel: () => void
  onAddSponsor: (project: Project) => void
  onRemoveSponsor: (projectId: string) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  onDistributionChange: (type: 'default' | 'custom') => void
  onCustomTierChange: (index: number, field: 'position' | 'percentage', value: string | number) => void
  onAddCustomTier: () => void
  onRemoveCustomTier: (index: number) => void
}

export default function ContestFormModal({
  isEditMode,
  formData,
  setFormData,
  projects,
  searchSponsor,
  setSearchSponsor,
  showSponsorDropdown,
  setShowSponsorDropdown,
  newTag,
  setNewTag,
  customDistribution,
  totalPercentage,
  onSubmit,
  onCancel,
  onAddSponsor,
  onRemoveSponsor,
  onAddTag,
  onRemoveTag,
  onDistributionChange,
  onCustomTierChange,
  onAddCustomTier,
  onRemoveCustomTier,
}: ContestFormModalProps) {
  const [pokerWinners, setPokerWinners] = useState(() => {
    // Initialize based on current distribution if it's not standard
    const len = formData.prizeDistribution.tiers.length
    if (len !== 3 && len !== 5 && len !== 10) {
      return len
    }
    return 10
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-black border-2 border-green-400 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditMode ? 'Edit Contest' : 'Create New Contest'}
          </h2>
          <button
            onClick={onCancel}
            className="text-green-300 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-sm mb-1">Contest Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-black border border-green-300 p-2"
              placeholder="Enter contest name"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-black border border-green-300 p-2"
              rows={3}
              placeholder="Enter contest description"
            />
          </div>

          {/* Time Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-black border border-green-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End Time</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-black border border-green-300 p-2"
              />
            </div>
          </div>

          {/* Contest Image */}
          <div>
            <label className="block text-sm mb-1">Contest Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                
                // Show preview immediately
                const reader = new FileReader()
                reader.onload = (e) => {
                  setFormData({ ...formData, imageUrl: e.target?.result as string })
                }
                reader.readAsDataURL(file)
                
                // Upload file
                try {
                  const formData = new FormData()
                  formData.append('file', file)
                  
                  const response = await fetch('/api/upload/contest-image', {
                    method: 'POST',
                    body: formData
                  })
                  
                  if (!response.ok) {
                    const error = await response.json()
                    throw new Error(error.error || 'Upload failed')
                  }
                  
                  const { imageUrl } = await response.json()
                  setFormData(prev => ({ ...prev, imageUrl }))
                } catch (error) {
                  console.error('Error uploading image:', error)
                  alert('Failed to upload image: ' + (error as any).message)
                }
              }}
              className="w-full bg-black border border-green-300 p-2"
            />
            {formData.imageUrl && (
              <div className="mt-2 w-32 h-32 border border-green-400 overflow-hidden">
                <img
                  src={formData.imageUrl}
                  alt="Contest preview"
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>

          {/* Sponsors */}
          <div>
            <label className="block text-sm mb-1">Sponsors</label>
            <div className="relative">
              <input
                type="text"
                value={searchSponsor}
                onChange={(e) => setSearchSponsor(e.target.value)}
                onFocus={() => setShowSponsorDropdown(true)}
                onBlur={() => setTimeout(() => setShowSponsorDropdown(false), 200)}
                placeholder="Search projects to add as sponsors..."
                className="w-full bg-black border border-green-300 p-2"
              />
              {showSponsorDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-black border border-green-300 max-h-40 overflow-y-auto">
                  {projects.length === 0 ? (
                    <div className="p-2 text-center text-sm opacity-70">
                      No projects available
                    </div>
                  ) : (
                    projects.map(project => (
                      <div
                        key={project.id}
                        className="p-2 hover:bg-green-900 cursor-pointer flex items-center gap-2"
                        onClick={() => onAddSponsor(project)}
                      >
                        {project.profileImageUrl && (
                          <img
                            src={project.profileImageUrl}
                            alt={project.twitterHandle}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span>{project.twitterHandle}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Selected Sponsors */}
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.sponsors.map(sponsor => (
                <div key={sponsor.projectId} className="flex items-center gap-1 bg-green-900/30 px-2 py-1 rounded">
                  {sponsor.imageUrl && (
                    <img
                      src={sponsor.imageUrl}
                      alt={sponsor.name}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span className="text-sm">{sponsor.twitterHandle}</span>
                  <button
                    onClick={() => onRemoveSponsor(sponsor.projectId)}
                    className="ml-1 text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Tags */}
          <div>
            <label className="block text-sm mb-1">Sentiment Tags (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onAddTag()}
                className="flex-1 bg-black border border-green-300 p-2"
                placeholder="Add a tag..."
              />
              <button
                onClick={onAddTag}
                className="px-4 py-2 border border-green-400 hover:bg-green-900/30"
              >
                Add
              </button>
            </div>
            
            {/* Tags List */}
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.sentimentTags.map(tag => (
                <span key={tag} className="bg-blue-900/30 px-2 py-1 rounded text-sm">
                  {tag}
                  <button
                    onClick={() => onRemoveTag(tag)}
                    className="ml-2 text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Prize Pool */}
          <div>
            <label className="block text-sm mb-1">Prize Pool ($)</label>
            <input
              type="number"
              value={formData.prizePool}
              onChange={(e) => setFormData({ ...formData, prizePool: Number(e.target.value) })}
              className="w-full bg-black border border-green-300 p-2"
              placeholder="Enter prize pool amount"
            />
          </div>

          {/* Prize Distribution */}
          <div>
            <label className="block text-sm mb-1">Prize Distribution</label>
            <div className="mb-2">
              <label className="inline-flex items-center mr-4">
                <input
                  type="radio"
                  checked={formData.prizeDistribution.type === 'default'}
                  onChange={() => onDistributionChange('default')}
                  className="mr-2"
                />
                Default Distribution
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={formData.prizeDistribution.type === 'custom'}
                  onChange={() => onDistributionChange('custom')}
                  className="mr-2"
                />
                Custom Distribution
              </label>
            </div>

            {formData.prizeDistribution.type === 'default' && (
              <div className="space-y-2">
                <select
                  value={(() => {
                    const len = formData.prizeDistribution.tiers.length
                    if (len === 3 && JSON.stringify(formData.prizeDistribution.tiers) === JSON.stringify(DEFAULT_PRIZE_DISTRIBUTIONS.top3.tiers)) return 'top3'
                    if (len === 5 && JSON.stringify(formData.prizeDistribution.tiers) === JSON.stringify(DEFAULT_PRIZE_DISTRIBUTIONS.top5.tiers)) return 'top5'
                    if (len === 10 && JSON.stringify(formData.prizeDistribution.tiers) === JSON.stringify(DEFAULT_PRIZE_DISTRIBUTIONS.top10.tiers)) return 'top10'
                    return 'poker'
                  })()}
                  onChange={(e) => {
                    if (e.target.value === 'poker') {
                      setFormData({
                        ...formData,
                        prizeDistribution: {
                          type: 'default',
                          tiers: generatePokerDistribution(pokerWinners)
                        }
                      })
                    } else {
                      const key = e.target.value as keyof typeof DEFAULT_PRIZE_DISTRIBUTIONS
                      setFormData({
                        ...formData,
                        prizeDistribution: DEFAULT_PRIZE_DISTRIBUTIONS[key]
                      })
                    }
                  }}
                  className="w-full bg-black border border-green-300 p-2"
                >
                  <option value="top3">Top 3 Winners</option>
                  <option value="top5">Top 5 Winners</option>
                  <option value="top10">Top 10 Winners</option>
                  <option value="poker">Poker Style (Custom Number)</option>
                </select>
                
                {((() => {
                  const len = formData.prizeDistribution.tiers.length
                  if (len === 3 && JSON.stringify(formData.prizeDistribution.tiers) === JSON.stringify(DEFAULT_PRIZE_DISTRIBUTIONS.top3.tiers)) return false
                  if (len === 5 && JSON.stringify(formData.prizeDistribution.tiers) === JSON.stringify(DEFAULT_PRIZE_DISTRIBUTIONS.top5.tiers)) return false
                  if (len === 10 && JSON.stringify(formData.prizeDistribution.tiers) === JSON.stringify(DEFAULT_PRIZE_DISTRIBUTIONS.top10.tiers)) return false
                  return true
                })()) && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Number of Winners:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={pokerWinners}
                      onChange={(e) => {
                        const num = parseInt(e.target.value) || 1
                        setPokerWinners(num)
                        setFormData({
                          ...formData,
                          prizeDistribution: {
                            type: 'default',
                            tiers: generatePokerDistribution(num)
                          }
                        })
                      }}
                      className="w-20 bg-black border border-green-300 p-1 text-sm"
                    />
                  </div>
                )}
                
                {/* Show distribution preview */}
                <div className="border border-green-300/50 p-2 mt-2 max-h-40 overflow-y-auto">
                  <p className="text-xs mb-1 opacity-70">Distribution Preview:</p>
                  {formData.prizeDistribution.tiers.slice(0, 10).map((tier, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span>#{tier.position}:</span>
                      <span>{tier.percentage.toFixed(1)}%</span>
                      <span className="text-green-400">${formData.prizePool ? (formData.prizePool * tier.percentage / 100).toFixed(2) : '0'}</span>
                    </div>
                  ))}
                  {formData.prizeDistribution.tiers.length > 10 && (
                    <div className="text-xs opacity-70 mt-1">...and {formData.prizeDistribution.tiers.length - 10} more</div>
                  )}
                </div>
              </div>
            )}

            {formData.prizeDistribution.type === 'custom' && (
              <div className="space-y-2">
                {customDistribution.map((tier, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={tier.position}
                      onChange={(e) => onCustomTierChange(index, 'position', e.target.value)}
                      className="w-24 bg-black border border-green-300 p-1 text-sm"
                      placeholder="Position"
                    />
                    <input
                      type="number"
                      value={tier.percentage}
                      onChange={(e) => onCustomTierChange(index, 'percentage', e.target.value)}
                      className="w-24 bg-black border border-green-300 p-1 text-sm"
                      placeholder="%"
                    />
                    <span className="text-sm">% = ${formData.prizePool ? ((formData.prizePool * tier.percentage) / 100).toFixed(2) : '0'}</span>
                    <button
                      onClick={() => onRemoveCustomTier(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={onAddCustomTier}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Add Tier
                </button>
                {totalPercentage !== 100 && (
                  <p className="text-red-400 text-sm">
                    Total percentage must equal 100% (currently {totalPercentage}%)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Status & Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Contest['status'] })}
                className="w-full bg-black border border-green-300 p-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value as Contest['visibility'] })}
                className="w-full bg-black border border-green-300 p-2"
              >
                <option value="public">Public</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-green-300">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-400 text-gray-400 hover:bg-gray-900/30"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!formData.name || !formData.startTime || !formData.endTime || !formData.prizePool || totalPercentage !== 100}
              className="px-4 py-2 bg-green-900 text-green-100 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditMode ? 'Update Contest' : 'Create Contest'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 