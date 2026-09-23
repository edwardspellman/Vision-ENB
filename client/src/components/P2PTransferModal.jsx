import React from 'react';
import { Download, Upload, Check, X, Zap, ShieldAlert, Clock, Gauge } from 'lucide-react';
import { useWebRTC } from '../context/WebRTCContext';

export default function P2PTransferModal() {
  const { p2pTransfer, acceptP2PTransfer, cancelP2PTransfer } = useWebRTC();

  if (!p2pTransfer) return null;

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatEta = (seconds) => {
    if (!seconds || seconds <= 0) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  };

  const isDone = p2pTransfer.progress === 100;

  // Render Confirmation Prompt for Incoming Transfer Request
  if (p2pTransfer.isPendingAccept) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono select-none">
        <div className="w-full max-w-sm bg-[#080d17] border border-[#00f0ff]/30 rounded-2xl shadow-2xl p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00f0ff]/10 rounded-full blur-xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center space-x-2.5 border-b border-[#161f30] pb-3">
            <div className="p-2.5 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff]">
              <Download className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-wide flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
                <span>Incoming P2P Transfer</span>
              </h3>
              <p className="text-[10px] text-zinc-400">Direct Device-to-Device Stream</p>
            </div>
          </div>

          {/* File Info */}
          <div className="bg-[#05080f] rounded-xl p-3 border border-[#161f30] space-y-1.5">
            <p className="text-xs font-bold text-zinc-100 truncate">
              {p2pTransfer.fileName}
            </p>
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>File Size:</span>
              <span className="text-[#00f0ff] font-bold">{formatBytes(p2pTransfer.fileSize)}</span>
            </div>
            <p className="text-[9px] text-zinc-500 italic pt-1 border-t border-[#161f30]/50">
              * Unlimited 3GB-10GB+ Zero-RAM Disk Stream. Choose save location on disk.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={cancelP2PTransfer}
              className="px-3 py-2.5 bg-[#161f30] hover:bg-[#202c44] text-zinc-300 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1 border border-[#202c44]"
            >
              <X className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
            <button
              onClick={acceptP2PTransfer}
              className="px-3 py-2.5 bg-[#00ff88] hover:bg-[#00e67a] text-black font-extrabold rounded-xl text-xs transition flex items-center justify-center space-x-1 shadow-lg shadow-[#00ff88]/20"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Save & Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Transfer Progress UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono select-none">
      <div className="w-full max-w-sm bg-[#080d17] border border-[#1a263d] rounded-2xl shadow-2xl p-5 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff88]/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#00f0ff]/10 rounded-full blur-xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#161f30] pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88]">
              {p2pTransfer.isSender ? <Upload className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-wide flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-[#00ff88]" />
                <span>P2P Direct Stream</span>
              </h3>
              <p className="text-[10px] text-zinc-400">Zero-Server Storage</p>
            </div>
          </div>

          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20">
            {p2pTransfer.isSender ? 'SENDING' : 'RECEIVING'}
          </span>
        </div>

        {/* File Info */}
        <div className="bg-[#05080f] rounded-xl p-3 border border-[#161f30] space-y-1">
          <p className="text-xs font-bold text-zinc-100 truncate">
            {p2pTransfer.fileName}
          </p>
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>
              {formatBytes(p2pTransfer.transferredBytes || 0)} / <span className="text-zinc-200">{formatBytes(p2pTransfer.fileSize)}</span>
            </span>
            <span className="text-[#00f0ff] font-bold flex items-center space-x-1">
              <Gauge className="w-3 h-3 text-[#00f0ff] inline" />
              <span>{p2pTransfer.speedMBs || '0.0'} MB/s</span>
            </span>
          </div>
        </div>

        {/* Progress Bar & Live Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={isDone ? 'text-[#00ff88]' : 'text-zinc-300'}>
              {p2pTransfer.status}
            </span>
            <span className="text-[#00ff88] font-mono">{p2pTransfer.progress}%</span>
          </div>

          <div className="w-full h-2.5 bg-[#05080f] border border-[#161f30] rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#00f0ff] to-[#00ff88] rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(0,255,136,0.5)]"
              style={{ width: `${p2pTransfer.progress}%` }}
            />
          </div>

          {!isDone && (
            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>ETA: {formatEta(p2pTransfer.etaSeconds)}</span>
              </span>
              <button
                onClick={cancelP2PTransfer}
                className="text-red-400 hover:text-red-300 font-bold hover:underline"
              >
                Cancel Transfer
              </button>
            </div>
          )}
        </div>

        {isDone && (
          <div className="p-2.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-xl text-center text-xs text-[#00ff88] font-bold flex items-center justify-center space-x-1.5 animate-bounce">
            <Check className="w-4 h-4 text-[#00ff88]" />
            <span>Transfer Completed Successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
}
