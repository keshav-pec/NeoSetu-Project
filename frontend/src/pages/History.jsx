import { useEffect, useState } from 'react';
import { Calendar, ChevronDown, FileText, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getHistory } from '../api';

const badge = 'px-2.5 py-0.5 rounded-full text-xs font-medium border';

// List of meetings the user hosted or joined, with AI summaries (FR-25, FR-26)
export default function History() {
  const [meetings, setMeetings] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    getHistory().then(setMeetings).catch(() => { toast.error('Could not load meeting history'); setMeetings([]); });
  }, []);

  if (!meetings) return <Loader2 className="w-8 h-8 mx-auto mt-32 text-cyan-600 animate-spin" />;

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Meeting History</h1>
      {meetings.length === 0 && (
        <p className="p-12 text-center text-gray-500 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl">
          You haven't attended any meetings yet.
        </p>
      )}

      <div className="space-y-4">
        {meetings.map((m) => (
          <div key={m.meetingId} className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{m.name}</h3>
              {m.isHost && <span className={`${badge} bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20`}>Host</span>}
              <span className={`${badge} ${m.isActive ? 'text-green-600 border-green-300 dark:border-green-500/30' : 'text-gray-500 border-gray-300 dark:border-white/10'}`}>
                {m.isActive ? 'Active' : m.summary ? 'Summarized' : 'Ended'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><Calendar size={16} />{new Date(m.date).toLocaleString()}</span>
              <span className="flex items-center gap-1.5"><Users size={16} />{m.participants} participant{m.participants === 1 ? '' : 's'}</span>
              <span className="font-mono">{m.meetingId}</span>
            </div>

            {m.summary && (
              <button onClick={() => setOpenId(openId === m.meetingId ? null : m.meetingId)} className="mt-4 flex items-center gap-2 text-sm font-medium text-cyan-600 dark:text-cyan-400">
                <FileText size={16} /> {openId === m.meetingId ? 'Hide' : 'View'} AI summary
                <ChevronDown size={16} className={openId === m.meetingId ? 'rotate-180' : ''} />
              </button>
            )}
            {openId === m.meetingId && <SummaryDetails data={m.summary} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryDetails({ data }) {
  const heading = 'text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2';
  return (
    <div className="mt-4 p-5 space-y-5 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-white/5 text-sm text-gray-600 dark:text-gray-400">
      <section>
        <h4 className={heading}>Summary</h4>
        <p className="whitespace-pre-wrap leading-relaxed">{data.summary || 'The AI could not generate a summary for this meeting.'}</p>
      </section>

      {data.keyPoints?.length > 0 && (
        <section>
          <h4 className={heading}>Key Points</h4>
          <ul className="list-disc pl-5 space-y-1">{data.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
      )}

      {data.actionItems?.length > 0 && (
        <section>
          <h4 className={heading}>Action Items</h4>
          <table className="w-full text-left">
            <thead><tr className="text-gray-500"><th className="py-1">Task</th><th>Assigned to</th><th>Deadline</th></tr></thead>
            <tbody>
              {data.actionItems.map((a, i) => (
                <tr key={i} className="border-t border-gray-200 dark:border-white/5">
                  <td className="py-1.5 pr-3">{a.task}</td><td className="pr-3">{a.assignee || 'Unassigned'}</td><td>{a.deadline || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <details>
        <summary className={`${heading} cursor-pointer`}>Full Transcript</summary>
        <pre className="whitespace-pre-wrap font-sans max-h-80 overflow-y-auto">{data.transcript}</pre>
      </details>
    </div>
  );
}
