import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSS Animation Sandbox',
  description: 'High-end creative studio dark mode CSS keyframe editor and animation exporter',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
