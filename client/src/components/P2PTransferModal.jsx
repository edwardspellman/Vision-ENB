import React from 'react';
import { Download, Upload, Check, X, Zap } from 'lucide-react';
import { useWebRTC } from '../context/WebRTCContext';

export default function P2PTransferModal() {
  const { p2pTransfer } = useWebRTC();

  if (!p2pTransfer) return null;

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isDone = p2pTransfer.progress === 100;

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
                <Zap className="w-3 h-3 text-[#00ff88]" />
                <span>P2P Direct Stream</span>
              </h3>
              <p className="text-[10px] text-zinc-400">Zero-Server Storage Transfer</p>
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
          <p className="text-[10px] text-zinc-400">
            Size: <span className="text-[#00f0ff] font-semibold">{formatBytes(p2pTransfer.fileSize)}</span>
          </p>
        </div>

        {/* Progress Bar & Status */}
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
