// src/components/InputEngine.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface InputEngineProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
  preservedText?: string;
}

type VoiceState = 'idle' | 'listening' | 'transcribing' | 'unsupported' | 'denied' | 'network' | 'error';

function downsampleTo16k(samples: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return samples;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const indexLow = Math.floor(origIndex);
    const indexHigh = Math.min(indexLow + 1, samples.length - 1);
    const weight = origIndex - indexLow;
    result[i] = samples[indexLow] * (1 - weight) + samples[indexHigh] * weight;
  }
  return result;
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format (1)
  view.setUint16(22, 1, true); // Mono (1 channel)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export default function InputEngine({ onSubmit, isProcessing, preservedText }: InputEngineProps) {
  const [text, setText] = useState(preservedText ?? '');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  const baseTextRef = useRef('');
  const speechCapturedRef = useRef(false);
  const maxAudioLevelRef = useRef(0);

  const updateAudioDevices = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput' && d.deviceId);
        setAudioDevices(mics);
        if (mics.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(mics[0].deviceId);
        }
      } catch {
        // ignore
      }
    }
  }, [selectedDeviceId]);

  // Keep text in sync with preserved text from parent
  useEffect(() => {
    if (preservedText !== undefined) setText(preservedText);
  }, [preservedText]);

  // Check audio recording support on mount & list devices
  useEffect(() => {
    const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const hasSpeech = typeof window !== 'undefined' &&
      (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

    if (!hasMedia && !hasSpeech) {
      setVoiceSupported(false);
      setVoiceState('unsupported');
    }

    updateAudioDevices();
  }, [updateAudioDevices]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
    }
  }, [text]);

  const cleanupAudioStreams = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    pcmChunksRef.current = [];
    isListeningRef.current = false;
    setAudioLevel(0);
  }, []);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      cleanupAudioStreams();
    };
  }, [cleanupAudioStreams]);

  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;

    // Stop native speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // If native speech recognition already captured text, we're done
    if (speechCapturedRef.current) {
      cleanupAudioStreams();
      setVoiceState('idle');
      return;
    }

    const pcmChunks = [...pcmChunksRef.current];
    const sampleRate = audioContextRef.current?.sampleRate || 16000;
    cleanupAudioStreams();

    if (pcmChunks.length === 0) {
      console.warn('[Voice Engine] No audio samples captured');
      setVoiceState('error');
      return;
    }

    let totalSamples = 0;
    for (const chunk of pcmChunks) totalSamples += chunk.length;
    if (totalSamples < sampleRate * 0.2) {
      setVoiceState('error');
      return;
    }

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    setVoiceState('transcribing');

    try {
      const downsampled = downsampleTo16k(merged, sampleRate);
      const wavBlob = encodeWAV(downsampled, 16000);

      // Post directly to /api/transcribe as multipart/form-data (bypasses Server Action limits)
      const formData = new FormData();
      formData.append('audio', wavBlob, 'speech.wav');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Transcribe endpoint returned HTTP ${res.status}`);
      }

      const result = await res.json();

      if (result.success && result.text && result.text.trim().length > 0) {
        const base = baseTextRef.current;
        const transcribed = result.text.trim();
        setText(base ? `${base} ${transcribed}` : transcribed);
        setVoiceState('idle');
      } else {
        console.warn('[Voice Engine] Transcribe returned empty or silent:', result);
        setVoiceState('error');
      }
    } catch (err) {
      console.error('[Voice Engine] Transcribe error:', err);
      setVoiceState('error');
    }
  }, [cleanupAudioStreams]);

  const startListening = useCallback(
    async (overrideDeviceId?: string) => {
      cleanupAudioStreams();

      baseTextRef.current = text.trim();
      speechCapturedRef.current = false;
      pcmChunksRef.current = [];
      maxAudioLevelRef.current = 0;

      const deviceIdToUse = overrideDeviceId || selectedDeviceId;

      let stream: MediaStream;
      try {
        const constraints: MediaStreamConstraints = {
          audio: deviceIdToUse ? { deviceId: { exact: deviceIdToUse } } : true,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStreamRef.current = stream;
        updateAudioDevices();
      } catch (err: any) {
        console.warn('[Voice Engine] Microphone access error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setVoiceState('denied');
        } else {
          setVoiceState('error');
        }
        return;
      }

      isListeningRef.current = true;
      setVoiceState('listening');

      // Setup AudioContext for volume metering AND raw PCM audio recording
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          const source = audioCtx.createMediaStreamSource(stream);

          // Volume meter
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (!isListeningRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let max = 0;
            for (let i = 0; i < dataArray.length; i++) {
              if (dataArray[i] > max) max = dataArray[i];
            }
            maxAudioLevelRef.current = Math.max(maxAudioLevelRef.current, max);
            // Responsive volume percentage scaled to speech frequencies
            const pct = Math.min(100, Math.round((max / 150) * 100));
            setAudioLevel(pct);
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          animFrameRef.current = requestAnimationFrame(updateMeter);

          // Raw PCM recorder via ScriptProcessor
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            if (!isListeningRef.current) return;
            const channel = e.inputBuffer.getChannelData(0);
            pcmChunksRef.current.push(new Float32Array(channel));
          };
          source.connect(processor);

          // Connect to a silent gain node to drive the audio graph without feedback into headphones
          const muteGain = audioCtx.createGain();
          muteGain.gain.value = 0;
          processor.connect(muteGain);
          muteGain.connect(audioCtx.destination);

          processorRef.current = processor;
        }
      } catch (audioCtxErr) {
        console.warn('[Voice Engine] AudioContext init warning:', audioCtxErr);
      }

      // Simultaneously start native SpeechRecognition for instant live feedback
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = navigator.language || 'en-US';

          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
              const result = event.results[i];
              if (result.isFinal) {
                finalTranscript += result[0].transcript + ' ';
              } else {
                interimTranscript += result[0].transcript;
              }
            }

            const sessionTranscript = (finalTranscript + interimTranscript).trim();
            if (sessionTranscript) {
              speechCapturedRef.current = true;
              const base = baseTextRef.current;
              setText(base ? `${base} ${sessionTranscript}` : sessionTranscript);
            }
          };

          recognition.onerror = (event: any) => {
            console.warn('[Voice Engine] SpeechRecognition event:', event.error);
            if (event.error === 'not-allowed') {
              setVoiceState('denied');
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (speechErr) {
          console.warn('[Voice Engine] SpeechRecognition start error:', speechErr);
        }
      }
    },
    [text, selectedDeviceId, cleanupAudioStreams, updateAudioDevices]
  );

  const handleDeviceChange = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    if (isListeningRef.current) {
      startListening(newDeviceId);
    }
  };

  const toggleVoice = () => {
    if (voiceState === 'transcribing') return;
    if (isListeningRef.current || voiceState === 'listening') {
      stopListening();
    } else {
      setVoiceState('idle');
      startListening();
    }
  };

  const handleSubmit = () => {
    if (isListeningRef.current) {
      stopListening();
    }
    if (text.trim() && !isProcessing) {
      onSubmit(text.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const voiceMessage = (() => {
    switch (voiceState) {
      case 'unsupported':
        return "Your browser doesn't support audio recording. Please type your thoughts.";
      case 'denied':
        return 'Microphone permission was blocked. Click the lock or settings icon in your browser URL bar to allow microphone access.';
      case 'network':
        return 'Speech recognition service could not be reached. Try again or type instead.';
      case 'error':
        return "Couldn't detect speech. Check the live volume meter: if it says 'Silent (0% sound)', please choose another microphone from the dropdown or turn up input volume in Windows Sound Settings.";
      default:
        return null;
    }
  })();

  return (
    <div className="input-canvas">
      <div className="input-canvas-inner">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (voiceState !== 'listening' && voiceState !== 'idle') {
              setVoiceState('idle');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Speak or type whatever is on your mind... laundry tonight, email Sarah by Friday, pay electric bill"
          className="input-textarea"
          disabled={isProcessing}
          rows={3}
        />

        {voiceState === 'listening' && (
          <div className="audio-meter-wrapper">
            <span>Mic Volume: <strong>{audioLevel}%</strong></span>
            <div className="audio-meter-track" title={`Volume: ${audioLevel}%`}>
              <div
                className="audio-meter-fill"
                style={{
                  width: `${Math.max(6, audioLevel)}%`,
                  background: audioLevel > 5 ? '#10B981' : '#EF4444',
                }}
              />
            </div>
            <span style={{ color: audioLevel > 5 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
              {audioLevel > 5 ? '● Sound detected' : '○ Silent (0% sound)'}
            </span>
          </div>
        )}

        {voiceState === 'transcribing' && (
          <p className="voice-info-msg">
            Transcribing your voice with AI...
          </p>
        )}

        {voiceMessage && (
          <p className="voice-fallback-msg">{voiceMessage}</p>
        )}

        <div className="input-actions">
          {audioDevices.length > 1 && (
            <select
              className="mic-device-select"
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              title="Select microphone device"
              aria-label="Select microphone"
            >
              {audioDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          {voiceSupported && voiceState !== 'unsupported' && (
            <button
              type="button"
              onClick={toggleVoice}
              className={`mic-button ${voiceState === 'listening' ? 'mic-active' : ''}`}
              disabled={isProcessing || voiceState === 'transcribing'}
              title={
                voiceState === 'listening'
                  ? 'Listening... click to stop'
                  : voiceState === 'transcribing'
                  ? 'Transcribing audio...'
                  : 'Click to speak'
              }
              aria-label={voiceState === 'listening' ? 'Stop recording' : 'Start voice input'}
            >
              {voiceState === 'transcribing' ? (
                <span className="processing-indicator">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </span>
              ) : voiceState === 'listening' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing || !text.trim()}
            className="organize-button"
          >
            {isProcessing ? (
              <span className="processing-indicator">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
            ) : (
              'Organize'
            )}
          </button>
        </div>

        <p className="input-hint">
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to organize
        </p>
      </div>
    </div>
  );
}
