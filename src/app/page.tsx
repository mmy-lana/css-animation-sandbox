'use client';

import React, { useState } from 'react';
import { Play, Pause, Code, Sparkles, Layers, Sliders } from 'lucide-react';

export default function SandboxPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'inspector' | 'code'>('inspector');

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#09090b] text-zinc-200">
      <header className="flex h-14 items-center justify-between border-b border-[#27272a] bg-[#121217] px-4 md:px-6">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
              KEYFRAME LAB <span className="text-xs font-normal text-cyan-400">v1.0</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center space-x-1.5 rounded-md border border-[#27272a] bg-[#18181f] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'inspector' ? 'code' : 'inspector')}
            className="flex items-center space-x-1.5 rounded-md border border-cyan-500/40 bg-cyan-950/20 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-900/30"
          >
            <Code className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="hidden w-80 flex-col border-r border-[#27272a] bg-[#121217] p-4 md:flex">
          <div className="mb-4 flex items-center space-x-2 border-b border-[#27272a] pb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            <span>Inspector Controls</span>
          </div>
          <div className="space-y-4 text-xs text-zinc-400">
            <div className="rounded border border-[#27272a] bg-[#18181f] p-3">
              <span className="font-semibold text-zinc-300">Active Keyframe: 0%</span>
              <p className="mt-1 text-zinc-500">Transform and style parameters initialized.</p>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-[38dvh] flex-1 items-center justify-center overflow-hidden bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(#1f1f28_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
          <div className="relative flex h-36 w-36 items-center justify-center rounded-2xl border border-cyan-500/50 bg-gradient-to-br from-cyan-950/60 to-purple-950/60 shadow-[0_0_50px_-10px_rgba(0,245,212,0.3)] transition-transform">
            <span className="text-xs font-mono tracking-widest text-cyan-300">PREVIEW</span>
          </div>
        </section>
      </div>

      <footer className="h-44 border-t border-[#27272a] bg-[#121217] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-medium uppercase tracking-wider text-zinc-300">Timeline</span>
          </div>
          <span className="font-mono text-zinc-500">0.00s / 2.00s</span>
        </div>
        <div className="relative mt-4 h-12 w-full rounded-md border border-[#27272a] bg-[#18181f]">
          <div className="absolute left-[0%] top-2 h-8 w-2 -translate-x-1/2 rounded bg-cyan-400 shadow-[0_0_8px_#00f5d4]" />
          <div className="absolute left-[100%] top-2 h-8 w-2 -translate-x-1/2 rounded bg-zinc-600" />
        </div>
      </footer>
    </main>
  );
}
