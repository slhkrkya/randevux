'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { connectSocket } from '../../../../lib/socket';

type Props = { appointmentId: string; startsAt: string; endsAt: string };

// ICE sunucularını .env'den al (TURN prod için kritik)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: process.env.NEXT_PUBLIC_STUN_URL || 'stun:stun.l.google.com:19302' },
  ...(
    process.env.NEXT_PUBLIC_TURN_URL && process.env.NEXT_PUBLIC_TURN_USER && process.env.NEXT_PUBLIC_TURN_CRED
      ? [{
          urls: [
            process.env.NEXT_PUBLIC_TURN_URL, // örn: turn:turn.example.com:3478?transport=udp
            process.env.NEXT_PUBLIC_TURNS_URL || (process.env.NEXT_PUBLIC_TURN_URL.startsWith('turn:')
              ? process.env.NEXT_PUBLIC_TURN_URL.replace('turn:', 'turns:')
              : undefined),
          ].filter(Boolean) as string[],
          username: process.env.NEXT_PUBLIC_TURN_USER!,
          credential: process.env.NEXT_PUBLIC_TURN_CRED!,
        }]
      : []
  ),
];

export default function VideoCall({ appointmentId, startsAt, endsAt }: Props) {
  const [joined, setJoined]   = useState(false);
  const [status, setStatus]   = useState<'idle'|'connecting'|'in-call'|'error'>('idle');
  const [error, setError]     = useState<string>('');
  const [camOn, setCamOn]     = useState(true);
  const [micOn, setMicOn]     = useState(true);
  const [spkOn, setSpkOn]     = useState(true);
  const [volume, setVolume]   = useState(1);

  const socketRef = useRef<any>(null);
  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const localVideoRef   = useRef<HTMLVideoElement>(null);
  const remoteVideoRef  = useRef<HTMLVideoElement>(null);

  // Katılım penceresi: startsAt-5dk .. endsAt+5dk
  const canJoin = useMemo(() => {
    const now   = Date.now();
    const start = new Date(startsAt).getTime() - 5*60*1000;
    const end   = new Date(endsAt).getTime()   + 5*60*1000;
    return now >= start && now <= end;
  }, [startsAt, endsAt]);

  const countdown = useMemo(() => {
    const now   = Date.now();
    const start = new Date(startsAt).getTime() - 5*60*1000;
    const diff  = start - now;
    if (diff <= 0) return '';
    const m = Math.ceil(diff / 60000);
    return `(${m} dk sonra açılır)`;
  }, [startsAt]);

  useEffect(() => {
    const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '');
    const s = connectSocket(getToken);
    // @ts-ignore no-op döndüyse
    if (!s?.on) { setError('WS bağlantısı yok (token gerekli).'); setStatus('error'); return; }
    socketRef.current = s;

    const onPeerJoined = async ({ from }: { from: string }) => {
      // Odaya SON katılan değil, HALİHAZIRDA odada olan taraf offer üretir
      if (!pcRef.current || !localStreamRef.current) return;
      peerIdRef.current = from;
      try {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        s.emit('webrtc.offer', { appointmentId, to: from, sdp: offer });
      } catch (e) { console.error('offer error', e); }
    };

    const onOffer = async ({ from, sdp }: any) => {
      peerIdRef.current = from;
      if (!pcRef.current) await createPc();
      await pcRef.current!.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current!.createAnswer();
      await pcRef.current!.setLocalDescription(answer);
      s.emit('webrtc.answer', { appointmentId, to: from, sdp: answer });
    };

    const onAnswer = async ({ sdp }: any) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setStatus('in-call');
      try { await remoteVideoRef.current?.play(); } catch {}
    };

    const onIce = async ({ candidate }: any) => {
      if (!pcRef.current || !candidate) return;
      try { await pcRef.current.addIceCandidate(candidate); } catch (e) { console.error(e); }
    };

    const onPeerLeft = () => {
      setStatus('connecting');
      peerIdRef.current = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const onErr = (p: any) => { setError(p?.message || 'webrtc error'); setStatus('error'); };

    s.on('webrtc.peer-joined', onPeerJoined);
    s.on('webrtc.offer', onOffer);
    s.on('webrtc.answer', onAnswer);
    s.on('webrtc.ice', onIce);
    s.on('webrtc.peer-left', onPeerLeft);
    s.on('webrtc.error', onErr);

    return () => {
      s.off('webrtc.peer-joined', onPeerJoined);
      s.off('webrtc.offer', onOffer);
      s.off('webrtc.answer', onAnswer);
      s.off('webrtc.ice', onIce);
      s.off('webrtc.peer-left', onPeerLeft);
      s.off('webrtc.error', onErr);
      s.disconnect();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  async function createPc() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && peerIdRef.current) {
        socketRef.current?.emit('webrtc.ice', { appointmentId, to: peerIdRef.current, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.muted = !spkOn;
        remoteVideoRef.current.volume = volume;
      }
      setStatus('in-call');
    };
    // yerel trackleri ekle
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    }
    pcRef.current = pc;
  }

  async function start() {
    try {
      setStatus('connecting');
      // HTTPS olmadan (localhost hariç) getUserMedia çalışmaz → prod’da HTTPS şart
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      await createPc();
      socketRef.current?.emit('webrtc.join', { appointmentId });
      setJoined(true);
    } catch (e: any) {
      setError(String(e?.message || e));
      setStatus('error');
    }
  }

  function hangup() {
    socketRef.current?.emit('webrtc.leave', { appointmentId });
    cleanup();
    setJoined(false);
    setStatus('idle');
  }

  function cleanup() {
    try {
      pcRef.current?.getSenders().forEach((s) => { try { pcRef.current?.removeTrack(s); } catch {} });
      pcRef.current?.close(); pcRef.current = null;
    } catch {}
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    } catch {}
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  // medya kontrolleri
  function getLocalTrack(kind: 'video'|'audio'): MediaStreamTrack | null {
    const s = localStreamRef.current; if (!s) return null;
    const arr = kind === 'video' ? s.getVideoTracks() : s.getAudioTracks();
    return arr.length ? arr[0] : null;
  }
  function toggleCam() { const t = getLocalTrack('video'); if (!t) return; t.enabled = !t.enabled; setCamOn(t.enabled); }
  function toggleMic() { const t = getLocalTrack('audio'); if (!t) return; t.enabled = !t.enabled; setMicOn(t.enabled); }
  function toggleSpeaker() {
    const v = remoteVideoRef.current; if (!v) return;
    v.muted = !v.muted; setSpkOn(!v.muted); if (!v.muted) { try { v.play(); } catch {} }
  }
  function onVolumeChange(val: number) { setVolume(val); if (remoteVideoRef.current) remoteVideoRef.current.volume = val; }

  return (
    <div className="mt-6 rounded-2xl border p-4">
      <div className="font-semibold mb-2">Görüntülü Görüşme</div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {!joined ? (
          <button
            onClick={start}
            disabled={!canJoin}
            className="rounded-full h-9 px-4 border hover:bg-emerald-500/10 disabled:opacity-50"
            title={canJoin ? 'Odaya katıl' : 'Randevu saatinde aktif olur'}
          >
            Odaya Katıl {canJoin ? '' : ` ${countdown}`}
          </button>
        ) : (
          <button onClick={hangup} className="rounded-full h-9 px-4 border hover:bg-rose-500/10">
            Görüşmeyi Bitir
          </button>
        )}
        <div className="text-sm opacity-70">Durum: {status}</div>
        {error && <div className="text-sm text-rose-600">Hata: {error}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs mb-1 opacity-70">Benim Kameram</div>
          <video ref={localVideoRef} playsInline autoPlay muted className="w-full rounded-xl bg-black/20" />
          {joined && (
            <div className="mt-2 flex items-center gap-2">
              <button onClick={toggleCam} className="rounded-full h-8 px-3 text-sm border">
                {camOn ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
              </button>
              <button onClick={toggleMic} className="rounded-full h-8 px-3 text-sm border">
                {micOn ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs mb-1 opacity-70">Karşı Taraf</div>
          <video ref={remoteVideoRef} playsInline autoPlay className="w-full rounded-xl bg-black/20" />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={toggleSpeaker} className="rounded-full h-8 px-3 text-sm border">
              {spkOn ? 'Hoparlörü Kapat' : 'Hoparlörü Aç'}
            </button>
            <input
              type="range" min={0} max={1} step={0.05}
              value={volume} onChange={(e)=>onVolumeChange(Number(e.target.value))}
              className="w-40" title="Ses seviyesi"
            />
          </div>
        </div>
      </div>
    </div>
  );
}