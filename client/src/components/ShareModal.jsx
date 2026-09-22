import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Copy, 
  Check, 
  Lock, 
  QrCode, 
  Share2, 
  ExternalLink
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function ShareModal({ isOpen, onClose }) {
  const { currentRoom, ipInfo } = useSocket();

  // Resolve share origin: if on localhost/127.0.0.1, use LAN IP so mobile QR code scanning works on local Wi-Fi
  const getShareOrigin = () => {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && ipInfo?.lanIp && ipInfo.lanIp !== '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//${ipInfo.lanIp}${port}`;
    }
    return origin;
  };

  const shareOrigin = getShareOrigin();

  const target = currentRoom ? {
    id: currentRoom.id,
    name: currentRoom.name,
    password: currentRoom.password || '',
    hasPassword: !!currentRoom.hasPassword,
    url: `${shareOrigin}/#room=${encodeURIComponent(currentRoom.id)}`
  } : null;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen && target && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        target.url,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#00ff88'
          }
        },
        (error) => {
          if (error) console.error('QR code error:', error);
        }
      );
    }
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(target.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(target.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyAll = () => {
    const textToCopy = `⚡ VISION ROOM INVITE\n` +
      `• Room ID: ${target.id}\n` +
      `• Password: ${target.hasPassword ? 'Protected' : 'Public'}\n` +
      `• Direct Join Link: ${target.url}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono select-none">
      <div className="w-full max-w-md bg-[#080d17] rounded-2xl border border-[#1a263d] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#161f30] flex items-center justify-between bg-[#0a1120]">
          <div className="flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-[#00f0ff]" />
            <h3 className="font-bold text-sm text-zinc-100">
              Share Room
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* QR Code Frame */}
          <div className="flex flex-col items-center justify-center p-4 bg-[#05080f] rounded-xl border border-[#161f30]">
            <div className="p-2 rounded-lg shadow-lg mb-2 bg-[#00ff88]">
              <canvas ref={canvasRef} className="rounded" />
            </div>
            <p className="text-xs text-zinc-400 flex items-center space-x-1 font-medium">
              <QrCode className="w-3.5 h-3.5 text-[#00ff88]" />
              <span>Scan with mobile phone to join room instantly</span>
            </p>
          </div>

          {/* Room ID Box */}
          <div className="bg-[#05080f] rounded-xl p-3.5 border border-[#1a263d]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-400">
                Room ID
              </span>
              <button
                onClick={handleCopyId}
                className="text-xs text-[#00ff88] hover:underline flex items-center space-x-1 font-semibold"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>
            <p className="text-base font-bold text-[#00f0ff] tracking-wider">
              {target.id}
            </p>
          </div>

          {/* Password Notice */}
          {target.hasPassword && (
            <div className="p-3 bg-[#ffb700]/10 border border-[#ffb700]/30 rounded-xl text-xs text-[#ffb700] flex items-center space-x-2.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>This room is password-protected. Share the password with members so they can enter.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3 bg-[#0b101c] hover:bg-[#111827] text-zinc-200 font-bold text-xs rounded-xl border border-[#1a263d] transition flex items-center justify-center space-x-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <ExternalLink className="w-3.5 h-3.5 text-[#00f0ff]" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="py-2.5 px-3 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center space-x-1.5"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-black" />}
              <span>{copiedAll ? 'Details Copied!' : 'Copy Details'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
