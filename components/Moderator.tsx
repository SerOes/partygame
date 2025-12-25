import React, { useEffect, useState, useRef } from 'react';
import { api, Language } from '../src/stores/gameStore';

interface ModeratorProps {
  text: string;
  lang: Language;
  onFinished?: () => void;
}

const Moderator: React.FC<ModeratorProps> = ({ text, lang, onFinished }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!text) return;

    setDisplayText(text);
    speak();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [text, lang]);

  const speak = async () => {
    setIsSpeaking(true);

    try {
      const audioBase64 = await api.generateTTS(text, lang);

      if (audioBase64) {
        await playAudio(audioBase64);
      }
    } catch (error) {
      console.error('TTS Error:', error);
    } finally {
      setIsSpeaking(false);
      onFinished?.();
    }
  };

  const playAudio = async (base64Data: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        // Decode base64 to raw PCM
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create audio context
        const sampleRate = 24000;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        audioContextRef.current = ctx;

        // Convert Int16 PCM to Float32
        const dataInt16 = new Int16Array(bytes.buffer);
        const frameCount = dataInt16.length;
        const buffer = ctx.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);

        for (let i = 0; i < frameCount; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }

        // Play
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();

        source.onended = () => {
          ctx.close();
          resolve();
        };
      } catch (e) {
        console.error('Audio playback error:', e);
        resolve();
      }
    });
  };

  return (
    <div className={`fixed bottom-6 right-6 transition-all duration-500 ${isSpeaking ? 'opacity-100 scale-100' : 'opacity-50 scale-90'}`}>
      <div className="relative">
        {/* Speech bubble */}
        {isSpeaking && displayText && (
          <div className="absolute -top-16 right-0 glass p-3 rounded-xl text-sm max-w-[200px] text-pink-300 mb-2 animate-fade-in">
            "{displayText.substring(0, 60)}{displayText.length > 60 ? '...' : ''}"
            <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white/10"></div>
          </div>
        )}

        {/* Avatar */}
        <div className={`w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center ${isSpeaking ? 'animate-pulse-neon' : ''}`}>
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>

        {/* Sound waves */}
        {isSpeaking && (
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex gap-1">
            <div className="w-1 h-4 bg-pink-400 rounded-full animate-sound-wave" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-6 bg-pink-400 rounded-full animate-sound-wave" style={{ animationDelay: '100ms' }}></div>
            <div className="w-1 h-4 bg-pink-400 rounded-full animate-sound-wave" style={{ animationDelay: '200ms' }}></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Moderator;
