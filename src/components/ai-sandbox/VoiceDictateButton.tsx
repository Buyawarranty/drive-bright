import { useCallback, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Lets the customer dictate their question by voice.
 * Records PCM via Web Audio and uploads a complete WAV file so every browser
 * (including iOS Safari) produces something the transcription model can decode.
 */
function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }

  // Downsample to 16 kHz to keep the upload small.
  const target = 16000;
  const ratio = sampleRate / target;
  const outLength = ratio > 1 ? Math.floor(length / ratio) : length;
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) out[i] = samples[Math.floor(i * ratio)] ?? 0;
  const rate = ratio > 1 ? target : sampleRate;

  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, out.length * 2, true);
  let p = 44;
  for (let i = 0; i < out.length; i++, p += 2) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

type Props = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  /** Compact mic-only button that sits inside the message box. */
  iconOnly?: boolean;
};

export function VoiceDictateButton({ disabled, onTranscript, iconOnly }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'sending'>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const cleanup = useCallback(() => {
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setState('recording');
    } catch {
      toast.error('Microphone access is needed to dictate your question.');
      cleanup();
      setState('idle');
    }
  }, [cleanup]);

  const stop = useCallback(async () => {
    const rate = ctxRef.current?.sampleRate ?? 44100;
    const chunks = chunksRef.current;
    cleanup();
    setState('sending');

    const blob = encodeWav(chunks, rate);
    if (blob.size < 4096) {
      toast.error('That recording was empty — try again and speak clearly.');
      setState('idle');
      return;
    }

    try {
      const form = new FormData();
      form.append('file', blob, 'recording.wav');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sandbox-transcribe`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: form,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.text) {
        toast.error(data?.error || "Couldn't hear that — please try again.");
      } else {
        onTranscript(data.text as string);
      }
    } catch {
      toast.error('Voice input failed — please type your question instead.');
    } finally {
      setState('idle');
    }
  }, [cleanup, onTranscript]);

  const recording = state === 'recording';

  return (
    <button
      type="button"
      disabled={disabled || state === 'sending'}
      onClick={recording ? stop : start}
      aria-label={recording ? 'Stop recording and send to Miles' : 'Dictate your question by voice'}
      title={recording ? 'Stop recording' : 'Speak your question'}
      className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
        recording
          ? 'border-destructive bg-destructive/10 text-destructive'
          : 'border-border bg-background text-foreground hover:bg-muted'
      }`}
    >
      {state === 'sending' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      <span>{state === 'sending' ? 'Transcribing…' : recording ? 'Stop' : 'Speak'}</span>
      {recording && (
        <span className="relative ml-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-destructive opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
      )}
    </button>
  );
}

export default VoiceDictateButton;
