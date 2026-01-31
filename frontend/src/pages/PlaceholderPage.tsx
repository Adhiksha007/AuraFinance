export default function PlaceholderPage({ title }: { title: string }) {
    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
                <p className="text-gray-500 mt-2 dark:text-gray-400">Coming soon.</p>
            </header>
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center dark:bg-white/5 dark:border-white/10">
                <p className="text-gray-500 dark:text-gray-400">This feature is under development.</p>
            </div>
        </div>
    );
}
