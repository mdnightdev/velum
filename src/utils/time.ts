function parseTimestamp(timestamp: string | number | null | undefined): Date | null {
  if (!timestamp) return null;
  let date: Date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    const num = Number(timestamp);
    if (!isNaN(num) && String(num) === String(timestamp).trim()) {
      date = new Date(num);
    } else {
      date = new Date(timestamp);
    }
  }
  return isNaN(date.getTime()) ? null : date;
}

function formatHoursMinutes(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function safeFormatTimeOnly(timestamp: string | number | null | undefined): string {
  const date = parseTimestamp(timestamp);
  return date ? formatHoursMinutes(date) : '';
}

export function formatMessageTimestamp(timestamp: string | number | null | undefined): string {
  const date = parseTimestamp(timestamp);
  if (!date) return '';

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = todayDate.getTime() - msgDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays === 0) {
    return formatHoursMinutes(date);
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7 && diffDays > 0) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
}
