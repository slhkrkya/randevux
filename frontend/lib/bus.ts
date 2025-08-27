'use client';

type EventMap = {
  'appointment.created': any;
  'appointment.updated': any;
  'appointment.cancelled': any;
  'appointment.deleted': { id: string; by?: string };
};

type Handler<T> = (data: T) => void;

export const bus = {
  on<K extends keyof EventMap>(name: K, handler: Handler<EventMap[K]>) {
    const wrapped = ((e: CustomEvent) => handler(e.detail)) as EventListener;
    window.addEventListener(name, wrapped as any);
    return () => window.removeEventListener(name, wrapped as any);
  },
  emit<K extends keyof EventMap>(name: K, data: EventMap[K]) {
    window.dispatchEvent(new CustomEvent(name, { detail: data }));
  },
};