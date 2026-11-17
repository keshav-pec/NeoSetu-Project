import { VideoTrack, useIsSpeaking } from '@livekit/components-react';
import { MicOff } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];

// Same name always gets the same color
export const colorFor = (name = '') => COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

const tag = 'px-1 rounded text-[9px] font-bold uppercase';

export default function VideoTile({ trackRef, isHost, reaction, handRaised, className = '' }) {
  const { participant } = trackRef;
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;
  const color = colorFor(name);

  return (
    <div
      className={`relative rounded-xl overflow-hidden flex items-center justify-center bg-gray-200 dark:bg-[#111] transition-shadow ${className}`}
      style={{ boxShadow: isSpeaking ? `0 0 0 3px ${color}` : 'none' }}
    >
      {trackRef.publication && participant.isCameraEnabled ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
      ) : (
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold uppercase" style={{ background: `${color}22`, color }}>
          {name[0]}
        </div>
      )}

      <div className="absolute top-2 left-2 text-3xl drop-shadow">{handRaised && '✋'}{reaction}</div>
      {!participant.isMicrophoneEnabled && (
        <MicOff size={24} className="absolute top-2 right-2 p-1 rounded-md bg-red-500/20 text-red-500" />
      )}
      <div className="absolute bottom-2 left-2 max-w-[85%] flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium truncate bg-white/80 dark:bg-black/60 backdrop-blur">
        {name}
        {isHost && <span className={`${tag} bg-cyan-500/20 text-cyan-600 dark:text-cyan-400`}>Host</span>}
        {participant.isLocal && <span className={`${tag} bg-gray-500/20`}>You</span>}
      </div>
    </div>
  );
}
