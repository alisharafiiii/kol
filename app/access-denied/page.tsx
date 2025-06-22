import Link from 'next/link'

export default function AccessDeniedPage() {
  // Log when this page is shown for debugging
  if (typeof window !== 'undefined') {
    console.log('[Access Denied] Page shown at:', new Date().toISOString());
    console.log('[Access Denied] Referrer:', document.referrer);
    console.log('[Access Denied] Current URL:', window.location.href);
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-red-400 p-6 font-sans">
      <div className="border border-red-500 p-8 max-w-md w-full text-center rounded">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="mb-6 text-sm text-red-300">Your Twitter profile is not approved yet. Please contact an admin or try again later.</p>
        <div className="mb-4 text-xs text-red-200">
          <p>If you believe this is an error:</p>
          <ol className="list-decimal list-inside mt-2 text-left">
            <li>Clear your browser cookies</li>
            <li>Log out and log back in</li>
            <li>Contact an admin if the issue persists</li>
          </ol>
        </div>
        <Link href="/">
          <button className="px-4 py-2 border border-red-400 hover:bg-red-900/30 rounded">Return Home</button>
        </Link>
      </div>
    </div>
  )
} 