import { useEffect, useRef, useState } from 'react';
import { VideoTrack, useChat, useLocalParticipant, useParticipants, useRoomContext, useTracks } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import {
  Hand, MessageSquare, Mic, MicOff, MonitorUp, Moon, Phone, Settings, Share2, SmilePlus, Subtitles, Sun, Users, Video, VideoOff, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { endMeeting, errorMessage, getCaptions } from '../../api';
import { useThemeStore } from '../../store';
import VideoTile from './VideoTile';
import { CaptionsPanel, ChatPanel, ParticipantsPanel } from './Panels';

const EMOJIS = ['❤️', '👍', '😂', '😮', '🎉', '👏'];
const TOPIC = 'neosetu'; // LiveKit data messages for reactions, raised hands and host controls
const PANEL_TITLES = { chat: 'Meeting Chat', captions: 'Live Captions', participants: 'Participants' };
const popup = 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl';

// Short sound for the host when someone raises a hand (FR-12)
function playChime() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.setValueAtTime(1109, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

export default function Room({ roomName, meetingName, hostId }) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const { chatMessages, send } = useChat();
  const { theme, toggleTheme } = useThemeStore();
  const me = localParticipant.identity;
  const amHost = me === hostId;

  const [panel, setPanel] = useState(null); // chat | captions | participants
  const [menu, setMenu] = useState(null);   // settings | reactions | end
  const [reactions, setReactions] = useState({});
  const [raisedHands, setRaisedHands] = useState(new Set());
  const [micsLocked, setMicsLocked] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [newName, setNewName] = useState('');
  const latest = useRef({});
  latest.current = { raisedHands, micsLocked };
  const chatSeen = useRef(0);

  const broadcast = (msg) => localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true, topic: TOPIC });

  const showReaction = (identity, emoji) => {
    setReactions((r) => ({ ...r, [identity]: emoji }));
    setTimeout(() => setReactions(({ [identity]: _, ...rest }) => rest), 4000);
  };

  const setHand = (identity, up) => setRaisedHands((prev) => {
    const next = new Set(prev);
    if (up) next.add(identity); else next.delete(identity);
    return next;
  });

  // Messages from other participants (FR-12, FR-14, FR-15)
  useEffect(() => {
    const onData = (payload, sender, kind, topic) => {
      if (topic !== TOPIC || !sender) return;
      const msg = JSON.parse(new TextDecoder().decode(payload));
      if (msg.type === 'reaction') showReaction(sender.identity, msg.emoji);
      if (msg.type === 'hand') {
        if (msg.up && amHost && !latest.current.raisedHands.has(sender.identity)) playChime();
        setHand(sender.identity, msg.up);
      }

      if (sender.identity !== hostId) return; // only the host may send the controls below
      if (msg.type === 'lock-mics') {
        setMicsLocked(msg.locked);
        if (msg.locked) localParticipant.setMicrophoneEnabled(false);
      }
      if (msg.type === 'mute' && msg.identity === localParticipant.identity) {
        localParticipant.setMicrophoneEnabled(false);
        toast('The host muted your microphone', { icon: '🎙️' });
      }
      if (msg.type === 'remove' && msg.identity === localParticipant.identity) {
        toast.error('You were removed from the meeting by the host');
        room.disconnect();
      }
    };
    // Tell people who join later about raised hands and locked microphones
    const onJoin = () => {
      if (latest.current.raisedHands.has(localParticipant.identity)) broadcast({ type: 'hand', up: true });
      if (amHost && latest.current.micsLocked) broadcast({ type: 'lock-mics', locked: true });
    };
    room.on(RoomEvent.DataReceived, onData).on(RoomEvent.ParticipantConnected, onJoin);
    return () => { room.off(RoomEvent.DataReceived, onData).off(RoomEvent.ParticipantConnected, onJoin); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, localParticipant, hostId, amHost]);

  // Live captions from the AI agent, refreshed every second (FR-19)
  useEffect(() => {
    const timer = setInterval(() => getCaptions(roomName).then(setCaptions).catch(() => {}), 1000);
    return () => clearInterval(timer);
  }, [roomName]);

  // Unread chat badge
  useEffect(() => { if (panel === 'chat') chatSeen.current = chatMessages.length; });
  const unread = panel === 'chat' ? 0 : chatMessages.length - chatSeen.current;

  const toggleMenu = (name) => setMenu((m) => (m === name ? null : name));
  const togglePanel = (name) => setPanel((p) => (p === name ? null : name));

  const toggleMic = () => {
    if (micsLocked && !amHost && !isMicrophoneEnabled) return toast.error('The host has locked microphones', { icon: '🔒' });
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };
  const toggleScreen = () => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    .catch(() => toast.error('Screen sharing is not available'));
  const toggleHand = () => {
    const up = !raisedHands.has(me);
    setHand(me, up);
    broadcast({ type: 'hand', up });
    setMenu(null);
  };
  const sendReaction = (emoji) => {
    showReaction(me, emoji);
    broadcast({ type: 'reaction', emoji });
    setMenu(null);
  };
  const lockMics = (locked) => {
    setMicsLocked(locked);
    broadcast({ type: 'lock-mics', locked });
  };
  const rename = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    localParticipant.setName(newName.trim())
      .then(() => { toast.success('Name updated'); setMenu(null); })
      .catch(() => toast.error('Could not change name'));
  };
  // Everyone is disconnected when the server closes the room (FR-16)
  const endForAll = () => endMeeting(roomName).catch((err) => toast.error(errorMessage(err)));

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );
  const screen = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);
  const gridCols = cameras.length <= 1 ? 'grid-cols-1' : cameras.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3';
  const tile = (t, className) => (
    <VideoTile
      key={t.participant.identity} trackRef={t} className={className} isHost={t.participant.identity === hostId}
      reaction={reactions[t.participant.identity]} handRaised={raisedHands.has(t.participant.identity)}
    />
  );

  return (
    <div className="h-screen flex flex-col gap-3 p-3">
      <header className="flex justify-between items-center px-1">
        <h1 className="font-semibold truncate">{meetingName}<span className="ml-2 text-xs font-mono text-gray-500">{roomName}</span></h1>
        <div className="relative flex gap-2">
          <IconButton title="Participants" active={panel === 'participants'} onClick={() => togglePanel('participants')} icon={Users} />
          <IconButton
            title="Copy invite link" icon={Share2}
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Invite link copied'); }}
          />
          <IconButton
            title="Settings" icon={Settings} active={menu === 'settings'}
            onClick={() => { setNewName(localParticipant.name || ''); toggleMenu('settings'); }}
          />
          {menu === 'settings' && (
            <div className={`absolute right-0 top-11 z-50 w-64 p-4 space-y-4 text-xs ${popup}`}>
              <form onSubmit={rename} className="space-y-2">
                <p className="font-semibold uppercase text-gray-500">Display name</p>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-white/5 focus:outline-none" />
                <button className="w-full py-1.5 rounded-lg font-medium bg-cyan-600 hover:bg-cyan-500 text-white">Save name</button>
              </form>
              {amHost && (
                <label className="flex items-center justify-between cursor-pointer">
                  Lock everyone's microphones
                  <input type="checkbox" checked={micsLocked} onChange={(e) => lockMics(e.target.checked)} className="w-4 h-4 accent-cyan-600" />
                </label>
              )}
              <button onClick={toggleTheme} className="w-full flex items-center justify-between">
                {theme === 'dark' ? 'Light' : 'Dark'} theme {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex gap-3 min-h-0 relative">
        {screen ? (
          <main className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
            <div className="flex-1 relative rounded-xl overflow-hidden bg-black">
              <VideoTrack trackRef={screen} className="w-full h-full object-contain" />
              <span className="absolute bottom-3 left-3 px-3 py-1 rounded-lg text-xs text-white bg-cyan-600/90">
                {screen.participant.name || screen.participant.identity}'s screen
              </span>
            </div>
            <div className="flex lg:flex-col gap-2 overflow-auto lg:w-64 shrink-0">
              {cameras.map((t) => tile(t, 'w-48 lg:w-full aspect-video shrink-0'))}
            </div>
          </main>
        ) : (
          <main className={`flex-1 grid ${gridCols} auto-rows-fr gap-3 min-h-0`}>
            {cameras.map((t) => tile(t, 'w-full h-full'))}
          </main>
        )}

        {panel && (
          <aside className="absolute inset-0 z-30 sm:static sm:w-80 flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10">
            <div className="flex justify-between items-center p-3 text-sm font-semibold border-b border-gray-200 dark:border-white/10">
              {PANEL_TITLES[panel]}{panel === 'participants' && ` (${participants.length})`}
              <button onClick={() => setPanel(null)}><X size={16} /></button>
            </div>
            {panel === 'chat' && <ChatPanel messages={chatMessages} onSend={send} />}
            {panel === 'captions' && <CaptionsPanel captions={captions} />}
            {panel === 'participants' && (
              <ParticipantsPanel
                participants={participants} hostId={hostId} amHost={amHost} raisedHands={raisedHands}
                onMute={(identity) => broadcast({ type: 'mute', identity })}
                onRemove={(identity) => broadcast({ type: 'remove', identity })}
              />
            )}
          </aside>
        )}
      </div>

      <footer className="self-center flex items-center gap-1 sm:gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 shadow-lg">
        <ControlButton label={isMicrophoneEnabled ? 'Mute' : 'Unmute'} icon={isMicrophoneEnabled ? Mic : MicOff} off={!isMicrophoneEnabled} onClick={toggleMic} />
        <ControlButton
          label={isCameraEnabled ? 'Stop video' : 'Start video'} icon={isCameraEnabled ? Video : VideoOff} off={!isCameraEnabled}
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        />
        <div className="relative">
          <ControlButton label="React" icon={SmilePlus} active={menu === 'reactions'} onClick={() => toggleMenu('reactions')} />
          {menu === 'reactions' && (
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 p-2 space-y-2 ${popup}`}>
              <button onClick={toggleHand} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-white/5">
                <Hand size={16} /> {raisedHands.has(me) ? 'Lower hand' : 'Raise hand'}
              </button>
              <div className="flex">
                {EMOJIS.map((e) => <button key={e} onClick={() => sendReaction(e)} className="text-2xl p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10">{e}</button>)}
              </div>
            </div>
          )}
        </div>

        <div className="relative mx-1 sm:mx-2">
          <button
            title={amHost ? 'End or leave' : 'Leave meeting'} onClick={() => (amHost ? toggleMenu('end') : room.disconnect())}
            className="p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white"
          >
            <Phone size={22} className="rotate-[135deg]" />
          </button>
          {menu === 'end' && (
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-48 p-1.5 text-sm ${popup}`}>
              <button onClick={endForAll} className="w-full text-left px-3 py-2 rounded-lg font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">End meeting for all</button>
              <button onClick={() => room.disconnect()} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">Leave meeting</button>
            </div>
          )}
        </div>

        <ControlButton label="Share" icon={MonitorUp} active={isScreenShareEnabled} onClick={toggleScreen} />
        <ControlButton label="Chat" icon={MessageSquare} active={panel === 'chat'} badge={unread} onClick={() => togglePanel('chat')} />
        <ControlButton label="Captions" icon={Subtitles} active={panel === 'captions'} onClick={() => togglePanel('captions')} />
      </footer>
    </div>
  );
}

function IconButton({ icon: Icon, title, active, onClick }) {
  return (
    <button
      title={title} onClick={onClick}
      className={`p-2 rounded-xl ${active ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10'}`}
    >
      <Icon size={16} />
    </button>
  );
}

function ControlButton({ icon: Icon, label, onClick, active, off, badge }) {
  const color = off ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
    : active ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5';
  return (
    <button title={label} onClick={onClick} className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl ${color}`}>
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold bg-red-500 text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <Icon size={20} />
      <span className="hidden sm:block text-[10px] font-medium">{label}</span>
    </button>
  );
}
