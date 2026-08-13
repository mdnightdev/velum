export function formatLastSeen(lastSeenVal: string | null): string {
  if (!lastSeenVal || lastSeenVal === 'offline') return 'Offline';
  if (lastSeenVal === 'online') return 'Online';
  if (lastSeenVal === 'dnd') return 'DND';
  if (lastSeenVal === 'idle') return 'Idle';

  const date = new Date(lastSeenVal);
  if (isNaN(date.getTime())) return 'Offline';

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seenDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = todayDate.getTime() - seenDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays === 0) {
    return `Last seen at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Last seen yesterday, ${timeStr}`;
  } else if (diffDays < 7 && diffDays > 0) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Last seen ${days[date.getDay()]}, ${timeStr}`;
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `Last seen ${pad(date.getDate())} ${months[date.getMonth()]}`;
  }
}
