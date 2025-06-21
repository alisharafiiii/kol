'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import Link from 'next/link';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  useEffect(() => {
    // Log the error details to console for debugging
    console.error('[AUTH ERROR PAGE]', {
      error: error,
      allParams: Object.fromEntries(searchParams.entries()),
      timestamp: new Date().toISOString()
    });
  }, [error, searchParams]);

  const getErrorMessage = () => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration. Check if your Twitter App settings are correct.';
      case 'AccessDenied':
        return 'You denied access to your Twitter account. Please try again and click "Authorize app".';
      case 'Verification':
        return 'The verification token has expired or has already been used. Please try signing in again.';
      case 'OAuthSignin':
        return 'Error constructing an authorization URL. Check your Twitter App OAuth settings.';
      case 'OAuthCallback':
        return 'Error handling the response from Twitter. This often indicates a callback URL mismatch.';
      case 'OAuthCreateAccount':
        return 'Could not create user account. Please try again.';
      case 'EmailCreateAccount':
        return 'Could not create email account. Please try again.';
      case 'Callback':
        return 'Twitter callback error. Make sure your callback URLs match exactly in your Twitter App settings.';
      case 'Default':
        return 'An unexpected error occurred during authentication.';
      default:
        return `Authentication error: ${error || 'Unknown error'}`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-red-600 mb-4">
              Authentication Error
            </h2>
            <p className="text-gray-600 mb-6">
              {getErrorMessage()}
            </p>
            
            {error === 'OAuthCallback' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6 text-left">
                <p className="text-sm text-yellow-800 font-semibold mb-2">
                  Common causes:
                </p>
                <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                  <li>Callback URL mismatch in Twitter App settings</li>
                  <li>Using https:// instead of http:// for localhost</li>
                  <li>Missing or incorrect OAuth 2.0 configuration</li>
                  <li>Expired or invalid client credentials</li>
                </ul>
              </div>
            )}

            <div className="bg-gray-50 rounded-md p-4 mb-6 text-left">
              <p className="text-xs text-gray-500 font-mono">
                Error Code: {error || 'unknown'}<br />
                Timestamp: {new Date().toISOString()}
              </p>
            </div>

            <Link 
              href="/"
              className="inline-block w-full bg-blue-500 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
            >
              Try Again
            </Link>

            <p className="text-xs text-gray-500 mt-4">
              Check the browser console for more details
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
} 