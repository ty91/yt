export function Welcome() {
  return (
    <main className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">
        <header className="flex flex-col items-center gap-6 text-center px-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
            Vite + React
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 dark:text-gray-50">
            Welcome to your new frontend
          </h1>
          <p className="max-w-xl text-balance text-gray-600 dark:text-gray-300">
            You are now running a lightweight Vite-powered React application. Edit the code in
            <code className="mx-1 rounded bg-gray-100 px-2 py-1 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
              src
            </code>
            and the page will update instantly.
          </p>
        </header>
        <div className="max-w-[320px] w-full space-y-6 px-4">
          <nav className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700 space-y-4">
            <p className="leading-6 text-gray-700 dark:text-gray-200 text-center">
              Helpful resources
            </p>
            <ul className="space-y-2">
              {resources.map(({ href, label, description }) => (
                <li key={href}>
                  <a
                    className="block rounded-xl border border-transparent p-3 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </main>
  );
}

const resources = [
  {
    href: 'https://vite.dev/guide/',
    label: 'Vite documentation',
    description: 'Configuration, build commands, and deployment guides for Vite.',
  },
  {
    href: 'https://react.dev/learn',
    label: 'React documentation',
    description: 'Refresh your knowledge of React fundamentals and new features.',
  },
  {
    href: 'https://tailwindcss.com/docs',
    label: 'Tailwind CSS docs',
    description: 'Utility classes and recipes for styling your app quickly.',
  },
];
