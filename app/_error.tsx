'use client'

interface ErrorProps {
  error?: Error;
  statusCode?: number;
}

export default function Error({ error, statusCode }: ErrorProps) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-red-500 mb-4">
          {statusCode || 'Error'}
        </h1>
        <h2 className="text-2xl font-semibold mb-4">
          {statusCode === 404 ? 'Page Not Found' : 'Something went wrong'}
        </h2>
        <p className="text-gray-400 mb-8">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="space-y-4">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-3 bg-green-900 text-green-100 rounded-lg hover:bg-green-800 transition-colors"
          >
            Go to Home
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  )
} 