'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import VideoCall from './VideoCall';
import { api } from '../../../../lib/api';
import { useToast } from '../../../../lib/toast';
import { bus } from '../../../../lib/bus';
import { getUser } from '../../../../lib/auth';

type Appointment = {
  id: string; title: string; startsAt: string; endsAt: string;
  status: 'PENDING'|'CONFIRMED'|'CANCELLED'; notes?: string | null;
  creatorId: string; inviteeId: string; createdAt: string; updatedAt: string;
};

export default function AppointmentDetailPage() {
  const { push } = useToast();
  const router = useRouter();
  const params = useParams() as { id: string };
  const id = params?.id;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState<Appointment | null>(null);

  const token = useMemo(
    () => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''),
    []
  );
  const me = useMemo(() => getUser(), []);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !token) router.replace('/login');
  }, [mounted, token, router]);

  // fetch detail
  useEffect(() => {
    if (!token || !id) { setLoading(false); return; }
    let ignore = false;
    (async () => {
      try {
        const data = await api<Appointment>(`/appointments/${id}`, { token });
        if (!ignore) setAppt(data);
      } catch (e: any) {
        if (!ignore) {
          push({ title: 'Randevu yüklenemedi', description: String(e.message || e), variant: 'error' });
          router.replace('/appointments');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [id, token, push, router]);

  // ws sync
  useEffect(() => {
    if (!mounted || !token || !id) return;
    const offU1 = bus.on('appointment.updated',   (a) => { if (a.id === id) setAppt(a); });
    const offU2 = bus.on('appointment.cancelled', (a) => { if (a.id === id) setAppt(a); });
    const offD  = bus.on('appointment.deleted',   ({ id: delId }) => {
      if (delId === id) {
        push({ title: 'Randevu silindi', description: 'Listeye dönüldü', variant: 'warning' });
        router.replace('/appointments');
      }
    });
    return () => { offU1(); offU2(); offD(); };
  }, [mounted, token, id, router, push]);

  if (!mounted || !token) return null;

  // Helpers
  const toLocal = (s: string) => { try { return new Date(s).toLocaleString(); } catch { return s; } };
  const isOwner = appt && me?.id === appt.creatorId;

  function toIcsDate(iso: string) {
    // "2025-08-27T07:00:00.000Z" -> "20250827T070000Z"
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }
  function download(filename: string, text: string) {
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }
  function downloadIcs() {
    if (!appt) return;
    const dtStart = toIcsDate(appt.startsAt);
    const dtEnd   = toIcsDate(appt.endsAt);
    const uid = appt.id;
    const summary = (appt.title || 'RandevuX').replace(/\n/g,' ');
    const desc = (appt.notes || '').replace(/\n/g,' ');
    const ics =
        `BEGIN:VCALENDAR
        VERSION:2.0
        PRODID:-//RandevuX//TR
        CALSCALE:GREGORIAN
        METHOD:PUBLISH
        BEGIN:VEVENT
        UID:${uid}
        DTSTAMP:${toIcsDate(new Date().toISOString())}
        DTSTART:${dtStart}
        DTEND:${dtEnd}
        SUMMARY:${summary}
        DESCRIPTION:${desc}
        END:VEVENT
        END:VCALENDAR`;
    download(`appointment-${uid}.ics`, ics);
  }

  async function cancel() {
    if (!appt) return;
    if (!(me?.id === appt.creatorId)) {
    push({ title: 'Yetki yok', description: 'Sadece oluşturan iptal edebilir', variant: 'warning' });
    return;
    }
    try {
      const updated = await api<Appointment>(`/appointments/${id}/cancel`, { method: 'POST', token });
      setAppt(updated);
      push({ title: 'Randevu iptal edildi', description: updated.title, variant: 'warning' });
    } catch (e: any) {
      push({ title: 'İptal başarısız', description: String(e.message || e), variant: 'error' });
    }
  }

  async function del() {
    if (!(me?.id)) return;
    if (!(me?.id === appt?.creatorId)) {
        push({ title: 'Yetki yok', description: 'Sadece oluşturan silebilir', variant: 'warning' });
        return;
    }
    try {
      await api(`/appointments/${id}`, { method: 'DELETE', token });
      push({ title: 'Randevu silindi', description: `id: ${id}`, variant: 'warning' });
      router.replace('/appointments');
    } catch (e: any) {
      push({ title: 'Silinemedi', description: String(e.message || e), variant: 'error' });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {loading ? (
        <div className="opacity-70 text-sm">Yükleniyor…</div>
      ) : !appt ? (
        <div className="opacity-70 text-sm">Randevu bulunamadı.</div>
      ) : (
        <div className="rounded-2xl border shadow-sm p-5 bg-white/70 dark:bg-slate-900/60 backdrop-blur">
          <h1 className="text-2xl font-bold">{appt.title}</h1>
          <div className="mt-2 text-sm opacity-80">
            {toLocal(appt.startsAt)} — {toLocal(appt.endsAt)}
          </div>
          <div className="mt-2 text-xs">
            <span className="px-2 py-0.5 rounded-full border text-[11px]">{appt.status}</span>
          </div>
          {appt.notes && <div className="mt-3 text-sm">{appt.notes}</div>}

          <div className="mt-5 flex items-center gap-2">
            <button onClick={downloadIcs} className="rounded-full h-8 px-3 text-sm border hover:bg-slate-500/10">
                Takvime Ekle (.ics)
            </button>
            {isOwner && appt.status !== 'CANCELLED' && (
                <button onClick={cancel} className="rounded-full h-8 px-3 text-sm border hover:bg-amber-500/10">
                İptal
                </button>
            )}
            {isOwner && (
                <button onClick={del} className="rounded-full h-8 px-3 text-sm border hover:bg-rose-500/10">
                Sil
                </button>
            )}
            {!isOwner && (
                <span className="ml-1 text-xs opacity-60">
                Bu randevuyu yalnızca oluşturan yönetebilir
                </span>
            )}
            <a href="/appointments" className="ml-auto underline text-sm">Listeye dön</a>
          </div>

          {/* Görüntülü görüşme (normal mod) */}
          <VideoCall
            appointmentId={id}
            startsAt={appt.startsAt}
            endsAt={appt.endsAt}
          />
        </div>
      )}
    </div>
  );
}