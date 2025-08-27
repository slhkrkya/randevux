'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../lib/toast';
import { getToken, getUser, setAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';

type Me = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { push } = useToast();

  // Mount gate (SSR/CSR farkını önlemek için)
  const [mounted, setMounted] = useState(false);

  // Auth
  const token = useMemo(() => getToken(), []);
  const storedUser = useMemo(() => getUser(), []);

  // Me & Form state
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Name form
  const [name, setName] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Email form (opsiyonel)
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !token) router.replace('/login'); }, [mounted, token, router]);

  // /users/me getir
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let ignore = false;
    (async () => {
      try {
        const data = await api<Me>('/users/me', { token });
        if (!ignore) {
          setMe(data);
          setName(data.name || '');
          setNewEmail(data.email || '');
        }
      } catch (e: any) {
        if (!ignore) {
          push({ title: 'Profil yüklenemedi', description: String(e.message || e), variant: 'error' });
          router.replace('/login');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [token, push, router]);

  if (!mounted || !token) return null;

  // Helpers
  const toLocal = (s: string) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

  // ---- Ad güncelle ----
  async function updateName() {
    if (!name.trim() || name.trim().length < 2) {
      push({ title: 'Ad geçersiz', description: 'En az 2 karakter olmalı', variant: 'warning' });
      return;
    }
    try {
      const updated = await api<Me>('/users/me', { method: 'PATCH', token, body: { name: name.trim() } });
      setMe(updated);
      // localStorage'daki user'ı da güncelle (token değişmiyor)
      if (storedUser) {
        setAuth(token, { ...storedUser, name: updated.name, email: updated.email });
      }
      push({ title: 'Profil güncellendi', description: 'Ad değiştirildi', variant: 'success' });
    } catch (e: any) {
      push({ title: 'Güncellenemedi', description: String(e.message || e), variant: 'error' });
    }
  }

  // ---- Şifre değiştir ----
  async function changePassword() {
    if (!currentPassword || !newPassword) {
      push({ title: 'Eksik bilgi', description: 'Mevcut ve yeni şifre gerekli', variant: 'warning' });
      return;
    }
    if (newPassword.length < 8) {
      push({ title: 'Zayıf şifre', description: 'Yeni şifre en az 8 karakter olmalı', variant: 'warning' });
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)) {
      push({ title: 'Zayıf şifre', description: 'En az bir harf ve bir rakam içermeli', variant: 'warning' });
      return;
    }
    if (currentPassword === newPassword) {
      push({ title: 'Geçersiz', description: 'Yeni şifre eski şifre ile aynı olamaz', variant: 'warning' });
      return;
    }

    setPwSubmitting(true);
    try {
      await api<Me>('/users/me/password', { method: 'PATCH', token, body: { currentPassword, newPassword } });
      setCurrentPassword(''); setNewPassword('');
      push({ title: 'Şifre değişti', description: 'Bir sonraki girişte yeni şifreyi kullan', variant: 'success' });
    } catch (e: any) {
      push({ title: 'Şifre değişmedi', description: String(e.message || e), variant: 'error' });
    } finally {
      setPwSubmitting(false);
    }
  }

  // ---- E-posta değiştir (opsiyonel) ----
  async function changeEmail() {
    const emailOk = /\S+@\S+\.\S+/.test(newEmail);
    if (!emailOk) {
      push({ title: 'E-posta hatalı', description: 'Geçerli bir e-posta gir', variant: 'warning' });
      return;
    }
    if (!emailPassword) {
      push({ title: 'Eksik bilgi', description: 'Mevcut şifre gerekli', variant: 'warning' });
      return;
    }

    setEmailSubmitting(true);
    try {
      const updated = await api<Me>('/users/me/email', {
        method: 'PATCH',
        token,
        body: { currentPassword: emailPassword, newEmail },
      });
      setMe(updated);
      setEmailPassword('');
      // localStorage user'ı güncelle
      if (storedUser) {
        setAuth(token, { ...storedUser, email: updated.email, name: updated.name });
      }
      push({ title: 'E-posta değişti', description: updated.email, variant: 'success' });
    } catch (e: any) {
      push({ title: 'E-posta değişmedi', description: String(e.message || e), variant: 'error' });
    } finally {
      setEmailSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Profil</h1>

      {loading || !me ? (
        <div className="opacity-70 text-sm mt-4">Yükleniyor…</div>
      ) : (
        <>
          {/* Öz bilgi kartı */}
          <div className="mt-4 rounded-2xl border p-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur">
            <div className="text-sm opacity-80">Kullanıcı ID</div>
            <div className="text-xs font-mono break-all">{me.id}</div>
            <div className="mt-2 text-sm opacity-80">Hesap oluşturma</div>
            <div className="text-xs">{toLocal(me.createdAt)}</div>
            <div className="mt-2 text-sm opacity-80">Son güncelleme</div>
            <div className="text-xs">{toLocal(me.updatedAt)}</div>
          </div>

          {/* Ad güncelle */}
          <div className="mt-6 rounded-2xl border p-4">
            <div className="font-semibold mb-2">Ad</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="rounded-xl border px-3 py-2 md:col-span-2"
                value={name}
                onChange={(e)=>setName(e.target.value)}
                placeholder="Adınız"
              />
              <button onClick={updateName} className="rounded-xl border px-4 py-2 hover:bg-emerald-500/10">
                Kaydet
              </button>
            </div>
          </div>

          {/* Şifre değiştir */}
          <div className="mt-6 rounded-2xl border p-4">
            <div className="font-semibold mb-2">Şifre Değiştir</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="password"
                className="rounded-xl border px-3 py-2"
                placeholder="Mevcut şifre"
                value={currentPassword}
                onChange={(e)=>setCurrentPassword(e.target.value)}
              />
              <input
                type="password"
                className="rounded-xl border px-3 py-2"
                placeholder="Yeni şifre (min 8, harf+rakam)"
                value={newPassword}
                onChange={(e)=>setNewPassword(e.target.value)}
              />
              <button
                onClick={changePassword}
                disabled={pwSubmitting}
                className="rounded-xl border px-4 py-2 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {pwSubmitting ? 'Gönderiliyor…' : 'Değiştir'}
              </button>
            </div>
          </div>

          {/* E-posta değiştir (opsiyonel) */}
          <div className="mt-6 rounded-2xl border p-4">
            <div className="font-semibold mb-2">E-posta Değiştir (opsiyonel)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="email"
                className="rounded-xl border px-3 py-2"
                placeholder="Yeni e-posta"
                value={newEmail}
                onChange={(e)=>setNewEmail(e.target.value)}
              />
              <input
                type="password"
                className="rounded-xl border px-3 py-2"
                placeholder="Mevcut şifre"
                value={emailPassword}
                onChange={(e)=>setEmailPassword(e.target.value)}
              />
              <button
                onClick={changeEmail}
                disabled={emailSubmitting}
                className="rounded-xl border px-4 py-2 hover:bg-sky-500/10 disabled:opacity-50"
              >
                {emailSubmitting ? 'Gönderiliyor…' : 'Güncelle'}
              </button>
            </div>
            <div className="text-xs opacity-70 mt-2">
              Not: E-posta değişikliğinde mevcut şifren doğrulanır. E-posta benzersiz olmalıdır.
            </div>
          </div>
        </>
      )}
    </div>
  );
}