import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-zinc-900 mb-4">
        Personalised CV Generator
      </h1>
      <p className="text-lg text-zinc-600 mb-8">
        Upload your biography, paste a job description, and let AI craft a
        tailored CV. Everything runs in your browser — no data is stored on
        our servers.
      </p>

      <div className="space-y-6 mb-12">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold text-zinc-900 mb-2">How it works</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600">
            <li>Enter the job description and optionally enable anonymous mode</li>
            <li>Upload your biography JSON — AI converts it if needed</li>
            <li>Review AI relevance rankings and adjust with sliders</li>
            <li>Preview your CV in real-time, then regenerate for AI-written content</li>
          </ol>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold text-zinc-900 mb-2">Under the hood</h2>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li>LLM handles writing — rules handle dates, locations, and formatting</li>
            <li>Powered by Google AI Studio (Gemini 3.1 Flash Lite) — API key stays on the server</li>
            <li>All AI requests and responses are logged in the debug panel</li>
            <li>JSON responses are validated against strict schemas</li>
            <li>Biography conversion uses declarative key-mapping — raw values stay untouched</li>
            <li>Deterministic IDs link biography items to AI analysis</li>
          </ul>
        </div>
      </div>

      <Link
        href="/generate"
        className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
      >
        Start Generating
      </Link>
    </div>
  );
}
