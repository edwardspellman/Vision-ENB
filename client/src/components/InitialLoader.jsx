import React, { useEffect, useState } from 'react';

const BOOT_LOGS = [
  'Connecting to network...',
  'Locating local Wi-Fi rooms...',
  'Securing real-time connection...',
  'Ready to chat!'
];

export default function InitialLoader({ isReady, onFinish }) {
  const [logIndex, setLogIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev < BOOT_LOGS.length - 1 ? prev + 1 : prev));
    }, 300);

    // Absolute max timeout safety: force finish after 3 seconds max so app is NEVER stuck
    const safetyTimer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        onFinish();
      }, 400);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimer);
    };
  }, [onFinish]);

  useEffect(() => {
    if (isReady && logIndex >= BOOT_LOGS.length - 2) {
      const timer = setTimeout(() => {
        setFadingOut(true);
        setTimeout(() => {
          onFinish();
        }, 400);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, logIndex, onFinish]);

  return (
    <div className={`fixed inset-0 z-50 bg-[#04060a] flex flex-col items-center justify-center font-mono select-none transition-opacity duration-500 ${fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,rgba(0,255,136,0.1)_0%,transparent_70%)]" />

      {/* Wormhole Loader */}
      <div className="relative mb-8">
        <div className="hole">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </div>

        {/* Center Glowing Core */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00ff88] shadow-[0_0_15px_#00ff88]" />
        </div>
      </div>

      {/* Brand Title */}
      <div className="text-center z-10 space-y-1 mb-5">
        <h1 className="font-mono font-black text-lg tracking-widest text-zinc-100">
          Vision<span className="text-[#00ff88]">.</span>
        </h1>
        <p className="text-xs text-zinc-400">
          Instant & Private Messenger
        </p>
      </div>

      {/* Loading Status */}
      <div className="h-6 flex items-center justify-center space-x-2 z-10 text-xs text-zinc-400">
        <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
        <span>{BOOT_LOGS[logIndex]}</span>
      </div>
    </div>
  );
}
