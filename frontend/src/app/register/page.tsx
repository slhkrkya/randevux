'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../lib/toast';
import { api } from '../../../lib/api';
import { setAuth } from '../../../lib/auth';

export default function RegisterPage() {
  const { push } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('Salih');
  const [password, setPassword] = useState('12345678');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ user: any; token: string }>('/auth/register', {
        method: 'POST',
        body: { email, password, name },
      });
      setAuth(res.token, res.user);
      push({ title: 'Kayıt başarılı', description: res.user.email, variant: 'success' });
      router.replace('/appointments');
    } catch (err: any) {
      push({ title: 'Kayıt başarısız', description: String(err.message || err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Kayıt Ol</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded-xl border px-3 py-2"
               type="text" placeholder="Adınız" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full rounded-xl border px-3 py-2"
               type="email" placeholder="E-posta" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full rounded-xl border px-3 py-2"
               type="password" placeholder="Parola" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit" disabled={loading}
                className="rounded-xl px-4 py-2 border shadow-inner"
                style={{ backgroundImage:'linear-gradient(90deg,hsl(var(--p)),hsl(var(--s)))', color:'hsl(var(--pc))' }}>
          {loading ? 'Gönderiliyor…' : 'Kayıt Ol'}
        </button>
      </form>
      <div className="mt-3 text-sm">
        Zaten hesabın var mı? <a href="/login" className="underline">Giriş yap</a>
      </div>
    </div>
  );
}