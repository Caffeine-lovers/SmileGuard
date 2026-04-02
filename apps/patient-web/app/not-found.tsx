import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">
          🦷
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          Oops! The page you are looking for doesn't exist or has been moved.
        </p>
        <Link 
          href="/dashboard"
          className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
