import Link from 'next/link';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-blue-600">Budget Engine</h1>
                </div>
                <nav className="mt-6">
                    <Link href="/" className="block px-6 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                        Dashboard
                    </Link>
                    <Link href="/transactions" className="block px-6 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                        Transacties
                    </Link>
                    <Link href="/settings" className="block px-6 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                        Instellingen
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
}
