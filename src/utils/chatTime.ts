// Chat timestamps in the prototype's style: "2m" / "1d" in the inbox,
// "18:22" under a bubble.

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatMessageTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return new Date(now).toDateString() === date.toDateString()
    ? time
    : `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

// Just the time under a bubble ("18:22"); the day is in the section above.
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// WhatsApp-style day sections: Today, Yesterday, a weekday this week, then a date.
export function formatDayLabel(iso: string, now = Date.now()): string {
  const day = new Date(iso);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date(now)) - start(day)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return day.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = day.getFullYear() === new Date(now).getFullYear();
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}
