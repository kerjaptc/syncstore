/**
 * Simple test page to verify the application is working
 */
export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          StoreSync Test Page
        </h1>
        <p className="text-gray-600 mb-4">
          If you can see this page, the application is working correctly!
        </p>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            ✅ Next.js 15.5.4 with Turbopack
          </p>
          <p className="text-sm text-gray-500">
            ✅ Tailwind CSS v4 styling
          </p>
          <p className="text-sm text-gray-500">
            ✅ Middleware working
          </p>
          <p className="text-sm text-gray-500">
            ✅ Clerk authentication ready
          </p>
        </div>
        <div className="mt-6">
          <a 
            href="/dashboard" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}