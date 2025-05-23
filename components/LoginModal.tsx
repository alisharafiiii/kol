'use client'
import React, { useState, useRef, useMemo, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { getNames, getCode } from 'country-list'
import { useRouter } from 'next/navigation'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { identifyUser } from "@/lib/user-identity"

// Define custom types for wallet interfaces
interface PhantomProvider {
  solana?: {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
  }
}

interface MetaMaskProvider {
  isMetaMask?: boolean;
  request: (args: { method: string, params?: any[] }) => Promise<any>;
}

// Declare external interface for window.ethereum
declare interface Window {
  ethereum?: any;
  phantom?: any;
}

const allCountries = getNames()
const audienceOptions = [
  'NFT Collectors',
  'DeFi Users',
  'Crypto Traders',
  'Blockchain Developers',
  'Gaming Community',
  'Art Collectors'
]

const chainOptions = [
  'Ethereum',
  'Solana',
  'Base',
  'Bitcoin',
  'TON',
  'Sui',
  'Polkadot',
  'Doge',
  'Sei',
  'Avalanche'
]

const contentTypeOptions = [
  'thread',
  'vids',
  'space',
  'stream'
]

const socialPlatforms = [
  { name: 'Instagram', urlTemplate: 'https://instagram.com/{handle}' },
  { name: 'YouTube', urlTemplate: 'https://youtube.com/@{handle}' },
  { name: 'TikTok', urlTemplate: 'https://tiktok.com/@{handle}' },
  { name: 'Discord', urlTemplate: '{handle}' },
  { name: 'LinkedIn', urlTemplate: 'https://linkedin.com/in/{handle}' },
  { name: 'Twitch', urlTemplate: 'https://twitch.tv/{handle}' },
  { name: 'Telegram', urlTemplate: 'https://t.me/{handle}' }
]

// Admin wallet addresses
const ADMIN_WALLET_ETH = '0x37Ed24e7c7311836FD01702A882937138688c1A9'
const ADMIN_WALLET_SOLANA_1 = 'D1ZuvAKwpk6NQwJvFcbPvjujRByA6Kjk967WCwEt17Tq'
const ADMIN_WALLET_SOLANA_2 = 'Eo5EKS2emxMNggKQJcq7LYwWjabrj3zvpG5rHAdmtZ75'
const ADMIN_WALLET_SOLANA_3 = '6tcxFg4RGVmfuy7MgeUQ5qbFsLPF18PnGMsQnvwG4Xif'

// Helper to get country code
const getCountryCode = (country: string) => getCode(country)?.toLowerCase() || ''

export default function LoginModal() {
  const { data: session } = useSession()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [stage, setStage] = useState<'hidden'|'choice'|'enter'|'apply'|'social'|'wallet'|'preview'|'success'>('hidden')
  const router = useRouter()
  const taps = useRef(0)
  const timer = useRef<number>()
  
  // Connected wallets state
  const [connectedWallets, setConnectedWallets] = useState<{
    coinbase: boolean;
    phantom: boolean;
    metamask: boolean;
    addresses: {coinbase?: string; phantom?: string; metamask?: string};
  }>({
    coinbase: false,
    phantom: false,
    metamask: false,
    addresses: {}
  })

  // Update wallet state when Wagmi account changes
  useEffect(() => {
    if (isConnected && address) {
      // Only update Coinbase if we're connecting via Wagmi and no MetaMask connection exists
      console.log('Wagmi connection detected:', { address, isConnected });
      
      // Force normalize the address for comparison
      const normalizedAddress = address.toLowerCase();
      console.log('Wagmi normalized address:', normalizedAddress);
      
      // Check if this address is already connected as MetaMask (using case-insensitive comparison)
      // If it is, don't mark it as Coinbase as well
      if (connectedWallets.metamask && 
          connectedWallets.addresses.metamask &&
          connectedWallets.addresses.metamask.toLowerCase() === normalizedAddress) {
        console.log('Address already connected as MetaMask, not setting as Coinbase');
        return;
      }
      
      // When a wallet is connected via Wagmi, update our internal state for Coinbase only
      console.log('Updating Coinbase wallet state with address:', address);
      setConnectedWallets(prev => ({
        ...prev,
        // Only set Coinbase to true, not MetaMask
        coinbase: true,
        addresses: {
          ...prev.addresses,
          coinbase: address // Preserve original case for display
        }
      }));
    } else if (!isConnected) {
      // If disconnected, clear the coinbase wallet only
      console.log('Wagmi disconnected, clearing Coinbase wallet state');
      setConnectedWallets(prev => ({
        ...prev,
        coinbase: false,
        addresses: {
          ...prev.addresses,
          coinbase: undefined
        }
      }));
    }
  }, [isConnected, address, connectedWallets.metamask, connectedWallets.addresses.metamask]);

  // Step 1 - Campaign Fit state
  const [countrySearch, setCountrySearch] = useState('')
  const [audienceCountries, setAudienceCountries] = useState<string[]>([])
  const [audiences, setAudiences] = useState<string[]>([])
  const [chains, setChains] = useState<string[]>([])
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [pricePerPost, setPricePerPost] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [collabUrls, setCollabUrls] = useState(['', '', ''])
  
  // Step 2 - Social Platforms state
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null)
  const [socialProfiles, setSocialProfiles] = useState<Record<string, { handle: string, followers: string }>>(
    Object.fromEntries(socialPlatforms.map(platform => [platform.name, { handle: '', followers: '' }]))
  )
  
  // Preview state
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredCountries = useMemo(
    () => allCountries.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())),
    [countrySearch]
  )

  // Replace with this much simpler approach
  if (typeof window !== 'undefined') {
    (window as any).openLogin = function() {
      setStage('choice')
    }
  }

  // Check if the user is logged in with Twitter/X
  const isLoggedIn = !!session?.user;
  
  // Show license view by default if logged in
  useEffect(() => {
    // Don't automatically show anything on load
    // Let the triple-click mechanism handle showing the modal
  }, [isLoggedIn, stage]);

  // Keep handleTripleTap, but remove the global assignment
  const handleTripleTap = () => {
    taps.current++
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => (taps.current = 0), 500)
    if (taps.current === 3) {
      // Show choice screen on triple tap
      setStage('choice')
    }
  }
  
  // Make sure close button works properly
  const handleClose = () => {
    // Fully hide the modal
    setStage('hidden')
    // Reset any internal state as needed
    taps.current = 0
    if (timer.current) {
      clearTimeout(timer.current)
    }
  }

  const addCollabUrl = () => {
    setCollabUrls([...collabUrls, ''])
  }

  const updateCollabUrl = (index: number, value: string) => {
    const newUrls = [...collabUrls]
    newUrls[index] = value
    setCollabUrls(newUrls)
  }

  const updateSocialProfile = (platform: string, field: 'handle' | 'followers', value: string) => {
    setSocialProfiles(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }))
  }

  const togglePlatform = (platform: string) => {
    setExpandedPlatform(expandedPlatform === platform ? null : platform)
  }

  const getSocialUrl = (platform: string, handle: string) => {
    const platformInfo = socialPlatforms.find(p => p.name === platform)
    if (!platformInfo || !handle) return ''
    return platformInfo.urlTemplate.replace('{handle}', handle)
  }

  // Check if admin wallet is connected
  const isAdminWallet = 
    connectedWallets.coinbase && connectedWallets.addresses.coinbase === ADMIN_WALLET_ETH ||
    connectedWallets.phantom && (
      connectedWallets.addresses.phantom === ADMIN_WALLET_SOLANA_1 || 
      connectedWallets.addresses.phantom === ADMIN_WALLET_SOLANA_2 ||
      connectedWallets.addresses.phantom === ADMIN_WALLET_SOLANA_3
    ) ||
    connectedWallets.metamask && connectedWallets.addresses.metamask === ADMIN_WALLET_ETH

  // Helper to mask wallet addresses
  const maskAddress = (addr: string) => `${addr.slice(0,4)}...${addr.slice(-4)}`

  // Show/hide country dropdown
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  // Real wallet connection handlers
  const connectCoinbaseWallet = async () => {
    try {
      setWalletConnectionPending(true);
      
      // Try to find the Coinbase Wallet connector, fallback to the first connector
      const connector = connectors.find(c => c.id === 'coinbaseWallet') ?? connectors[0]
      if (!connector) {
        console.error('No wallet connectors available')
        alert('No wallet connectors available. Please install a supported wallet.')
        return
      }
      connect({ connector })
      
      // After successful connection:
      // Use identity management to find or create user
      const walletData = {
        walletAddresses: {
          coinbase: address
        },
        role: "user" as const
      };
      
      await identifyUser(walletData);
      
      // Continue with existing success logic...
      
    } catch (error) {
      console.error('Error connecting Coinbase wallet:', error)
      alert('Failed to connect Coinbase wallet. Please try again.')
    }
  }

  // For Phantom, we need to detect if it's available in the browser
  const connectPhantomWallet = async () => {
    try {
      setWalletConnectionPending(true);
      
      // Check if we're on a mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('Connecting Phantom wallet on:', isMobile ? 'mobile' : 'desktop');
      
      // Try to use Phantom wallet adapter for a consistent experience
      const phantomAdapter = new PhantomWalletAdapter();
      
      // Check if we're on desktop, try browser extension first
      if (!isMobile && typeof window !== 'undefined' && window.phantom?.solana) {
        console.log('Using Phantom browser extension');
        try {
          // Connect to Phantom wallet via extension
          const response = await window.phantom.solana.connect();
          const publicKey = response.publicKey.toString();
          
          console.log('Connected to Phantom extension with public key:', publicKey);
          
          // Update our state with the connected Phantom wallet
          setConnectedWallets(prev => ({
            ...prev,
            phantom: true,
            addresses: {
              ...prev.addresses,
              phantom: publicKey
            }
          }));
          
          // After successful connection:
          // Use identity management to find or create user
          const walletData = {
            walletAddresses: {
              phantom: publicKey
            },
            role: "user" as const
          };
          
          await identifyUser(walletData);
        } catch (error) {
          console.error('Phantom extension connection error:', error);
          throw error;
        }
      } 
      // Otherwise try the adapter approach which works cross-platform
      else {
        console.log('Using Phantom adapter approach');
        // Using adapter
        try {
          // Connect using the adapter
          await phantomAdapter.connect();
          
          if (phantomAdapter.publicKey) {
            const publicKey = phantomAdapter.publicKey.toString();
            console.log('Connected to Phantom with public key:', publicKey);
            
            // Update our state with the connected Phantom wallet
            setConnectedWallets(prev => ({
              ...prev,
              phantom: true,
              addresses: {
                ...prev.addresses,
                phantom: publicKey
              }
            }));
            
            // After successful connection:
            // Use identity management to find or create user
            const walletData = {
              walletAddresses: {
                phantom: publicKey
              },
              role: "user" as const
            };
            
            await identifyUser(walletData);
          }
        } catch (adapterError) {
          console.error('Phantom adapter connection error:', adapterError);
          
          // If adapter doesn't work and we're on mobile, try direct deep linking
          if (isMobile) {
            console.log('Falling back to deep linking for mobile');
            // Get the current URL to use as a redirect
            const currentUrl = window.location.href;
            
            // Encode the return URL - make sure it's the base URL without params
            const baseUrl = window.location.origin + window.location.pathname;
            const encodedUrl = encodeURIComponent(baseUrl);
            
            // Create the deep link to Phantom
            const phantomDeepLink = `https://phantom.app/ul/browse/${encodedUrl}`;
            
            // Save state so we know what we're doing when we come back
            localStorage.setItem('loginStage', 'wallet');
            
            // We need to redirect to the Phantom app
            console.log('Redirecting to Phantom mobile app...');
            window.location.href = phantomDeepLink;
          } else {
            // Re-throw on desktop to be caught by the outer try/catch
            throw adapterError;
          }
        }
      }
    } catch (error) {
      console.error('Phantom wallet connection error:', error);
      
      // Check if we're on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // On mobile, offer to download Phantom
        if (confirm('Phantom wallet connection failed. Would you like to download the Phantom app?')) {
          window.location.href = 'https://phantom.app/download';
        }
      } else {
        // On desktop, prompt to install extension
        alert('Failed to connect Phantom wallet. Please ensure the Phantom extension is installed and unlocked.');
      }
    }
  }

  // For MetaMask, we need to check if the Ethereum provider is available
  const connectMetaMaskWallet = async () => {
    if (typeof window === 'undefined') return;
    
    try {
      console.log('MetaMask connect: Function called, clearing any previous state');
      
      // Force disconnect any existing connections first, including Coinbase
      if (connectedWallets.metamask) {
        console.log('MetaMask connect: Disconnecting existing MetaMask connection first');
        disconnectWallet('metamask');
      }
      
      // If we also have a Coinbase connection, disconnect it too to avoid confusion
      if (connectedWallets.coinbase) {
        console.log('MetaMask connect: Also disconnecting existing Coinbase connection to avoid address conflicts');
        disconnect(); // This uses wagmi to disconnect Coinbase
        
        // Also update our internal state
        setConnectedWallets(prev => ({
          ...prev,
          coinbase: false,
          addresses: {
            ...prev.addresses,
            coinbase: undefined
          }
        }));
        
        // Small delay to ensure state is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Check if Ethereum is available at all
      if (!window.ethereum) {
        console.error('MetaMask connect: No Ethereum provider found');
        alert('No Ethereum provider found. Please install MetaMask or another Ethereum wallet extension.');
        return;
      }
      
      // IMPORTANT: Request accounts in a try/catch to handle rejection properly
      try {
        console.log('MetaMask connect: Requesting accounts from MetaMask provider...');
        
        // Request account access
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts',
          params: [] 
        });
        
        console.log('MetaMask connect: Received accounts:', accounts);
        
        if (!accounts || accounts.length === 0) {
          console.log('MetaMask connect: No accounts returned');
          alert('No accounts were selected. Please unlock your MetaMask and try again.');
          return;
        }
        
        const address = accounts[0];
        console.log('MetaMask connect: Connected account (raw):', address);
        
        // IMPORTANT: Normalize addresses for comparison (lowercase)
        // This fixes the issue where the same address might appear as different due to case
        const normalizedAddress = address.toLowerCase();
        
        console.log('MetaMask connect: Connected account (normalized):', normalizedAddress);
        
        // Check for address collisions with stored addresses - these should be cleared already,
        // but double-check to be safe
        if (connectedWallets.coinbase && 
            connectedWallets.addresses.coinbase && 
            connectedWallets.addresses.coinbase.toLowerCase() === normalizedAddress) {
          console.log('MetaMask connect: WARNING - Duplicate with Coinbase wallet detection failed');
          
          // Force disconnect the Coinbase wallet to avoid conflicts
          disconnect(); // This uses wagmi to disconnect Coinbase
          
          // Update our internal state to remove Coinbase
          setConnectedWallets(prev => ({
            ...prev,
            coinbase: false,
            addresses: {
              ...prev.addresses,
              coinbase: undefined
            }
          }));
          
          // Small delay to ensure state is cleared
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Update our state with the connected MetaMask wallet - use original case for display
        console.log('MetaMask connect: Setting connected state to true with address:', address);
        setConnectedWallets(prev => ({
          ...prev,
          metamask: true,
          addresses: {
            ...prev.addresses,
            metamask: address // Keep original case for display
          }
        }));
        
        console.log('MetaMask connect: Connection process complete');
      } catch (error: any) {
        console.error('MetaMask connect error:', error?.message || error);
        
        // Handle user rejection specifically
        if (error?.code === 4001) {
          console.log('MetaMask connect: User rejected the request');
          alert('Connection cancelled: You rejected the connection request.');
        } else {
          alert(`Failed to connect MetaMask wallet: ${error?.message || 'Unknown error'}`);
        }
      }
    } catch (outerError: any) {
      console.error('MetaMask outer connection error:', outerError?.message || outerError);
      alert(`Failed to initialize MetaMask connection: ${outerError?.message || 'Unknown error'}`);
    }
  };

  const disconnectWallet = (type: 'coinbase' | 'phantom' | 'metamask') => {
    if (type === 'coinbase' && isConnected) {
      // Use wagmi to disconnect
      disconnect()
    } else if (type === 'phantom') {
      // For Phantom wallet
      try {
        if (typeof window !== 'undefined' && window.phantom?.solana) {
          window.phantom.solana.disconnect().catch(console.error)
        }
      } catch (error) {
        console.error('Error disconnecting Phantom wallet:', error)
      }
    } else if (type === 'metamask') {
      // MetaMask doesn't have a disconnect method in the provider API
      // We just remove it from our state
    }
    
    // Also update our internal state
    setConnectedWallets(prev => {
      const newAddresses = {...prev.addresses}
      delete newAddresses[type]
      
      return {
        ...prev,
        [type]: false,
        addresses: newAddresses
      }
    })
  }

  const handleSubmit = async () => {
    if (!agreeToTerms) return
    
    // For debugging
    console.log('Session data:', session)
    
    // Use email as ID if id not available
    const userId = session?.user?.email || `twitter_${session?.user?.name}`
    
    if (!userId) {
      alert('You need to be logged in with Twitter to submit')
      return
    }

    setIsSubmitting(true)
    
    try {
      // Prepare social accounts data
      const socialAccounts: Record<string, { handle: string, followers: number }> = {}
      
      // Only include social profiles with handles
      Object.entries(socialProfiles).forEach(([platform, data]) => {
        if (data.handle) {
          socialAccounts[platform.toLowerCase()] = {
            handle: data.handle,
            followers: parseInt(data.followers) || 0
          }
        }
      })
      
      // Include Twitter from session
      if (session?.user?.name) {
        socialAccounts.twitter = {
          handle: session.user.name,
          followers: 0 // We don't have this info from auth
        }
      }
      
      // Prepare wallet addresses
      const walletAddresses: Record<string, string> = {}
      if (connectedWallets.coinbase && connectedWallets.addresses.coinbase) {
        walletAddresses.coinbase = connectedWallets.addresses.coinbase
      }
      if (connectedWallets.phantom && connectedWallets.addresses.phantom) {
        walletAddresses.phantom = connectedWallets.addresses.phantom
      }
      if (connectedWallets.metamask && connectedWallets.addresses.metamask) {
        walletAddresses.metamask = connectedWallets.addresses.metamask
      }
      
      // Prepare form submission
      const formData = {
        id: userId,
        name: session?.user?.name || '',
        twitterHandle: session?.user?.name ? `@${session?.user?.name}` : '',
        profileImageUrl: session?.user?.image || '',
        country: audienceCountries,
        audienceTypes: audiences,
        chains: chains,
        contentTypes: contentTypes,
        postPricePerPost: pricePerPost,
        monthlySupportBudget: monthlyBudget,
        bestCollabUrls: collabUrls.filter(url => url.trim()),
        socialAccounts: socialAccounts,
        walletAddresses: walletAddresses,
        createdAt: new Date().toISOString(),
      }
      
      console.log('Submitting form data:', formData)
      
      // Submit to API
      const response = await fetch('/api/save-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API error:', errorData)
        throw new Error('Failed to save profile')
      }
      
      // Success! Move to success stage
      setStage('success')
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Failed to save your profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle helpers for multi-select fields
  const toggleCountry = (c: string) => {
    setAudienceCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const toggleContentType = (type: string) => {
    setContentTypes(prev => prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type])
  }

  // On mount, if we have come back from Twitter / X OAuth redirect, restore the last stage
  useEffect(() => {
    if (typeof window === 'undefined') return

    // If we already have a user session, try to resume the saved stage
    if (session?.user) {
      const saved = localStorage.getItem('loginStage') as typeof stage | null
      if (saved) {
        setStage(saved)
        localStorage.removeItem('loginStage')
      }
    }
    
    // Check for Phantom mobile connection return
    // When returning from Phantom mobile, the URL will have special parameters
    const urlParams = new URLSearchParams(window.location.search);
    const phantomConnected = urlParams.get('phantom_encryption_public_key');
    const phantomData = urlParams.get('data');
    const phantomNonce = urlParams.get('nonce');
    
    if (phantomConnected && phantomData) {
      try {
        console.log('Returned from Phantom mobile with:', { phantomConnected, phantomData, phantomNonce });
        // In a real implementation, you would need to decrypt this data using the Phantom SDK
        // For now, we'll simulate a connection with a mock address
        const mockSolanaAddress = 'Phantom' + Math.random().toString(36).substring(2, 10);
        
        // Set the wallet as connected
        setConnectedWallets(prev => ({
          ...prev,
          phantom: true,
          addresses: {
            ...prev.addresses,
            phantom: mockSolanaAddress
          }
        }));
        
        // Clean up the URL by removing phantom parameters
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Make sure we're on the wallet stage
        setStage('wallet');
      } catch (error) {
        console.error('Error handling Phantom mobile return:', error);
      }
    }
  }, [session]);

  // Add MetaMask event listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      console.log('LoginModal: No Ethereum provider detected on window');
      return;
    }

    console.log('LoginModal: MetaMask event listeners setup start');
    console.log('LoginModal: Current ethereum provider:', {
      isMetaMask: window.ethereum.isMetaMask,
      isCoinbaseWallet: window.ethereum.isCoinbaseWallet,
      hasProviders: Boolean(window.ethereum.providers),
      hasSelectedAddress: Boolean(window.ethereum.selectedAddress),
    });

    if (window.ethereum.selectedAddress) {
      console.log('LoginModal: WARNING - Provider already has a selectedAddress:', window.ethereum.selectedAddress);
    }

    // IMPORTANT: Clear any cached provider connections
    try {
      // This will force MetaMask to forget the connection state until explicitly requested
      console.log('LoginModal: Attempting to reset connection state');
      if (window.ethereum._state && window.ethereum._state.accounts) {
        console.log('LoginModal: Found cached accounts in provider state, current length:', window.ethereum._state.accounts.length);
      }
    } catch (err) {
      console.log('LoginModal: Error trying to inspect provider state:', err);
    }

    // Handle account changes
    const handleAccountsChanged = (accounts: string[]) => {
      console.log('MetaMask accounts changed event triggered with accounts:', accounts);
      
      if (accounts.length === 0) {
        // User disconnected all accounts
        console.log('MetaMask: All accounts disconnected');
        disconnectWallet('metamask');
      } else if (connectedWallets.metamask && accounts[0] !== connectedWallets.addresses.metamask) {
        // Account switched - update our state with the new account
        console.log('MetaMask: Account switched to', accounts[0]);
        setConnectedWallets(prev => ({
          ...prev,
          metamask: true,
          addresses: {
            ...prev.addresses,
            metamask: accounts[0]
          }
        }));
      }
    };

    // Handle chain/network changes
    const handleChainChanged = () => {
      console.log('MetaMask chain changed, will reload page');
      // Refresh the page on chain change as recommended by MetaMask
      window.location.reload();
    };

    // Handle disconnect events
    const handleDisconnect = (error: { code: number; message: string }) => {
      console.log('MetaMask disconnect event:', error);
      disconnectWallet('metamask');
    };

    // Subscribe to MetaMask events
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    // DISABLE auto-connection check completely
    console.log('LoginModal: Skipping ALL auto-connection checks, regardless of stage');

    console.log('LoginModal: MetaMask event listeners setup complete');

    // Cleanup function
    return () => {
      console.log('LoginModal: Removing MetaMask event listeners');
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After successful wallet connection
  const handleWalletConnect = async (walletAddress: string, walletType: string) => {
    try {
      // Create wallet data
      const walletData = {
        walletAddresses: {
          [walletType]: walletAddress
        },
        role: "user" as const
      };
      
      // Identify or create user
      const { user, isNewUser } = await identifyUser(walletData);
      
      // Update state with user info
      setConnectedWallets(prev => ({
        ...prev,
        [walletType === 'coinbase' ? 'coinbase' : false,
        [walletType]: true,
        addresses: {
          ...prev.addresses,
          [walletType]: walletAddress
        }
      }));
      
      // Close modal if needed
      if (onSuccess) onSuccess(user);
      
      console.log(`User ${isNewUser ? 'created' : 'updated'} with wallet address: ${walletAddress}`);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setErrorMessage("Failed to connect wallet. Please try again.");
    }
  };

  if (stage === 'hidden') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono text-green-300 p-6">
      <div 
        className="absolute inset-0 bg-black opacity-80" 
        onClick={handleClose} 
      />
      <div className="relative z-10 rounded border-4 border-green-400 bg-black p-6 space-y-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Admin Panel Button (if admin wallet connected) */}
        {isAdminWallet && (
          <div className="absolute top-3 right-3">
            <button 
              className="px-3 py-1 bg-purple-600 text-white text-xs animate-pulse hover:bg-purple-500"
              onClick={() => router.push('/admin')}
            >
              Admin Panel
            </button>
          </div>
        )}
        
        {/* Choice */}
        {stage === 'choice' && (
          <div className="flex flex-col gap-3">
            {isLoggedIn && (
              <div className="mb-5">
                {/* Pixel-style Driver's License */}
                <div className="license-card border-4 border-green-400 p-3 bg-black mb-3">
                  <div className="flex justify-between items-start mb-3">
                    <div className="license-header text-xs uppercase font-bold tracking-widest">
                      CYBERNETIC ACCESS PERMIT
                    </div>
                    <div className="license-hologram text-xs text-green-400 animate-pulse">
                      [VERIFIED]
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="license-photo w-20 h-20 border-2 border-green-300 overflow-hidden relative">
                      {session?.user?.image ? (
                        <img 
                          src={session.user.image} 
                          alt={session.user.name || 'User'} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-green-900 flex items-center justify-center">
                          <span className="text-xs text-green-300">NO IMAGE</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-center">
                        <div className="text-[8px] text-green-300">ID-7734</div>
                      </div>
                    </div>
                    
                    <div className="license-data flex-1 text-xs flex flex-col gap-1">
                      <div className="license-field">
                        <span className="opacity-70">HANDLE:</span> <span className="font-bold">@{session?.user?.name || 'unknown'}</span>
                      </div>
                      <div className="license-field">
                        <span className="opacity-70">ACCESS LEVEL:</span> <span className="font-bold">{isAdminWallet ? 'ADMIN' : 'USER'}</span>
                      </div>
                      <div className="license-field">
                        <span className="opacity-70">ISSUED:</span> <span className="font-bold">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="license-field">
                        <span className="opacity-70">STATUS:</span> <span className="font-bold text-green-400 animate-pulse">ACTIVE</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="license-barcode mt-3 flex justify-between items-center">
                    <div className="license-signature text-[6px] opacity-70 uppercase">
                      KOL-SYSTEM//AUTHORIZED~SIGNATURE
                    </div>
                    <div className="barcode-area border border-green-300 p-1 bg-green-900/20">
                      <div className="barcode flex items-center gap-[1px]">
                        {Array(15).fill(0).map((_, i) => (
                          <div 
                            key={i} 
                            className="bar h-8" 
                            style={{ 
                              width: Math.floor(Math.random() * 3) + 1 + 'px',
                              backgroundColor: `rgba(134, 239, 172, ${Math.random() * 0.8 + 0.2})`
                            }}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button onClick={() => setStage('enter')} className="border border-green-300 px-4 py-2 hover:bg-gray-900">enter</button>
            <button onClick={() => setStage('apply')} className="border border-green-300 px-4 py-2 hover:bg-gray-900">apply</button>
            <button onClick={handleClose} className="border border-green-300 px-4 py-2 text-xs hover:bg-gray-900">close</button>
          </div>
        )}

        {/* Enter */}
        {stage === 'enter' && (
          <div className="flex flex-col gap-5">
            <h2 className="text-sm uppercase">Connect</h2>
            
            {/* X/Twitter Section */}
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">X/Twitter</label>
              {session?.user ? (
                <div className="flex items-center">
                  <img
                    src={session.user.image || '/logo.png'}
                    alt={session.user.name || ''}
                    className="w-8 h-8 rounded-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="text-xs ml-2">{session.user.name}</span>
                  <button 
                    className="text-red-500 ml-auto"
                    onClick={() => signOut()}
                  >
                    x
                  </button>
                </div>
              ) : (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={() => {
                    // Save progress so that after OAuth redirect we resume from social step
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('loginStage', 'social')
                    }
                    signIn('twitter')
                  }}
                >
                  Login with 𝕏
                </button>
              )}
            </div>
            
            {/* Coinbase Wallet Section */}
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">Coinbase Wallet</label>
              {!connectedWallets.coinbase ? (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={connectCoinbaseWallet}
                >
                  Connect Coinbase Wallet
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.coinbase || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 ml-2 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('coinbase')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            
            {/* Phantom Wallet Section */}
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">Phantom Wallet</label>
              {!connectedWallets.phantom ? (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={connectPhantomWallet}
                >
                  Connect Phantom Wallet
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.phantom || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 ml-2 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('phantom')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            
            {/* MetaMask Wallet Section - TEMPORARILY HIDDEN */}
            {/* Uncomment when fixed
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">MetaMask Wallet</label>
              {!connectedWallets.metamask ? (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={connectMetaMaskWallet}
                >
                  Connect MetaMask Wallet
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.metamask || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 ml-2 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('metamask')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            */}
            
            <button className="text-xs self-start" onClick={() => setStage('choice')}>back</button>
          </div>
        )}

        {/* Apply Step 1 – Campaign Fit */}
        {stage === 'apply' && (
          <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); setStage('social'); }}>
            <h2 className="text-sm uppercase">1. Campaign Fit</h2>
            
            {/* Audience Countries */}
            <label className="text-xs uppercase">Audience Countries (multi-select)</label>
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(prev => !prev)}
                  className="text-xs border border-green-300 px-2 py-1 hover:bg-green-800"
                >
                  {showCountryDropdown ? 'Hide Countries' : 'Select Countries'}
                </button>
                <div className="flex gap-1">
                  {audienceCountries.map(c => (
                    <img
                      key={c}
                      src={`https://flagcdn.com/w20/${getCountryCode(c)}.png`}
                      alt={c}
                      className="w-5 h-3"
                    />
                  ))}
                </div>
              </div>
              {showCountryDropdown && (
                <div className="mt-2 border border-green-300 p-2">
                  <input
                    type="text"
                    placeholder="Search countries..."
                    className="w-full bg-black border border-green-300 p-2 text-xs"
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                  />
                  <div className="mt-1 max-h-32 overflow-auto">
                    {filteredCountries.map(c => (
                      <div
                        key={c}
                        className={`p-2 text-xs cursor-pointer ${audienceCountries.includes(c) ? 'bg-green-800' : ''}`}
                        onClick={() => toggleCountry(c)}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {audienceCountries.length > 0 && (
              <div className="text-xs text-green-400 mt-1">
                Selected: {audienceCountries.join(', ')}
              </div>
            )}

            {/* Target Audience */}
            <label className="text-xs uppercase">Target Audience (multi-select)</label>
            <div className="grid grid-cols-2 gap-2">
              {audienceOptions.map(opt => (
                <label key={opt} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={audiences.includes(opt)}
                    onChange={() => setAudiences(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])}
                  />
                  {opt}
                </label>
              ))}
            </div>

            {/* Active Chains */}
            <label className="text-xs uppercase">Active Chains (multi-select)</label>
            <div className="grid grid-cols-2 gap-2">
              {chainOptions.map(chain => (
                <label key={chain} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    value={chain}
                    checked={chains.includes(chain)}
                    onChange={() => setChains(prev => prev.includes(chain) ? prev.filter(x => x !== chain) : [...prev, chain])}
                  />
                  {chain}
                </label>
              ))}
            </div>

            {/* Content Types */}
            <label className="text-xs uppercase">Content Types (multi-select)</label>
            <div className="grid grid-cols-2 gap-2">
              {contentTypeOptions.map(type => (
                <label key={type} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    value={type}
                    checked={contentTypes.includes(type)}
                    onChange={() => toggleContentType(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
            {contentTypes.length > 0 && (
              <div className="text-xs text-green-400 mt-1">
                Selected: {contentTypes.join(', ')}
              </div>
            )}

            {/* Pricing */}
            <label className="text-xs uppercase">Pricing</label>
            <input
              type="number"
              placeholder="Avg price per post (USD)"
              className="bg-black border border-green-300 p-2 text-xs"
              value={pricePerPost}
              onChange={e => setPricePerPost(e.target.value)}
            />
            <input
              type="number"
              placeholder="Monthly support budget (USD)"
              className="bg-black border border-green-300 p-2 text-xs"
              value={monthlyBudget}
              onChange={e => setMonthlyBudget(e.target.value)}
            />

            {/* Best Collab URLs */}
            <label className="text-xs uppercase">Best Collab URLs</label>
            {collabUrls.map((url, index) => (
              <input
                key={index}
                type="url"
                placeholder={`URL ${index + 1}`}
                className="bg-black border border-green-300 p-2 text-xs"
                value={url}
                onChange={e => updateCollabUrl(index, e.target.value)}
              />
            ))}
            <button 
              type="button" 
              className="text-xs self-start border border-green-300 px-2 py-1"
              onClick={addCollabUrl}
            >
              + add more
            </button>

            <div className="flex gap-4 mt-4">
              <button type="button" className="text-xs" onClick={() => setStage('choice')}>back</button>
              <button type="submit" className="px-4 py-2 border border-green-300 hover:bg-gray-900">next</button>
            </div>
          </form>
        )}

        {/* Social Platforms */}
        {stage === 'social' && (
          <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); setStage('wallet'); }}>
            <h2 className="text-sm uppercase">2. Social Platforms</h2>
            
            {/* Twitter/X Connection Section */}
            <div className="border border-green-300 p-3 mb-2">
              <label className="text-xs uppercase block mb-2">X (Twitter)</label>
              {session?.user ? (
                <div className="flex items-center">
                  <img
                    src={session.user.image || '/logo.png'}
                    alt={session.user.name || ''}
                    className="w-8 h-8 rounded-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="text-xs ml-2">{session.user.name}</span>
                  <button 
                    className="text-red-500 ml-auto"
                    onClick={() => signOut()}
                  >
                    x
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={() => {
                    // Save progress so that after OAuth redirect we resume from social step
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('loginStage', 'social')
                    }
                    signIn('twitter')
                  }}
                >
                  Connect X (Twitter) Account
                </button>
              )}
            </div>
            
            <p className="text-xs">Add other social platforms where you have a presence</p>
            
            <div className="flex flex-col gap-2">
              {socialPlatforms.map(platform => (
                <div key={platform.name} className="border border-green-300">
                  <button
                    type="button"
                    className={`w-full p-2 text-left text-xs ${expandedPlatform === platform.name ? 'bg-green-800' : ''}`}
                    onClick={() => togglePlatform(platform.name)}
                  >
                    {platform.name} {expandedPlatform === platform.name ? '▲' : '▼'}
                  </button>
                  
                  {expandedPlatform === platform.name && (
                    <div className="p-2 border-t border-green-300">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder={`${platform.name} username/handle`}
                          className="bg-black border border-green-300 p-2 text-xs"
                          value={socialProfiles[platform.name].handle}
                          onChange={e => updateSocialProfile(platform.name, 'handle', e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Number of followers"
                          className="bg-black border border-green-300 p-2 text-xs"
                          value={socialProfiles[platform.name].followers}
                          onChange={e => updateSocialProfile(platform.name, 'followers', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-4">
              <button type="button" className="text-xs" onClick={() => setStage('apply')}>back</button>
              <button 
                type="submit" 
                className={`px-4 py-2 ${!session?.user ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'border border-green-300 hover:bg-gray-900'}`}
                disabled={!session?.user}
              >
                next
              </button>
              {!session?.user && (
                <div className="text-xs text-red-400 ml-2">X (Twitter) account connection required to proceed</div>
              )}
            </div>
          </form>
        )}

        {/* Wallet Connect */}
        {stage === 'wallet' && (
          <div className="flex flex-col gap-3">
            <h2 className="uppercase text-sm">3. Connect Wallets (optional)</h2>
            
            {/* Coinbase Wallet */}
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">Coinbase Wallet</label>
              {!connectedWallets.coinbase ? (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={connectCoinbaseWallet}
                >
                  Connect Coinbase Wallet
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.coinbase || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 ml-2 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('coinbase')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            
            {/* Phantom Wallet */}
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">Phantom Wallet</label>
              {!connectedWallets.phantom ? (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={connectPhantomWallet}
                >
                  Connect Phantom Wallet
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.phantom || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 ml-2 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('phantom')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            
            {/* MetaMask Wallet */}
            {/* Uncomment when fixed
            <div className="border border-green-300 p-3">
              <label className="text-xs uppercase block mb-2">MetaMask Wallet</label>
              {!connectedWallets.metamask ? (
                <button 
                  className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                  onClick={connectMetaMaskWallet}
                >
                  Connect MetaMask Wallet
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.metamask || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 ml-2 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('metamask')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            */}
            
            <div className="mt-4 flex gap-4">
              <button className="text-xs" onClick={() => setStage('social')}>back</button>
              <button 
                className="px-3 py-1 border border-green-300 hover:bg-gray-900" 
                onClick={() => setStage('preview')}
              >
                next
              </button>
              <button 
                className="px-3 py-1 border border-green-300 hover:bg-green-800" 
                onClick={() => {
                  if (confirm("You won't be entered into on-chain raffles without a connected wallet. Continue anyway?")) {
                    setStage('preview')
                  }
                }}
              >
                skip
              </button>
            </div>
          </div>
        )}

        {/* Preview & Submit */}
        {stage === 'preview' && (
          <div className="flex flex-col gap-3">
            <h2 className="uppercase text-sm">4. Preview & Submit</h2>
            
            {/* Retro KOL Card Preview */}
            <div className="border-2 border-green-400 p-4 bg-black">
              {/* Profile Image */}
              <div className="flex gap-4">
                <div className="w-20 h-20">
                  <img 
                    src={session?.user?.image || '/logo.png'} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                
                {/* Core Stats */}
                <div className="flex flex-col">
                  <span className="text-xl">{session?.user?.name || 'User'}</span>
                  {/* Only show Twitter handle if we can extract it from user email or explicitly set */}
                  {session?.user?.email && !session.user.email.includes(session?.user?.name || '') && (
                    <span className="text-xs">@{session?.user?.email.split('@')[0] || 'username'}</span>
                  )}
                  <span className="text-xs">Primary chains: {chains.join(', ') || 'None selected'}</span>
                </div>
              </div>
              
              {/* Details */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>Audience Countries: {audienceCountries.join(', ') || 'Not specified'}</div>
                <div>Content Types: {contentTypes.join(', ') || 'Not specified'}</div>
                <div>Post price: ${pricePerPost || '0'}</div>
                <div>Budget: ${monthlyBudget || '0'}/month</div>
              </div>

              {/* Wallets */}
              {(connectedWallets.coinbase || connectedWallets.phantom || connectedWallets.metamask) && (
                <div className="mt-2 text-xs">
                  <div className="uppercase">Connected Wallets:</div>
                  <div className="grid grid-cols-1 gap-1 mt-1">
                    {connectedWallets.coinbase && (
                      <div>Coinbase: {connectedWallets.addresses.coinbase}</div>
                    )}
                    {connectedWallets.phantom && (
                      <div>Phantom: {connectedWallets.addresses.phantom}</div>
                    )}
                    {connectedWallets.metamask && (
                      <div>MetaMask: {connectedWallets.addresses.metamask}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Social Handles */}
              <div className="mt-4 text-xs">
                <div className="uppercase">Social Handles:</div>
                <div className="grid grid-cols-1 gap-1 mt-1">
                  {Object.entries(socialProfiles)
                    .filter(([_, profile]) => profile.handle)
                    .map(([platform, profile]) => {
                      const url = getSocialUrl(platform, profile.handle)
                      return (
                        <div key={platform} className="flex items-center gap-2">
                          <span>{platform}:</span>
                          {url ? (
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-400 hover:underline"
                            >
                              {profile.handle}
                            </a>
                          ) : (
                            <span>{profile.handle}</span>
                          )}
                          <span className="ml-auto">{profile.followers ? `${profile.followers} followers` : ''}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
            
            {/* Terms Agreement */}
            <label className="flex items-center gap-2 text-xs mt-2">
              <input 
                type="checkbox" 
                checked={agreeToTerms}
                onChange={e => setAgreeToTerms(e.target.checked)}
              />
              I agree to the terms and conditions
            </label>
            
            <div className="flex gap-4 mt-4">
              <button className="text-xs" onClick={() => setStage('wallet')}>back</button>
              <button 
                onClick={handleSubmit}
                disabled={!agreeToTerms || isSubmitting}
                className={`px-4 py-2 ${
                  !agreeToTerms 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : isSubmitting 
                      ? 'bg-yellow-900 border border-yellow-500' 
                      : 'border border-green-300 hover:bg-gray-900'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {/* Success Stage */}
        {stage === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-xl text-green-400">Application Submitted!</div>
            <div className="animate-pulse text-4xl">✓</div>
            <p className="text-center text-xs mt-4">
              Thank you for applying to the KOL program.<br/>
              We'll review your application and get back to you soon.
            </p>
            <button 
              className="mt-4 px-4 py-2 border border-green-300 hover:bg-gray-900"
              onClick={() => setStage('hidden')}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 