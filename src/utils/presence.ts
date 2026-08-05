export type PresenceStatus = 'online' | 'dnd' | 'idle' | 'offline';

export interface PresenceDetails {
  status: PresenceStatus;
  label: string;
  colorClass: string;
  dotStyle: 'solid' | 'ring';
}

export function parsePresence(lastSeen: string | null): PresenceDetails {
  if (lastSeen === 'online') {
    return {
      status: 'online',
      label: 'Online',
      colorClass: 'bg-status-online',
      dotStyle: 'solid'
    };
  }
  if (lastSeen === 'dnd') {
    return {
      status: 'dnd',
      label: 'Do Not Disturb',
      colorClass: 'bg-rose-500',
      dotStyle: 'solid'
    };
  }
  if (lastSeen === 'idle') {
    return {
      status: 'idle',
      label: 'Idle',
      colorClass: 'border-amber-500',
      dotStyle: 'ring'
    };
  }
  return {
    status: 'offline',
    label: 'Offline',
    colorClass: 'border-velum-600',
    dotStyle: 'ring'
  };
}
