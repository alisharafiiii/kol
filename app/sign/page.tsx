'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the contracts page
    router.push('/contracts');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-700">Redirecting to contracts...</h2>
      </div>
    </div>
  );
} 