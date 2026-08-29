import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0F0F23] text-white font-sans antialiased">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-8xl font-extrabold bg-gradient-to-r from-[#7C3AED] via-[#06B6D4] to-[#7C3AED] bg-clip-text text-transparent mb-4">
              404
            </div>
            <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Page Not Found</h1>
            <p className="text-gray-400 mb-8">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
            <Link
              href="/en/dashboard"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              ✨ Back to Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
