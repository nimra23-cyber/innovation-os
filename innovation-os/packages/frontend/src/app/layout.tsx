import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InnovationOS — AI Startup Accelerator',
  description: 'Transform your idea into a validated startup plan with AI agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">IO</span>
              </div>
              <span className="font-bold text-lg text-foreground">InnovationOS</span>
              <span className="text-xs text-muted-foreground hidden sm:block">AI Startup Accelerator</span>
            </a>
            <a
              href="/projects"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              My Projects
            </a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
