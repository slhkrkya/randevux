'use client';
import { io, Socket } from 'socket.io-client';

export function connectSocket(getToken: () => string): Socket {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  const url = `${base}/ws`;

  const token = getToken();
  // Token yoksa şimdilik bağlanma (boşuna hata döngüsü olmasın)
  if (!token) {
    // İstersen burada no-op soket de döndürebilirsin
    // @ts-ignore
    return { on: () => {}, emit: () => {}, disconnect: () => {} } as Socket;
  }

  const socket = io(url, {
    transports: ['websocket'],
    auth: { token }, // Adapter bunu handshake’te okuyacak
    autoConnect: true,
    reconnectionAttempts: 5,
  });

  return socket;
}
