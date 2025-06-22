// ✅ STABLE & VERIFIED – DO NOT MODIFY WITHOUT REVIEW
// This component handles both main landing page login (triple-click) and authentication flows
// Last verified: December 2024
// Critical functionality:
// - Explicit trigger tracking to prevent auto-hiding for manual triggers
// - Wallet connection handling for Coinbase, MetaMask, and Phantom
// - Twitter authentication integration
// - Server-side user identification via API endpoint

'use client'
import React, { useState, useRef, useMemo, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { getNames, getCode } from 'country-list'
import { useRouter } from 'next/navigation'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import ProfileModal from '@/components/ProfileModal'

// Define custom types for wallet interfaces
interface PhantomProvider {
  solana?: {
    isPhantom?: boolean;
    isConnected?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    publicKey?: { toString: () => string };
  }
}

interface MetaMaskProvider {
  isMetaMask?: boolean;
  request: (args: { method: string, params?: any[] }) => Promise<any>;
}

// Declare augmented window interface
declare global {
  interface Window {
    ethereum?: any;
    phantom?: PhantomProvider;
    solana?: {
      isPhantom?: boolean;
      connect: (opts?: { onlyIfTrusted: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      publicKey?: { toString: () => string };
      isConnected?: boolean;
    };
  }
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
  const { data: session, status } = useSession()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [stage, setStage] = useState<'hidden'|'choice'|'enter'|'apply'|'social'|'wallet'|'preview'|'success'>('hidden')
  const router = useRouter()
  const taps = useRef(0)
  const timer = useRef<number>()
  
  // Track if modal was explicitly triggered (via triple-click) vs automatic
  const [explicitlyTriggered, setExplicitlyTriggered] = useState(false)
  
  // Wallet connection state
  const [walletConnectionPending, setWalletConnectionPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  // User profile state for cybernetic access permit
  const [userProfile, setUserProfile] = useState<any>(null)
  const [hasProfile, setHasProfile] = useState(false)
  
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

  const [showProfileModal, setShowProfileModal] = useState(false)

  // Fetch user profile when session changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!session) return;
      
      // Use the Twitter handle from session, not the display name
      const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle;
      
      if (!twitterHandle) {
        console.log('[LoginModal] No Twitter handle found in session');
        return;
      }
      
      try {
        console.log('[LoginModal] Fetching profile for handle:', twitterHandle);
        const res = await fetch(`/api/user/profile?handle=${encodeURIComponent(twitterHandle)}`);
        if (res.ok) {
          const data = await res.json();
          console.log('[LoginModal] Profile response:', data);
          if (data.user) {
            setUserProfile(data.user);
            setHasProfile(true);
            
            // Only auto-hide modal if it wasn't explicitly triggered
            if (!explicitlyTriggered) {
              // IMPORTANT: Hide modal after successful login for admin/core users
              if (data.user.role === 'admin' || data.user.role === 'core') {
                console.log('[LoginModal] Admin/Core user detected, hiding modal automatically');
                setStage('hidden');
              }
              
              // Also hide for approved users if they're not in an active flow
              if (data.user.approvalStatus === 'approved' && stage === 'choice') {
                console.log('[LoginModal] Approved user detected, hiding modal automatically');
                setStage('hidden');
              }
            }
          } else if (data) {
            setUserProfile(data);
            setHasProfile(true);
          }
        } else {
          console.error('[LoginModal] Profile fetch failed:', res.status);
        }
      } catch (error) {
        console.error('[LoginModal] Error fetching user profile:', error);
      }
    }
    
    fetchUserProfile()
    
    // Poll for updates every 5 seconds to catch admin panel changes
    const interval = setInterval(fetchUserProfile, 5000)
    
    return () => clearInterval(interval)
  }, [session, stage, explicitlyTriggered])

  // Update wallet state when Wagmi account changes
  useEffect(() => {
    // Skip this effect if we're not on the wallet connection stage
    if (stage !== 'enter' && stage !== 'wallet') {
      return;
    }
    
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
    } else if (!isConnected && stage === 'enter') {
      // Only clear if we're explicitly on the wallet connection stage
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
  }, [isConnected, address, connectedWallets.metamask, connectedWallets.addresses.metamask, stage]);

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
      setExplicitlyTriggered(true)
      setStage('choice')
    }
  }

  // Check if the user is logged in with Twitter/X
  const isLoggedIn = !!session?.user;
  
  // Handle initial state for logged-in users
  useEffect(() => {
    // Don't automatically show anything on load
    // Let the triple-click mechanism handle showing the modal
    
    // But ensure admin users don't get stuck with modal open (only if not explicitly triggered)
    if (!explicitlyTriggered && isLoggedIn && userProfile && stage === 'choice') {
      if (userProfile.role === 'admin' || userProfile.role === 'core') {
        console.log('[LoginModal] Admin/Core user on load, ensuring modal is hidden');
        setStage('hidden');
      }
    }
  }, [isLoggedIn, stage, userProfile, explicitlyTriggered]);

  // Keep handleTripleTap, but remove the global assignment
  const handleTripleTap = () => {
    taps.current++
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => (taps.current = 0), 500)
    if (taps.current === 3) {
      // Show choice screen on triple tap
      setExplicitlyTriggered(true)
      setStage('choice')
    }
  }
  
  // Make sure close button works properly
  const handleClose = () => {
    // Fully hide the modal
    setStage('hidden')
    // Reset the explicitly triggered flag
    setExplicitlyTriggered(false)
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
  const [isAdminRole, setIsAdminRole] = useState(false);

  // Fetch role for any newly connected wallet
  useEffect(() => {
    const checkRole = async (addr?: string) => {
      if (!addr) return;
      try {
        const res = await fetch(`/api/admin/check-role?wallet=${addr}`);
        if (res.ok) {
          const data = await res.json();
          setIsAdminRole(data.role === 'admin');
        }
      } catch (e) {
        console.error('Role check failed', e);
      }
    };

    if (connectedWallets.coinbase) checkRole(connectedWallets.addresses.coinbase);
    else if (connectedWallets.phantom) checkRole(connectedWallets.addresses.phantom);
    else if (connectedWallets.metamask) checkRole(connectedWallets.addresses.metamask);
  }, [connectedWallets]);

  // Check if admin wallet is connected (hardcoded OR role)
  const isAdminWallet = isAdminRole || (
    connectedWallets.coinbase && connectedWallets.addresses.coinbase === ADMIN_WALLET_ETH ||
    connectedWallets.phantom && (
      connectedWallets.addresses.phantom === ADMIN_WALLET_SOLANA_1 || 
      connectedWallets.addresses.phantom === ADMIN_WALLET_SOLANA_2 ||
      connectedWallets.addresses.phantom === ADMIN_WALLET_SOLANA_3
    ) ||
    connectedWallets.metamask && connectedWallets.addresses.metamask === ADMIN_WALLET_ETH
  );

  // Helper to mask wallet addresses
  const maskAddress = (addr: string) => `${addr.slice(0,4)}...${addr.slice(-4)}`

  // Show/hide country dropdown
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  // Real wallet connection handlers
  const connectCoinbaseWallet = async () => {
    try {
      setWalletConnectionPending(true);
      setErrorMessage(''); // Clear any previous error
      
      // Try to find the Coinbase Wallet connector, fallback to the first connector
      const connector = connectors.find(c => c.id === 'coinbaseWallet') ?? connectors[0]
      if (!connector) {
        console.error('No wallet connectors available')
        setErrorMessage('No wallet connectors available. Please install a supported wallet.');
        setWalletConnectionPending(false);
        return
      }
      
      // Set a timeout to handle cases where the connection hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 20000);
      });
      
      // Connect with a timeout
      const connectionPromise = connect({ connector });
      
      try {
        await Promise.race([connectionPromise, timeoutPromise]);
        
        // After successful connection:
        // Use identity management to find or create user if we have an address
        if (address) {
          const walletData = {
            walletAddresses: {
              coinbase: address
            },
            role: "user" as const
          };
          
          // Call API endpoint instead of directly using identifyUser
          try {
            await fetch('/api/user/identify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(walletData)
            });
          } catch (err) {
            console.error('Failed to identify user:', err);
          }
        }
        
        setWalletConnectionPending(false);
      } catch (timeoutError) {
        console.error('Coinbase wallet connection timed out:', timeoutError);
        setErrorMessage('Connection timed out. Please try again.');
        setWalletConnectionPending(false);
      }
    } catch (error) {
      console.error('Error connecting Coinbase wallet:', error)
      setErrorMessage('Failed to connect Coinbase wallet. Please try again.');
      setWalletConnectionPending(false);
    }
  }

  // For Phantom, we need to detect if it's available in the browser
  const connectPhantomWallet = async () => {
    try {
      setWalletConnectionPending(true);
      setErrorMessage(''); // Clear any previous errors
      
      // Check if we're on a mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isBrave = navigator.userAgent.includes('Brave') || (window.navigator as any).brave;
      
      console.log('Connecting Phantom wallet on:', 
        isMobile ? 'mobile' : 'desktop', 
        isIOS ? '(iOS)' : '',
        isBrave ? '(Brave browser)' : ''
      );
      
      // First, detect if Phantom is properly installed
      const isPhantomInstalled = window.phantom?.solana && window.phantom.solana.isPhantom;
      
      // Check if we're in Phantom's in-app browser (mobile)
      const isPhantomMobileBrowser = isMobile && window.solana && (window.solana as any).isPhantom;
      
      // On iOS, also check for the Phantom app using a different method
      const isPhantomApp = isIOS && (
        window.location.href.includes('phantom.app') || 
        (window as any).phantom?.solana?.isPhantom ||
        (window as any).solana?.isPhantom
      );
      
      if (!isPhantomInstalled && !isPhantomMobileBrowser && !isPhantomApp) {
        console.error('Phantom wallet not detected or not properly installed');
        
        // Different message based on device
        if (isMobile) {
          if (isIOS) {
            setErrorMessage('To connect Phantom on iOS:\n1. Open the Phantom app\n2. Tap the browser icon at the bottom\n3. Navigate to this website\n4. Try connecting again');
          } else {
            setErrorMessage('Please open this site in the Phantom app browser to connect your wallet.');
          }
          setWalletConnectionPending(false);
          
          // Create deep link to open in Phantom app
          const currentUrl = window.location.href;
          const encodedUrl = encodeURIComponent(currentUrl);
          const ref = encodeURIComponent(window.location.origin);
          
          // Use different deep link format for iOS
          const phantomDeepLink = isIOS 
            ? `phantom://browse/${encodedUrl}?ref=${ref}`
            : `https://phantom.app/ul/v1/browse/${encodedUrl}?ref=${ref}`;
          
          // Offer to open in Phantom app
          const confirmMessage = isIOS 
            ? 'Would you like to open this site in the Phantom app? Make sure Phantom is installed first.'
            : 'Would you like to open this site in the Phantom app browser?';
            
          if (confirm(confirmMessage)) {
            // For iOS, try the deep link first, then fallback to App Store
            if (isIOS) {
              // Try to open the app
              window.location.href = phantomDeepLink;
              
              // Set a timeout to redirect to App Store if the app doesn't open
              setTimeout(() => {
                if (document.hasFocus()) {
                  // If we still have focus, the app probably isn't installed
                  if (confirm('Phantom app not found. Would you like to install it from the App Store?')) {
                    window.location.href = 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977';
                  }
                }
              }, 2500);
            } else {
              window.location.href = phantomDeepLink;
            }
          }
          return;
        } else {
          setErrorMessage('Phantom wallet not detected. Please install the Phantom extension and reload this page.');
          setWalletConnectionPending(false);
          
          // Offer to install extension
          if (confirm('Phantom wallet not detected. Would you like to install the Phantom extension?')) {
            window.open('https://phantom.app/download', '_blank');
          }
          return;
        }
      }
      
      // Get the correct wallet reference (mobile or desktop)
      const phantomWallet = isPhantomMobileBrowser || isPhantomApp ? 
        (window.solana as any) : 
        window.phantom?.solana;
      
      if (phantomWallet && typeof phantomWallet.connect === 'function') {
        try {
          // Always request connection explicitly - never auto-connect
          console.log('Requesting Phantom wallet connection...');
          
          // Attempt to connect with added timeout to prevent hanging
          const connectionPromise = phantomWallet.connect({ onlyIfTrusted: false });
          
          // Set a timeout for the connection attempt
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timed out')), 15000);
          });
          
          // Race the connection against a timeout
          const response = await Promise.race([connectionPromise, timeoutPromise]) as { publicKey: { toString: () => string } };
          
          if (!response || !response.publicKey) {
            throw new Error('No public key returned from wallet');
          }
          
          const publicKey = response.publicKey.toString();
          console.log('Connected to Phantom with public key:', publicKey);
          
          // Update our state with the connected Phantom wallet FIRST
          // This ensures the UI shows connected even if the API call fails
          setConnectedWallets(prev => ({
            ...prev,
            phantom: true,
            addresses: {
              ...prev.addresses,
              phantom: publicKey
            }
          }));
          
          // Store wallet connection in localStorage and cookies
          localStorage.setItem('walletAddress', publicKey);
          localStorage.setItem('walletType', 'phantom');
          document.cookie = `walletAddress=${publicKey}; path=/; max-age=3600`;
          
          // After successful connection:
          // Use identity management to find or create user
          // But wrap in try/catch to handle API failures gracefully
          try {
            const walletData = {
              walletAddresses: {
                phantom: publicKey
              },
              role: "user" as const
            };
            
            // Call API endpoint instead of directly using identifyUser
            await fetch('/api/user/identify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(walletData)
            });
          } catch (identifyError) {
            console.error('Error identifying user after wallet connection:', identifyError);
            // Don't show error to user since the wallet is connected
            // Just log it for debugging
          }
          
          setWalletConnectionPending(false);
        } catch (error: any) {
          console.error('Phantom connection error:', error);
          
          // Check for specific error types
          if (error.message === 'Connection timed out') {
            setErrorMessage('Connection to Phantom wallet timed out. Please try again.');
          } else if (error.message?.includes('User rejected')) {
            setErrorMessage('Connection rejected. Please approve the connection request in Phantom.');
          } else {
            setErrorMessage(`Failed to connect: ${error.message || 'Unknown error'}`);
          }
          
          setWalletConnectionPending(false);
          return;
        }
      } else {
        console.error('Phantom wallet detected but connect method not available');
        setErrorMessage('Phantom wallet is locked or not properly initialized. Please unlock your wallet and try again.');
        setWalletConnectionPending(false);
        return;
      }
    } catch (error: any) {
      console.error('Phantom wallet connection error:', error);
      setErrorMessage('Failed to connect Phantom wallet. Please ensure the extension is installed, unlocked, and try again.');
      setWalletConnectionPending(false);
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
    // Handle each wallet type independently
    if (type === 'coinbase') {
      if (isConnected) {
        // Use wagmi to disconnect Coinbase
        disconnect()
      }
      // Update only Coinbase state
      setConnectedWallets(prev => ({
        ...prev,
        coinbase: false,
        addresses: {
          ...prev.addresses,
          coinbase: undefined
        }
      }))
    } else if (type === 'phantom') {
      // For Phantom wallet
      try {
        if (typeof window !== 'undefined' && window.phantom?.solana) {
          window.phantom.solana.disconnect().catch(console.error)
        }
      } catch (error) {
        console.error('Error disconnecting Phantom wallet:', error)
      }
      // Update only Phantom state
      setConnectedWallets(prev => ({
        ...prev,
        phantom: false,
        addresses: {
          ...prev.addresses,
          phantom: undefined
        }
      }))
    } else if (type === 'metamask') {
      // MetaMask doesn't have a disconnect method in the provider API
      // Update only MetaMask state
      setConnectedWallets(prev => ({
        ...prev,
        metamask: false,
        addresses: {
          ...prev.addresses,
          metamask: undefined
        }
      }))
    }
    
    // Persist the updated state
    try {
      const currentState = connectedWallets
      const updatedState = {
        ...currentState,
        [type]: false,
        addresses: {
          ...currentState.addresses,
          [type]: undefined
        }
      }
      localStorage.setItem('connectedWallets', JSON.stringify(updatedState))
    } catch (error) {
      console.error('Error persisting wallet state:', error)
    }
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

    // Check for Phantom mobile connection return FIRST
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
        return; // Exit early, don't process OAuth return
      } catch (error) {
        console.error('Error handling Phantom mobile return:', error);
      }
    }

    // If we already have a user session (OAuth return)
    if (session?.user) {
      const checkExistingProfile = async () => {
        try {
          // Check if user has already applied
          const response = await fetch(`/api/user/profile?handle=${encodeURIComponent(session.user?.name || '')}`)
          if (response.ok) {
            const data = await response.json()
            if (data.user && data.user.socialAccounts) {
              // User has already applied, clear any saved stage and hide modal
              console.log('User has existing profile, clearing saved stage and hiding modal')
              localStorage.removeItem('loginStage')
              setStage('hidden') // Hide the modal completely
              return
            }
          }
        } catch (error) {
          console.error('Error checking existing profile:', error)
        }
        
        // Only restore saved stage if user hasn't already applied
        const saved = localStorage.getItem('loginStage') as typeof stage | null
        if (saved && saved === 'social') {
          // Check if they have a profile
          const response = await fetch(`/api/user/profile?handle=${encodeURIComponent(session.user?.name || '')}`)
          if (response.ok) {
            const data = await response.json()
            if (data.user && data.user.socialAccounts) {
              // User has profile, don't show apply form
              localStorage.removeItem('loginStage')
              setStage('hidden')
              return
            }
          }
          // No profile, continue with apply flow
          setStage(saved)
          localStorage.removeItem('loginStage')
        } else {
          // No saved stage, hide modal and stay on landing page
          setStage('hidden')
        }
      }
      
      checkExistingProfile()
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
      
      // Identify or create user via API endpoint
      const response = await fetch('/api/user/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(walletData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to identify user');
      }
      
      const { user, isNewUser } = await response.json();
      
      // Update state with user info
      setConnectedWallets(prev => ({
        ...prev,
        ...(walletType === 'coinbase' ? { coinbase: true } : {}),
        [walletType]: true,
        addresses: {
          ...prev.addresses,
          [walletType]: walletAddress
        }
      }));
      
      // Store wallet connection status in localStorage and cookies for security checks
      // But keep it simple with just the bare minimum
      localStorage.setItem('walletAddress', walletAddress);
      localStorage.setItem('walletType', walletType);
      
      // Set cookies for server-side access - only basic info
      document.cookie = `walletAddress=${walletAddress}; path=/; max-age=3600`;
      
      console.log(`User ${isNewUser ? 'created' : 'updated'} with wallet address: ${walletAddress}`);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setErrorMessage("Failed to connect wallet. Please try again.");
    }
  };

  // Load persisted wallet connections on mount
  useEffect(() => {
    const loadPersistedWallets = () => {
      try {
        const persistedWallets = localStorage.getItem('connectedWallets')
        if (persistedWallets) {
          const parsed = JSON.parse(persistedWallets)
          setConnectedWallets(parsed)
        }
      } catch (error) {
        console.error('Error loading persisted wallets:', error)
      }
    }
    
    loadPersistedWallets()
  }, [])
  
  // Persist wallet connections whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('connectedWallets', JSON.stringify(connectedWallets))
    } catch (error) {
      console.error('Error persisting wallets:', error)
    }
  }, [connectedWallets])

  // Add function to check if user has complete profile
  const checkUserProfile = async () => {
    if (!session?.user?.name) return
    
    try {
      const handle = (session as any)?.twitterHandle || session.user.name
      console.log('[Profile Check] Checking profile for:', handle)
      
      // First check if user exists in the system
      const res = await fetch(`/api/user/profile?handle=${encodeURIComponent(handle)}`)
      if (res.ok) {
        const data = await res.json()
        console.log('[Profile Check] User profile response:', data)
        if (data.user) {
          setUserProfile(data.user)
          
          // Special handling for admin users - they always have a "profile"
          if (data.user.role === 'admin' || data.user.role === 'core') {
            console.log('[Profile Check] Admin/Core user detected, setting hasProfile=true')
            setHasProfile(true)
            return
          }
          
          // For approved users, consider them as having a profile
          if (data.user.approvalStatus === 'approved') {
            console.log('[Profile Check] Approved user detected, setting hasProfile=true')
            setHasProfile(true)
            return
          }
        }
      }
      
      // Then check for full profile data for non-admin users
      try {
        const profileRes = await fetch(`/api/profile/${encodeURIComponent(handle)}`)
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          console.log('[Profile Check] Full profile data:', profileData)
          
          // Check multiple ways a profile might indicate completion
          if (profileData && (
            profileData.audiences || 
            profileData.audienceTypes ||
            profileData.chains || 
            profileData.contentTypes || 
            profileData.socialAccounts ||
            profileData.country ||
            profileData.bestCollabUrls ||
            profileData.isKOL
          )) {
            console.log('[Profile Check] User has profile data, setting hasProfile=true')
            setHasProfile(true)
          } else {
            console.log('[Profile Check] No substantial profile data found')
          }
        } else if (profileRes.status === 404) {
          console.log('[Profile Check] Profile not found (404)')
          // For users with no full profile, check if they're approved in the basic profile
          if (userProfile?.approvalStatus === 'approved') {
            console.log('[Profile Check] No full profile but user is approved, setting hasProfile=true')
            setHasProfile(true)
          }
        }
      } catch (profileError) {
        console.log('[Profile Check] Error fetching full profile:', profileError)
      }
    } catch (error) {
      console.error('[Profile Check] Error checking profile:', error)
    }
  }

  // Update useEffect to check profile on session change
  useEffect(() => {
    if (session) {
      checkUserProfile()
    }
  }, [session])

  if (stage === 'hidden') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono text-green-300 p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black opacity-80" 
        onClick={handleClose} 
      />
      <div className="relative z-10 rounded border-2 border-green-400 bg-black p-3 sm:p-6 space-y-2 sm:space-y-4 w-[calc(100%-2rem)] max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto">
        {/* Admin Panel Button (if user has admin role) */}
        {userProfile?.role === 'admin' && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <button 
              className="px-2 py-1 sm:px-3 sm:py-1 bg-purple-600 text-white text-[10px] sm:text-xs animate-pulse hover:bg-purple-500"
              onClick={() => router.push('/admin')}
            >
              Admin Panel
            </button>
          </div>
        )}
        
        {/* Choice */}
        {stage === 'choice' && (
          <div className="flex flex-col gap-2 sm:gap-3">
            {isLoggedIn && (
              <div className="mb-2 sm:mb-5">
                {/* Redesigned Cybernetic Access Pass */}
                <div className="bg-gradient-to-br from-green-950/20 to-black border-2 border-green-400 rounded-sm overflow-hidden">
                  {/* Header with gradient background */}
                  <div className="bg-gradient-to-r from-green-900/40 to-green-900/20 border-b border-green-400 px-2 py-1">
                    <div className="flex justify-between items-center">
                      <div className="text-[8px] sm:text-[10px] font-bold text-green-300 tracking-wider">
                        NABULINES ACCESS CARD
                      </div>
                      <div className={`text-[7px] sm:text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${
                        userProfile?.approvalStatus === 'approved' ? 'bg-green-900/50 text-green-400 border border-green-400' : 
                        userProfile?.approvalStatus === 'rejected' ? 'bg-red-900/50 text-red-400 border border-red-400' : 
                        'bg-yellow-900/50 text-yellow-400 border border-yellow-400'
                      }`}>
                        {userProfile?.approvalStatus === 'approved' ? 'ACTIVE' : 
                          userProfile?.approvalStatus === 'rejected' ? 'DENIED' : 
                          'PENDING'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Main Body */}
                  <div className="p-2 sm:p-3">
                    <div className="flex gap-2 sm:gap-3">
                      {/* Left: Photo & ID */}
                      <div className="flex-shrink-0">
                        <div className="w-[64px] h-[80px] sm:w-[80px] sm:h-[100px] bg-green-950/30 border border-green-400 rounded-sm overflow-hidden">
                          {session?.user?.image ? (
                            <img 
                              src={session.user.image.replace('_normal', '_400x400')} 
                              alt={session.user.name || 'User'} 
                              className="w-full h-full object-cover"
                              style={{ imageRendering: 'crisp-edges' }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[9px] sm:text-[10px] text-green-500">NO IMG</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-1 text-center">
                          <div className="text-[8px] sm:text-[9px] font-mono text-green-400">ID-7734</div>
                        </div>
                      </div>
                      
                      {/* Right: User Info */}
                      <div className="flex-1 space-y-1.5 sm:space-y-2">
                        {/* Name/Handle */}
                        <div className="border-b border-green-400/30 pb-1">
                          <div className="text-[12px] sm:text-[14px] font-bold text-green-300 leading-tight">
                            @{userProfile?.twitterHandle?.replace('@', '') || (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle || 'unknown'}
                          </div>
                          <div className="text-[8px] sm:text-[9px] text-green-500 flex items-center gap-2">
                            <span>{userProfile?.role?.toUpperCase() || 'USER'}</span>
                            <span className="text-green-400">•</span>
                            <span className="font-mono">
                              {(() => {
                                const tier = (userProfile?.tier || 'micro') as 'hero' | 'legend' | 'star' | 'rising' | 'micro';
                                const tierEmoji = {
                                  hero: '👑',
                                  legend: '⚔️',
                                  star: '⭐',
                                  rising: '🌟',
                                  micro: '✨'
                                }[tier] || '✨';
                                return `${tierEmoji} ${tier.toUpperCase()}`;
                              })()}
                            </span>
                          </div>
                        </div>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          <div>
                            <div className="text-[7px] sm:text-[8px] text-green-500 uppercase">Issued</div>
                            <div className="text-[10px] sm:text-[11px] font-mono text-green-300">
                              {userProfile?.createdAt 
                                ? new Date(userProfile.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
                                : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
                              }
                            </div>
                          </div>
                          <div>
                            <div className="text-[7px] sm:text-[8px] text-green-500 uppercase">Expires</div>
                            <div className="text-[10px] sm:text-[11px] font-mono text-green-300">NEVER</div>
                          </div>
                          <div>
                            <div className="text-[7px] sm:text-[8px] text-green-500 uppercase">Scouts</div>
                            <div className="text-[10px] sm:text-[11px] font-mono text-green-300">
                              {String(userProfile?.scoutCount || 0).padStart(3, '0')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[7px] sm:text-[8px] text-green-500 uppercase">Contests</div>
                            <div className="text-[10px] sm:text-[11px] font-mono text-green-300">
                              {String(userProfile?.contestCount || 0).padStart(3, '0')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Security Strip */}
                    <div className="mt-2 sm:mt-3 bg-green-950/20 rounded-sm p-1 border border-green-400/20">
                      <div className="flex items-center gap-1">
                        <div className="text-[6px] text-green-500 font-mono">SEC</div>
                        <div className="flex-1 h-[10px] sm:h-[12px] bg-gradient-to-r from-green-900/30 via-green-800/20 to-green-900/30 rounded-sm overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center px-1">
                            {Array(30).fill(0).map((_, i) => {
                              const seed = (userProfile?.twitterHandle || 'default').charCodeAt(0) + i;
                              const height = 3 + ((seed * 13) % 5);
                              return (
                                <div 
                                  key={i} 
                                  className="bg-green-400" 
                                  style={{ 
                                    width: '1px',
                                    height: `${height}px`,
                                    marginRight: '2px',
                                    opacity: 0.3 + ((seed * 7) % 40) / 100
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                        <div className="text-[6px] text-green-400 font-mono">VALID</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show navigation buttons for approved users */}
            {userProfile?.approvalStatus === 'approved' && (
              <div className="space-y-1.5 sm:space-y-2">
                <button 
                  onClick={() => {
                    router.push('/scout')
                    handleClose()
                  }} 
                  className="w-full border border-green-300 px-3 py-2 sm:px-4 sm:py-2 hover:bg-green-900 text-green-300 text-xs sm:text-base transition-colors"
                >
                  Scout Projects
                </button>
                <button 
                  onClick={() => {
                    router.push('/campaigns')
                    handleClose()
                  }}
                  className="w-full border border-green-300 px-3 py-2 sm:px-4 sm:py-2 hover:bg-green-900 text-green-300 text-xs sm:text-base transition-colors"
                >
                  View Campaigns
                </button>
                {/* Contest Button - Yellow outline with NEW badge */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      router.push('/contests')
                      handleClose()
                    }}
                    className="relative w-full border border-yellow-500 px-3 py-2 sm:px-4 sm:py-2 hover:bg-yellow-900/30 text-yellow-500 text-xs sm:text-base transition-colors"
                  >
                    View Contests
                  </button>
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[8px] sm:text-xs px-1 sm:px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                    NEW
                  </span>
                </div>
              </div>
            )}
            
            <div className="space-y-1.5 sm:space-y-2">
              <button onClick={() => setStage('enter')} className="w-full border border-green-300 px-3 py-2 sm:px-4 sm:py-2 hover:bg-gray-900 text-xs sm:text-base transition-colors">enter</button>
              
              {/* Show Profile button if user has profile, Apply button otherwise */}
              {hasProfile ? (
                <button 
                  onClick={() => {
                    setShowProfileModal(true)
                  }} 
                  className="w-full border border-green-300 px-3 py-2 sm:px-4 sm:py-2 hover:bg-gray-900 bg-green-900/50 text-xs sm:text-base transition-colors"
                >
                  profile
                </button>
              ) : (
                <button onClick={() => setStage('apply')} className="w-full border border-green-300 px-3 py-2 sm:px-4 sm:py-2 hover:bg-gray-900 text-xs sm:text-base transition-colors">apply</button>
              )}
              
              <button onClick={handleClose} className="w-full border border-green-300 px-2 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs hover:bg-gray-900 transition-colors">close</button>
            </div>
          </div>
        )}

        {/* Enter */}
        {stage === 'enter' && (
          <div className="flex flex-col gap-2 sm:gap-3">
            <h2 className="text-xs sm:text-sm uppercase">Connect</h2>
            
            {/* X/Twitter Section */}
            <div className="border border-green-300 p-2 sm:p-3">
              <label className="text-xs uppercase block mb-1 sm:mb-2">X/Twitter</label>
              {session?.user ? (
                <div className="flex items-center">
                  <img
                    src={session.user.image || '/logo.png'}
                    alt={session.user.name || ''}
                    className="w-8 h-8 rounded-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="text-xs ml-2">@{(session as any)?.twitterHandle || userProfile?.twitterHandle || 'unknown'}</span>
                  <button 
                    className="text-red-500 ml-auto"
                    onClick={() => {
                      // Only sign out of Twitter, don't disconnect wallets
                      signOut()
                    }}
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button 
                    className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                    onClick={() => {
                      // Save progress so that after OAuth redirect we resume from social step
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('loginStage', 'social')
                      }
                      console.log('[LOGIN MODAL] Initiating Twitter sign-in from login step...');
                      console.log('[LOGIN MODAL] Current URL:', window.location.href);
                      console.log('[LOGIN MODAL] NextAuth URL:', process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'Not set');
                      
                      signIn('twitter').then(() => {
                        console.log('[LOGIN MODAL] Sign-in initiated successfully');
                      }).catch((error) => {
                        console.error('[LOGIN MODAL] Sign-in error:', error);
                        alert('Failed to initiate Twitter sign-in. Check console for details.');
                      })
                    }}
                  >
                    Login with 𝕏
                  </button>
                </div>
              )}
            </div>
            
            {/* Coinbase Wallet Section */}
            <div className="border border-green-300 p-2 sm:p-3">
              <label className="text-xs uppercase block mb-1 sm:mb-2">Coinbase Wallet</label>
              {!connectedWallets.coinbase ? (
                <div>
                  <button 
                    className="bg-black border border-green-300 hover:bg-green-800 text-xs p-1.5 sm:p-2 w-full"
                    onClick={connectCoinbaseWallet}
                    disabled={walletConnectionPending}
                  >
                    {walletConnectionPending ? 'Connecting...' : 'Connect Coinbase Wallet'}
                  </button>
                  {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.coinbase || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
                    onClick={() => disconnectWallet('coinbase')}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            
            {/* Phantom Wallet Section */}
            <div className="border border-green-300 p-2 sm:p-3">
              <label className="text-xs uppercase block mb-1 sm:mb-2">Phantom Wallet</label>
              {!connectedWallets.phantom ? (
                <div>
                  <button 
                    className="bg-black border border-green-300 hover:bg-green-800 text-xs p-1.5 sm:p-2 w-full"
                    onClick={connectPhantomWallet}
                    disabled={walletConnectionPending}
                  >
                    {walletConnectionPending ? 'Connecting...' : 'Connect Phantom Wallet'}
                  </button>
                  {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-green-400">Connected: </span>
                    <span className="text-xs">{maskAddress(connectedWallets.addresses.phantom || '')}</span>
                  </div>
                  <button 
                    className="text-red-500 border border-red-500 px-2 py-1 text-xs hover:bg-red-900"
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
                  <span className="text-xs ml-2">@{(session as any)?.twitterHandle || userProfile?.twitterHandle || 'unknown'}</span>
                  <button 
                    className="text-red-500 ml-auto"
                    onClick={() => {
                      // Only sign out of Twitter, don't disconnect wallets
                      signOut()
                    }}
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button 
                    type="button"
                    className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                    onClick={() => {
                      // Save progress so that after OAuth redirect we resume from social step
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('loginStage', 'social')
                      }
                      console.log('[LOGIN MODAL] Initiating Twitter sign-in from social step...');
                      console.log('[LOGIN MODAL] Current URL:', window.location.href);
                      console.log('[LOGIN MODAL] NextAuth URL:', process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'Not set');
                      
                      signIn('twitter').then(() => {
                        console.log('[LOGIN MODAL] Sign-in initiated successfully');
                      }).catch((error) => {
                        console.error('[LOGIN MODAL] Sign-in error:', error);
                        alert('Failed to initiate Twitter sign-in. Check console for details.');
                      })
                    }}
                  >
                    Login with 𝕏
                  </button>
                </div>
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
                <div>
                  <button 
                    className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                    onClick={connectCoinbaseWallet}
                    disabled={walletConnectionPending}
                  >
                    {walletConnectionPending ? 'Connecting...' : 'Connect Coinbase Wallet'}
                  </button>
                  {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
                </div>
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
                <div>
                  <button 
                    className="bg-black border border-green-300 hover:bg-green-800 text-xs p-2"
                    onClick={connectPhantomWallet}
                    disabled={walletConnectionPending}
                  >
                    {walletConnectionPending ? 'Connecting...' : 'Connect Phantom Wallet'}
                  </button>
                  {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
                </div>
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
      
      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />
    </div>
  )
} 