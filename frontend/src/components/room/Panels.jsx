import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Video, VideoOff } from 'lucide-react';
import { colorFor } from './VideoTile';

const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const smallButton = 'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300';

// Scrolling list of { from, text, time } used by chat and captions
function MessageList({ items, emptyText }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {items.length === 0 && <p className="mt-8 text-xs text-center text-gray-500">{emptyText}</p>}
      {items.map((item, i) => (
        <div key={i}>
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: colorFor(item.from) }}>
            {item.from} <span className="ml-1 font-normal text-gray-400">{formatTime(item.time)}</span>
          </p>
          <p className="inline-block max-w-full break-words px-3 py-1.5 rounded-xl rounded-tl-none text-sm bg-gray-100 dark:bg-white/5">{item.text}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// Live chat, not saved after the meeting (FR-11)
export function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (text.trim()) onSend(text.trim());
    setText('');
  };

  return (
    <>
      <MessageList emptyText="No messages yet." items={messages.map((m) => ({ from: m.from?.name || m.from?.identity || 'Unknown', text: m.message, time: m.timestamp }))} />
      <form onSubmit={submit} className="flex gap-2 p-2 border-t border-gray-200 dark:border-white/10">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-white/5 focus:outline-none" />
        <button type="submit" disabled={!text.trim()} className="px-2 text-cyan-600 disabled:text-gray-400"><Send size={16} /></button>
      </form>
    </>
  );
}

// Captions made by the AI agent (FR-19)
export const CaptionsPanel = ({ captions }) => (
  <MessageList emptyText="Captions will appear here when people speak." items={captions.map((c) => ({ from: c.speaker, text: c.text, time: c.time }))} />
);

// Participant list with host controls (FR-13, FR-14)
export function ParticipantsPanel({ participants, hostId, amHost, raisedHands, onMute, onRemove }) {
  const sorted = [...participants].sort((a, b) =>
    (b.identity === hostId) - (a.identity === hostId)
    || raisedHands.has(b.identity) - raisedHands.has(a.identity)
    || (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {sorted.map((p) => {
        const name = p.name || p.identity;
        return (
          <div key={p.identity} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold uppercase" style={{ background: `${colorFor(name)}22`, color: colorFor(name) }}>{name[0]}</span>
              <span className="text-sm truncate">{name}{p.isLocal && ' (You)'}{raisedHands.has(p.identity) && ' ✋'}</span>
              {p.identity === hostId && <span className="text-[10px] font-bold uppercase text-cyan-500">Host</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-gray-400">
              {amHost && !p.isLocal && (
                <>
                  {p.isMicrophoneEnabled && <button onClick={() => onMute(p.identity)} className={smallButton}>Mute</button>}
                  <button onClick={() => onRemove(p.identity)} className={smallButton}>Remove</button>
                </>
              )}
              {p.isMicrophoneEnabled ? <Mic size={14} /> : <MicOff size={14} className="text-red-500" />}
              {p.isCameraEnabled ? <Video size={14} /> : <VideoOff size={14} className="text-red-500" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
