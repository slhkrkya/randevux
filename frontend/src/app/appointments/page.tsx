'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../lib/toast';
import { api, toISO } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import { bus } from '../../../lib/bus';
import Link from 'next/link';

type Appointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: 'PENDING'|'CONFIRMED'|'CANCELLED';
  notes?: string | null;
  creatorId: string;
  inviteeId: string;
  createdAt: string;
  updatedAt: string;
};

export default function AppointmentsPage() {
  const router = useRouter();
  const { push } = useToast();

  // 1) Mount gate (SSR/CSR farkını önlemek için)
  const [mounted, setMounted] = useState(false);

  // 2) Diğer TÜM hook'lar return'dan ÖNCE (hook sırası sabit kalsın)
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Token'ı güvenli şekilde oku (SSR'da window yok)
  const token = useMemo(
    () => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''),
    []
  );

  useEffect(() => { setMounted(true); }, []);

  // 5) GUARD: mounted + token yoksa /login'e yönlendir
  useEffect(() => {
    if (mounted && !token) {
      router.replace('/login');
    }
  }, [mounted, token, router]);
  // 6) Listeyi çek (sadece token varsa)
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let ignore = false;
    (async () => {
      try {
        const list = await api<Appointment[]>('/appointments', { token });
        if (!ignore) setItems(list);
      } catch (e: any) {
        if (!ignore) push({ title: 'Liste yüklenemedi', description: e.message, variant: 'error' });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [token, push]);
  
  useEffect(() => {
    if (!mounted || !token) return;
    const off1 = bus.on('appointment.created', (a) => {
        setItems(prev => {
        if (prev.some(x => x.id === a.id)) return prev; // duplicate koruması
        return [...prev, a].sort((x,y)=>x.startsAt.localeCompare(y.startsAt));
        });
    });
    const off2 = bus.on('appointment.updated', (a) => {
        setItems(prev => prev.map(x => x.id === a.id ? a : x));
    });
    const off3 = bus.on('appointment.cancelled', (a) => {
        setItems(prev => prev.map(x => x.id === a.id ? a : x));
    });
    const off4 = bus.on('appointment.deleted', ({ id }) => {
        setItems(prev => prev.filter(x => x.id !== id));
    });
    return () => { off1(); off2(); off3(); off4(); };
  }, [mounted, token]);

  // 7) SSR ile ilk client çıktısını eşitle: redirect işlemi tamamlanana kadar hiçbir şey çizme
  if (!mounted || !token) return null;

  // --- UI yardımcı ---
  const toLocal = (s: string) => {
    try { return new Date(s).toLocaleString(); } catch { return s; }
  };

  // --- Aksiyonlar ---
  async function createAppointment() {
    try {
      const payload = {
        title,
        startsAt: toISO(startsAt),
        endsAt: toISO(endsAt),
        inviteeEmail,
        notes: notes || undefined,
      };
      const created = await api<Appointment>('/appointments', { method: 'POST', body: payload, token });
      setItems(prev => [...prev, created].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)));
      setTitle(''); setStartsAt(''); setEndsAt(''); setInviteeEmail(''); setNotes('');
      push({ title: 'Randevu oluşturuldu', description: created.title, variant: 'success' });
    } catch (e: any) {
      const msg = e.message || '';
      const desc = msg.includes('OVERLAP') ? 'Saat aralığı çakışıyor' : msg;
      push({ title: 'Oluşturulamadı', description: desc, variant: 'error' });
    }
  }

  async function cancelAppointment(id: string) {
    try {
      const updated = await api<Appointment>(`/appointments/${id}/cancel`, { method: 'POST', token });
      setItems(prev => prev.map(it => it.id === id ? updated : it));
      push({ title: 'Randevu iptal edildi', description: updated.title, variant: 'warning' });
    } catch (e: any) {
      push({ title: 'İptal başarısız', description: e.message, variant: 'error' });
    }
  }

  async function deleteAppointment(id: string) {
    try {
      await api(`/appointments/${id}`, { method: 'DELETE', token });
      setItems(prev => prev.filter(it => it.id !== id));
      push({ title: 'Randevu silindi', description: `id: ${id}`, variant: 'warning' });
    } catch (e: any) {
      push({ title: 'Silinemedi', description: e.message, variant: 'error' });
    }
  }

  // --- UI ---
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Randevular</h1>

      {/* Oluşturma formu */}
      <div className="mt-6 p-4 rounded-2xl border shadow-sm bg-white/70 dark:bg-slate-900/60 backdrop-blur">
        <h2 className="font-semibold mb-3">Yeni Randevu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input input-bordered rounded-xl px-3 py-2 bg-transparent border-slate-300 dark:border-slate-700"
                 placeholder="Başlık"
                 value={title} onChange={e=>setTitle(e.target.value)} />
          <input className="input input-bordered rounded-xl px-3 py-2 bg-transparent border-slate-300 dark:border-slate-700"
                 type="email" placeholder="Davetli e-posta"
                 value={inviteeEmail} onChange={e=>setInviteeEmail(e.target.value)} />
          <label className="text-sm opacity-80">Başlangıç</label>
          <label className="text-sm opacity-80 md:text-right">Bitiş</label>
          <input className="input input-bordered rounded-xl px-3 py-2 bg-transparent border-slate-300 dark:border-slate-700"
                 type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} />
          <input className="input input-bordered rounded-xl px-3 py-2 bg-transparent border-slate-300 dark:border-slate-700"
                 type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)} />
          <textarea className="md:col-span-2 input input-bordered rounded-xl px-3 py-2 bg-transparent border-slate-300 dark:border-slate-700"
                    placeholder="Notlar (opsiyonel)" value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <div className="mt-3">
          <button onClick={createAppointment}
                  className="btn btn-primary rounded-xl px-4 py-2 shadow-inner"
                  style={{ backgroundImage:'linear-gradient(90deg,hsl(var(--p)),hsl(var(--s)))', color:'hsl(var(--pc))' }}>
            Oluştur
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="mt-8">
        <h2 className="font-semibold mb-3">Randevu Listesi</h2>
        {loading ? (
          <div className="opacity-70 text-sm">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="opacity-70 text-sm">Kayıt yok.</div>
        ) : (
          <ul className="space-y-3">
            {items.map(appt => (
              <li key={appt.id}
                  className="rounded-2xl border shadow-sm p-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                        <Link href={`/appointments/${appt.id}`} className="underline hover:opacity-80">
                            {appt.title}
                        </Link>
                    </div>
                    <div className="text-xs opacity-75">
                      {toLocal(appt.startsAt)} — {toLocal(appt.endsAt)}
                    </div>
                    <div className="mt-1 text-xs">
                      <span className="px-2 py-0.5 rounded-full border text-[11px]">
                        {appt.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {appt.status !== 'CANCELLED' && (
                      <button onClick={() => cancelAppointment(appt.id)}
                              className="rounded-full h-8 px-3 text-sm border hover:bg-amber-500/10">
                        İptal
                      </button>
                    )}
                    <button onClick={() => deleteAppointment(appt.id)}
                            className="rounded-full h-8 px-3 text-sm border hover:bg-rose-500/10">
                      Sil
                    </button>
                  </div>
                </div>
                {appt.notes && <div className="mt-2 text-sm opacity-80">{appt.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}