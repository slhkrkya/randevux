'use client';
import { useEffect, useRef } from 'react';
import { useToast } from '../../../lib/toast';
import { connectSocket } from '../../../lib/socket';
import { bus } from '../../../lib/bus';

function myIdFromToken(token: string | null) {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub as string | null;
  } catch { return null; }
}

export default function RealtimeListener() {
  const socketRef = useRef<any>(null);
  const { push } = useToast();

  useEffect(() => {
    const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '');
    const token = getToken();
    const me = myIdFromToken(token);
    const s = connectSocket(() => token);
    // @ts-ignore
    if (!s?.on) return;

    const onConnect = () => push({ title: 'Bağlantı kuruldu', description: 'Realtime aktif', variant: 'success' });    const onCreated = (a: any) => {
    console.log('[ws] created', a);
    if (me && a?.creatorId === me) return; // kendi yarattığın tostu atlıyoruz (önceki kural)
    bus.emit('appointment.created', a);
    push({ title: 'Randevu oluşturuldu', description: a?.title ?? '' });
    };
    const onUpdated = (a: any) => {
    console.log('[ws] updated', a);
    if (me && a?.creatorId === me) return;
    bus.emit('appointment.updated', a);
    push({ title: 'Randevu güncellendi', description: a?.title ?? '' });
    };
    const onCancelled = (a: any) => {
    console.log('[ws] cancelled', a);
    if (me && a?.creatorId === me) return;
    bus.emit('appointment.cancelled', a);
    push({ title: 'Randevu iptal edildi', description: a?.title ?? '', variant: 'warning' });
    };
    const onDeleted = (p: any) => {
    console.log('[ws] deleted', p);
    bus.emit('appointment.deleted', p);
    // kendi sildiysen zaten listede kaldırdın; yine de bilgi vermek istersen:
    if (!(me && p?.by === me)) {
        push({ title: 'Randevu silindi', description: `id: ${p?.id ?? ''}`, variant: 'warning' });
    }
    };

    s.on('connect', onConnect);
    s.on('appointment.created', onCreated);
    s.on('appointment.updated', onUpdated);
    s.on('appointment.cancelled', onCancelled);
    s.on('appointment.deleted', onDeleted);

    socketRef.current = s;
    return () => {
      s.off('connect', onConnect);
      s.off('appointment.created', onCreated);
      s.off('appointment.updated', onUpdated);
      s.off('appointment.cancelled', onCancelled);
      s.off('appointment.deleted', onDeleted);
      s.disconnect();
    };
  }, [push]);

  return null;
}