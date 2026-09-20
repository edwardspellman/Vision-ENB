import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Loader2 } from 'lucide-react';
import { getBackendUrl } from '../utils/config';

export default function VoiceRecorder({ onSendAudio, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone permission denied:', err);
      alert('Microphone access is required to record voice notes.');
      onCancel();
    }
  };

  const handleStopAndSend = () => {
    if (!mediaRecorderRef.current) return;

    setIsUploading(true);
    clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('file', audioBlob, `voice-note-${Date.now()}.webm`);

      try {
        const res = await fetch(`${getBackendUrl()}/api/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          onSendAudio({
            fileUrl: data.fileUrl,
            fileName: 'Voice Note',
            fileSize: data.fileSize,
            audioDuration: recordingTime
          });
        } else {
          alert('Upload failed');
        }
      } catch (err) {
        console.error('Upload voice error:', err);
        alert('Network upload failed');
      } finally {
        setIsUploading(false);
      }
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
  };

  const handleCancel = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    onCancel();
  };

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center space-x-3 w-full bg-[#080d17] border border-[#ff3366]/40 rounded-xl p-2.5 shadow-2xl font-mono">
      {/* Recording Beacon */}
      <div className="flex items-center space-x-2 pl-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff3366] animate-ping" />
        <span className="text-xs font-bold text-[#ff3366]">
          {formatSeconds(recordingTime)}
        </span>
      </div>

      {/* Wave Meter */}
      <div className="flex-1 flex items-center space-x-1 h-5 justify-center">
        {[6, 14, 20, 10, 18, 24, 12, 18, 8, 16, 22, 10].map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}px` }}
            className="w-1 bg-[#ff3366]/80 rounded-full wave-bar"
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleCancel}
          disabled={isUploading}
          className="p-2 text-zinc-400 hover:text-[#ff3366] rounded-lg transition"
          title="Cancel"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={handleStopAndSend}
          disabled={isUploading}
          className="flex items-center space-x-1 px-3.5 py-1.5 bg-[#ff3366] hover:bg-[#ff1a53] text-black font-bold text-xs rounded-lg transition shadow-md"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
