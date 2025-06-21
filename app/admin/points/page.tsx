'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
// Using native alerts to maintain consistency with existing codebase

interface PointAction {
  id: string
  name: string
  description: string
  basePoints: number
  category: string
}

interface Tier {
  id: string
  name: string
  minPoints: number
  maxPoints: number
  multiplier: number
  color: string
}

interface Scenario {
  id: string
  tier: string
  action: string
  points: number
  multiplier: number
}

interface PointsConfig {
  actions: PointAction[]
  tiers: Tier[]
  scenarios: Scenario[]
}

export default function PointsManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pointsConfig, setPointsConfig] = useState<PointsConfig>({
    actions: [],
    tiers: [],
    scenarios: []
  })
  const [activeTab, setActiveTab] = useState<'actions' | 'tiers' | 'scenarios'>('actions')

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || !['admin', 'master'].includes((session as any).role)) {
      router.push('/admin')
    }
  }, [session, status, router])

  // Load points configuration
  useEffect(() => {
    loadPointsConfig()
  }, [])

  const loadPointsConfig = async () => {
    try {
      const response = await fetch('/api/admin/points/config')
      if (!response.ok) throw new Error('Failed to load configuration')
      
      const data = await response.json()
      setPointsConfig(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading points config:', error)
      alert('Failed to load points configuration')
      setLoading(false)
    }
  }

  const savePointsConfig = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/points/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pointsConfig)
      })

      if (!response.ok) throw new Error('Failed to save configuration')
      
      alert('Points configuration saved successfully')
    } catch (error) {
      console.error('Error saving points config:', error)
      alert('Failed to save points configuration')
    } finally {
      setSaving(false)
    }
  }

  // Action handlers
  const updateAction = (index: number, field: keyof PointAction, value: any) => {
    const newActions = [...pointsConfig.actions]
    newActions[index] = { ...newActions[index], [field]: value }
    setPointsConfig({ ...pointsConfig, actions: newActions })
  }

  const addAction = () => {
    const newAction: PointAction = {
      id: `action_${Date.now()}`,
      name: 'New Action',
      description: '',
      basePoints: 0,
      category: 'engagement'
    }
    setPointsConfig({ ...pointsConfig, actions: [...pointsConfig.actions, newAction] })
  }

  const removeAction = (index: number) => {
    const newActions = pointsConfig.actions.filter((_, i) => i !== index)
    setPointsConfig({ ...pointsConfig, actions: newActions })
  }

  // Tier handlers
  const updateTier = (index: number, field: keyof Tier, value: any) => {
    const newTiers = [...pointsConfig.tiers]
    newTiers[index] = { ...newTiers[index], [field]: value }
    setPointsConfig({ ...pointsConfig, tiers: newTiers })
  }

  const addTier = () => {
    const newTier: Tier = {
      id: `tier_${Date.now()}`,
      name: 'New Tier',
      minPoints: 0,
      maxPoints: 100,
      multiplier: 1.0,
      color: '#3B82F6'
    }
    setPointsConfig({ ...pointsConfig, tiers: [...pointsConfig.tiers, newTier] })
  }

  const removeTier = (index: number) => {
    const newTiers = pointsConfig.tiers.filter((_, i) => i !== index)
    setPointsConfig({ ...pointsConfig, tiers: newTiers })
  }

  // Scenario handlers
  const updateScenario = (index: number, field: keyof Scenario, value: any) => {
    const newScenarios = [...pointsConfig.scenarios]
    newScenarios[index] = { ...newScenarios[index], [field]: value }
    setPointsConfig({ ...pointsConfig, scenarios: newScenarios })
  }

  const addScenario = () => {
    const newScenario: Scenario = {
      id: `scenario_${Date.now()}`,
      tier: pointsConfig.tiers[0]?.id || '',
      action: pointsConfig.actions[0]?.id || '',
      points: 0,
      multiplier: 1.0
    }
    setPointsConfig({ ...pointsConfig, scenarios: [...pointsConfig.scenarios, newScenario] })
  }

  const removeScenario = (index: number) => {
    const newScenarios = pointsConfig.scenarios.filter((_, i) => i !== index)
    setPointsConfig({ ...pointsConfig, scenarios: newScenarios })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Points Management</h1>
        <button
          onClick={savePointsConfig}
          disabled={saving}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'actions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Point Actions
          </button>
          <button
            onClick={() => setActiveTab('tiers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tiers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tiers & Multipliers
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scenarios'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Scenarios
          </button>
        </nav>
      </div>

      {/* Actions Tab */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Point Actions</h2>
            <button
              onClick={addAction}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add Action
            </button>
          </div>
          
          {pointsConfig.actions.map((action, index) => (
            <div key={action.id} className="bg-white p-4 rounded-lg shadow space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action Name
                  </label>
                  <input
                    type="text"
                    value={action.name}
                    onChange={(e) => updateAction(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={action.category}
                    onChange={(e) => updateAction(index, 'category', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="engagement">Engagement</option>
                    <option value="social">Social</option>
                    <option value="content">Content</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={action.description}
                  onChange={(e) => updateAction(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">
                    Base Points:
                  </label>
                  <input
                    type="number"
                    value={action.basePoints}
                    onChange={(e) => updateAction(index, 'basePoints', parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border rounded-md"
                  />
                </div>
                <button
                  onClick={() => removeAction(index)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tiers Tab */}
      {activeTab === 'tiers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Tiers & Multipliers</h2>
            <button
              onClick={addTier}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add Tier
            </button>
          </div>
          
          {pointsConfig.tiers.map((tier, index) => (
            <div key={tier.id} className="bg-white p-4 rounded-lg shadow space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tier Name
                  </label>
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => updateTier(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Points
                  </label>
                  <input
                    type="number"
                    value={tier.minPoints}
                    onChange={(e) => updateTier(index, 'minPoints', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Points
                  </label>
                  <input
                    type="number"
                    value={tier.maxPoints}
                    onChange={(e) => updateTier(index, 'maxPoints', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">
                      Multiplier:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tier.multiplier}
                      onChange={(e) => updateTier(index, 'multiplier', parseFloat(e.target.value) || 1.0)}
                      className="w-24 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">
                      Color:
                    </label>
                    <input
                      type="color"
                      value={tier.color}
                      onChange={(e) => updateTier(index, 'color', e.target.value)}
                      className="w-12 h-8 border rounded"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeTier(index)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Scenarios</h2>
            <button
              onClick={addScenario}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add Scenario
            </button>
          </div>
          
          {pointsConfig.scenarios.map((scenario, index) => (
            <div key={scenario.id} className="bg-white p-4 rounded-lg shadow space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tier
                  </label>
                  <select
                    value={scenario.tier}
                    onChange={(e) => updateScenario(index, 'tier', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select Tier</option>
                    {pointsConfig.tiers.map(tier => (
                      <option key={tier.id} value={tier.id}>{tier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action
                  </label>
                  <select
                    value={scenario.action}
                    onChange={(e) => updateScenario(index, 'action', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select Action</option>
                    {pointsConfig.actions.map(action => (
                      <option key={action.id} value={action.id}>{action.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">
                      Points:
                    </label>
                    <input
                      type="number"
                      value={scenario.points}
                      onChange={(e) => updateScenario(index, 'points', parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">
                      Multiplier:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={scenario.multiplier}
                      onChange={(e) => updateScenario(index, 'multiplier', parseFloat(e.target.value) || 1.0)}
                      className="w-24 px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeScenario(index)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 