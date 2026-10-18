import { formatChatListTime } from '../src/utils/chatTime';

// A fixed "now": Sunday 18 October 2026, 20:00 local time.
const now = new Date(2026, 9, 18, 20, 0).getTime();
const at = (d: number, h = 9, m = 5) => new Date(2026, 9, d, h, m).toISOString();

describe('formatChatListTime (WhatsApp style)', () => {
  it('shows the clock time today', () => expect(formatChatListTime(at(18, 9, 5), now)).toBe('09:05'));
  it('says Yesterday', () => expect(formatChatListTime(at(17, 23, 59), now)).toBe('Yesterday'));
  it('names the weekday within the last week', () => expect(formatChatListTime(at(13), now)).toBe('Tuesday'));
  it('uses a date after that', () => expect(formatChatListTime(at(11), now)).toBe('11/10/2026'));
});
