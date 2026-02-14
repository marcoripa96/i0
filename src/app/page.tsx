export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <main className="flex max-w-xl flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight">i0</h1>
        <p className="text-lg text-foreground/70">
          200k+ icons from 150+ open-source collections.
          <br />
          Searchable via MCP.
        </p>
        <div className="flex gap-4">
          <a
            href="/mcp"
            className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            MCP Endpoint
          </a>
          <a
            href="https://github.com/marcoripa96/i0"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-foreground/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            GitHub
          </a>
        </div>
      </main>
    </div>
  );
}
