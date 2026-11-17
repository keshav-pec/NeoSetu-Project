import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
import { Loader2, Lock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage, joinMeeting } from '../api';
import Room from '../components/room/Room';
import { cardClass, inputClass, primaryButton } from '../styles';

const center = 'flex-1 flex flex-col items-center justify-center px-4 text-center';

// Checks access to the meeting (code and passcode), then connects to LiveKit (FR-7 to FR-9)
export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null); // { token, livekitUrl, meetingName, hostId }
  const [error, setError] = useState(null);
  const [askPasscode, setAskPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async (code) => {
    setBusy(true);
    try {
      setDetails(await joinMeeting(id, code));
    } catch (err) {
      if (err.response?.data?.requirePasscode) {
        setAskPasscode(true);
        if (code) toast.error(errorMessage(err));
      } else {
        setError(errorMessage(err));
      }
    }
    setBusy(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { join(); }, [id]);

  if (error) return (
    <div className={center}>
      <XCircle size={48} className="mb-4 text-red-500" />
      <h2 className="text-xl font-bold mb-2">Cannot join meeting</h2>
      <p className="text-gray-500 mb-6">{error}</p>
      <button onClick={() => navigate('/')} className="px-6 py-2 rounded-lg font-medium bg-gray-900 dark:bg-white text-white dark:text-black">Back to home</button>
    </div>
  );

  if (!details && askPasscode) return (
    <div className={center}>
      <form onSubmit={(e) => { e.preventDefault(); join(passcode.trim()); }} className={`w-full max-w-sm p-8 space-y-4 ${cardClass}`}>
        <Lock size={32} className="mx-auto text-cyan-500" />
        <h2 className="text-2xl font-bold">Protected meeting</h2>
        <p className="text-sm text-gray-500">Enter the passcode to join.</p>
        <input maxLength={6} value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode" className={`${inputClass} text-center tracking-widest`} />
        <button disabled={!passcode.trim() || busy} className={primaryButton}>{busy ? 'Checking...' : 'Join'}</button>
        <button type="button" onClick={() => navigate('/')} className="text-sm text-gray-500 hover:underline">Cancel</button>
      </form>
    </div>
  );

  if (!details) return <div className={center}><Loader2 className="w-8 h-8 text-cyan-600 animate-spin" /></div>;

  return (
    <LiveKitRoom
      token={details.token} serverUrl={details.livekitUrl} connect video audio
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.ROOM_DELETED) toast('The meeting has ended');
        navigate('/');
      }}
      onMediaDeviceFailure={() => toast.error('Could not access your camera or microphone')}
    >
      <Room roomName={id} meetingName={details.meetingName} hostId={details.hostId} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
