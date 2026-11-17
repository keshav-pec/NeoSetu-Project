import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, Lock, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createMeeting, errorMessage } from '../api';
import { useAuthStore } from '../store';
import { cardClass, inputClass, primaryButton } from '../styles';

// Home page: create a new meeting or join one with a code or link (FR-5 to FR-7)
export default function Home() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const firstName = user?.name.split(' ')[0];

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [meeting, setMeeting] = useState({ name: '', passcode: '' });
  const [joinCode, setJoinCode] = useState('');

  const openModal = () => {
    if (!user) return navigate('/login');
    setMeeting({ name: `${firstName}'s Meeting`, passcode: '' });
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { meetingId } = await createMeeting(meeting);
      toast.success('Meeting created');
      navigate(`/room/${meetingId}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setIsLoading(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    // Accept either a code ("abc-def") or a full meeting link
    const code = joinCode.trim().split('/room/').pop().split(/[/?#]/)[0];
    if (code) navigate(`/room/${code}`);
  };

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-32 text-center">
      <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">{user ? `Hi, ${firstName}` : 'NeoSetu'}</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-12 max-w-2xl font-light">
        Video meetings with live AI captions and automatic meeting summaries
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center w-full sm:w-auto">
        <button onClick={openModal} className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
          <Video size={20} /> New Meeting
        </button>
        <form onSubmit={handleJoin} className="relative w-full sm:w-auto">
          <Keyboard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter a code or link"
            className="w-full sm:w-80 pl-11 pr-24 py-3.5 rounded-xl bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 focus:border-cyan-500 focus:outline-none text-gray-900 dark:text-white placeholder-gray-500"
          />
          <button type="submit" disabled={!joinCode.trim()} className="absolute right-2 top-2 bottom-2 px-5 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 font-medium disabled:opacity-50">
            Join
          </button>
        </form>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleCreate} className={`w-full max-w-md p-6 space-y-5 text-left ${cardClass}`}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Meeting</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>
            </div>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Meeting Name (optional)</span>
              <input value={meeting.name} onChange={(e) => setMeeting({ ...meeting, name: e.target.value })} placeholder="e.g. Project Discussion" className={inputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 flex items-center gap-1.5"><Lock size={14} /> Passcode (optional)</span>
              <input maxLength={6} value={meeting.passcode} onChange={(e) => setMeeting({ ...meeting, passcode: e.target.value.trim() })} placeholder="Up to 6 characters" className={inputClass} />
              <span className="block text-xs text-gray-500 mt-1.5">Leave blank to let anyone with the link join.</span>
            </label>
            <button type="submit" disabled={isLoading} className={primaryButton}>{isLoading ? 'Creating...' : 'Start Meeting'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
