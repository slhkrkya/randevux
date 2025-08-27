import "./globals.css";
import type { ReactNode } from 'react';
import RealtimeListener from "./_components/RealtimeListener";
import { ToastProvider } from "../../lib/toast";
import LogoutButton from "./_components/LogoutButton";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <ToastProvider>
          <header className="px-4 py-2 flex items-center justify-between opacity-80">
            <a href="/" className="font-semibold">RandevuX</a>
            <nav className="flex items-center gap-3">
              <a href="/appointments" className="underline">Randevular</a>
              <a href="/login" className="underline">Giriş</a>
              <a href="/register" className="underline">Kayıt</a>
              <LogoutButton />
            </nav>
          </header>

          {children}
          <RealtimeListener />
        </ToastProvider>
      </body>
    </html>
  );
}