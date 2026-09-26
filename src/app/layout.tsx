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
    // `suppressHydrationWarning` is defence in depth, not a fix. The studio's
    // own gate is the `isMounted` shell in `app/page.tsx`; these two tags are the
    // only nodes this component renders, so an attribute injected by a browser
    // extension, a translation tool or a password manager (theme, data-*,
    // style) is absorbed here instead of escalating to a mismatch that would
    // discard the whole document's server markup. It applies to this element's
    // attributes only, not to the subtree.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-cyan-500 selection:text-black"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
