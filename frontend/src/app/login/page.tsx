'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../lib/toast';
import { api } from '../../../lib/api';
import { setAuth } from '../../../lib/auth';

export default function LoginPage() {
  const { push } = useToast();
  const router = useRouter();

  // Artık varsayılan değer yok; boş başlıyoruz
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sayfa açılınca "beni hatırla" e-postasını yükle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('remember_email');
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ user: any; token: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      // Beni hatırla → email'i sakla / sil
      if (remember) {
        localStorage.setItem('remember_email', (email || '').trim());
      } else {
        localStorage.removeItem('remember_email');
      }

      setAuth(res.token, res.user);
      push({ title: 'Giriş başarılı', description: res.user.email, variant: 'success' });
      router.replace('/appointments');
    } catch (err: any) {
      push({ title: 'Giriş başarısız', description: String(err.message || err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Giriş Yap</h1>

      {/* Otodoldurmayı kapatıyoruz */}
      <form onSubmit={onSubmit} className="space-y-3" autoComplete="off" noValidate>
        <input
          className="w-full rounded-xl border px-3 py-2"
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          // Otodoldurmayı azaltan ipuçları:
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="randevux-email"
          inputMode="email"
        />

        <input
          className="w-full rounded-xl border px-3 py-2"
          type="password"
          placeholder="Parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Parola yöneticilerinin doldurmasını azaltmak için:
          autoComplete="new-password"
          name="randevux-password"
          spellCheck={false}
        />

        {/* Beni hatırla */}
        <label className="flex items-center gap-2 text-sm opacity-80 select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="checkbox checkbox-sm"
          />
          Beni hatırla (e-postayı kaydet)
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-4 py-2 border shadow-inner"
          style={{ backgroundImage: 'linear-gradient(90deg,hsl(var(--p)),hsl(var(--s)))', color: 'hsl(var(--pc))' }}
        >
          {loading ? 'Gönderiliyor…' : 'Giriş'}
        </button>
      </form>

      <div className="mt-3 text-sm">
        Hesabın yok mu? <a href="/register" className="underline">Kayıt ol</a>
      </div>
    </div>
  );
}