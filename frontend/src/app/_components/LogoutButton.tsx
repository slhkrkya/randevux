'use client';
import { useRouter } from 'next/navigation';
import { clearAuth } from '../../../lib/auth';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => { clearAuth(); router.replace('/login'); }}
      className="rounded-full h-8 px-3 text-sm border hover:bg-slate-500/10"
    >
      Çıkış
    </button>
  );
}
