'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, LifeBuoy, Send } from 'lucide-react';
import { useAuth } from '@smileguard/shared-hooks';
import {
  listMySupportRequests,
  submitSupportRequest,
  type MySupportRequest,
} from '@smileguard/supabase-client';

export default function SupportPage() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [requests, setRequests] = useState<MySupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    try {
      setRequests(await listMySupportRequests(userId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    if (!subject.trim() || !message.trim()) {
      setStatus({ tone: 'error', text: 'Please enter a subject and a message.' });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await submitSupportRequest({ userId, subject, message, platform: 'web' });
      setSubject('');
      setMessage('');
      setStatus({ tone: 'success', text: 'Your message was sent to the clinic.' });
      await fetchRequests();
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : 'Could not send your message.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen py-3 sm:py-4 md:py-6 space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 rounded-sm p-4 sm:p-6 text-white border-2 border-emerald-950 shadow-md">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-2">
          <LifeBuoy className="w-6 h-6" />
          Feedback &amp; Support
        </h1>
        <p className="text-emerald-100 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5">
          Send your feedback or questions to the clinic
        </p>
      </div>

      <form onSubmit={handleSubmit} className="skeuo-panel p-3.5 sm:p-5 border-2 border-slate-300 space-y-3">
        <div className="space-y-1">
          <label htmlFor="support-subject" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Subject
          </label>
          <input
            id="support-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="What is this about?"
            className="skeuo-input w-full px-2.5 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="support-message" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Message
          </label>
          <textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Share your feedback or describe the issue"
            className="skeuo-input w-full px-2.5 py-2 text-sm"
          />
        </div>
        {status && (
          <p role="status" className={`text-xs font-semibold ${status.tone === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
            {status.text}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !userId}
          className="skeuo-btn-primary px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>

      <div className="skeuo-panel p-3.5 sm:p-5 border-2 border-slate-300 space-y-2.5">
        <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Your Messages</h2>
        {loading ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : loadError ? (
          <p className="text-xs text-red-700">{loadError}</p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-slate-500">None yet</p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="skeuo-card p-3 rounded-sm border-2 border-slate-300">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">{request.subject || 'No Subject'}</p>
                <span className={`text-[10px] font-black shrink-0 ${request.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {request.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap break-words">{request.message}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">{new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              {request.resolution_note && (
                <div className="flex gap-1.5 bg-emerald-50 border border-emerald-200 rounded-sm p-2 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 whitespace-pre-wrap break-words">{request.resolution_note}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
