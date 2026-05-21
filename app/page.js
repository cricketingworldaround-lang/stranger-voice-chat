"use client";

import { useState } from "react";
import VoiceChat from "./components/VoiceChat";

export default function Home() {
  const [started, setStarted] = useState(false);

  if (started) return <VoiceChat />;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-lg">
        {/* Icon */}
        <div className="relative flex items-center justify-center w-24 h-24">
          <div className="animate-pulse-ring absolute w-24 h-24 rounded-full bg-indigo-500 opacity-30" />
          <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Talk<span className="text-indigo-400">Stranger</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Anonymous voice chat with random strangers.<br />No sign up. No identity. Just talk.
          </p>
        </div>

        {/* Features */}
        <div className="flex gap-6 text-sm text-zinc-500">
          <span className="flex items-center gap-1">🎙️ Voice only</span>
          <span className="flex items-center gap-1">🔒 Anonymous</span>
          <span className="flex items-center gap-1">⚡ Instant match</span>
        </div>

        {/* Start Button */}
        <button
          onClick={() => setStarted(true)}
          className="w-full max-w-xs py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-150 text-white text-lg font-semibold shadow-xl shadow-indigo-950"
        >
          Start Talking
        </button>

        <p className="text-zinc-600 text-xs">
          By continuing you agree to be respectful. No recording. No harassment.
        </p>
      </div>
    </main>
  );
}