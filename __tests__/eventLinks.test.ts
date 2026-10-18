import { environment } from '../src/config/environments/selected';
import { eventIdFromLink } from '../src/navigation/eventLinks';

const scheme = environment.linkScheme;

describe('eventIdFromLink', () => {
  it('reads the event id', () => {
    expect(eventIdFromLink(`${scheme}://event/evt_e0cf28419c4f685f67fcd781074ed355`)).toBe('evt_e0cf28419c4f685f67fcd781074ed355');
  });

  it('allows a trailing slash or query', () => {
    expect(eventIdFromLink(`${scheme}://event/evt_1/`)).toBe('evt_1');
    expect(eventIdFromLink(`${scheme}://event/evt_1?src=qr`)).toBe('evt_1');
  });

  it('ignores other links', () => {
    expect(eventIdFromLink(null)).toBeNull();
    expect(eventIdFromLink(`${scheme}://profile/evt_1`)).toBeNull();
    expect(eventIdFromLink('olga-dev://auth?code=x')).toBeNull();
    expect(eventIdFromLink(`other://event/evt_1`)).toBeNull();
    expect(eventIdFromLink(`${scheme}://event/../../x`)).toBeNull();
  });
});
