'use client';
import { useEffect, useRef } from 'react';
import { useToast } from '../../../lib/toast';
import { connectSocket } from '../../../lib/socket';

export default function RealtimeListener() {
  const socketRef = useRef<any>(null);
  const { push } = useToast();

  useEffect(() => {
    const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '');
    const s = connectSocket(getToken);
    // no-op dönmüşse (token yoksa)
    // @ts-ignore
    if (!s?.on) return;

    socketRef.current = s;

    s.on('connect', () => {
      console.log('[ws] connected:', s.id);
      push({ title: 'Bağlantı kuruldu', description: 'Gerçek zamanlı bildirimler aktif', variant: 'success' });
    });

    s.on('connect_error', (e: any) => {
      console.error('[ws] connect_error:', e?.message);
      push({ title: 'WS bağlantı hatası', description: String(e?.message || 'Unknown'), variant: 'error' });
    });

    s.on('appointment.created', (a: any) => {
      console.log('[ws] created', a);
      push({ title: 'Randevu oluşturuldu', description: a?.title ?? '' , variant: 'success' });
    });
    s.on('appointment.updated', (a: any) => {
      console.log('[ws] updated', a);
      push({ title: 'Randevu güncellendi', description: a?.title ?? '' , variant: 'default' });
    });
    s.on('appointment.cancelled', (a: any) => {
      console.log('[ws] cancelled', a);
      push({ title: 'Randevu iptal edildi', description: a?.title ?? '' , variant: 'warning' });
    });
    s.on('appointment.deleted', (p: any) => {
      console.log('[ws] deleted', p);
      push({ title: 'Randevu silindi', description: `id: ${p?.id ?? ''}`, variant: 'warning' });
    });

    return () => { s.disconnect(); };
  }, [push]);

  return null;
}