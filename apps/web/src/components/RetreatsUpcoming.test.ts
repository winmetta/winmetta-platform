import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import RetreatsUpcoming from './RetreatsUpcoming.astro';
import { allRetreats } from '../lib/retreats';
import type { Retreat } from '../lib/schemas';

const past = allRetreats.find((r) => r.id === 'kundadhana-2025-04') as Retreat;
const upcoming: Retreat = {
  ...past,
  id: 'kundadhana-2027-04',
  status: 'upcoming',
  startDate: '2027-04-09',
  endDate: '2027-04-11',
  sessions: [],
};

async function render(retreats: Retreat[], locale: 'en' | 'my' = 'en') {
  const container = await AstroContainer.create();
  return container.renderToString(RetreatsUpcoming, {
    props: { locale, retreats },
  });
}

describe('RetreatsUpcoming', () => {
  it('shows the none-scheduled notice when every retreat is past', async () => {
    const html = await render(allRetreats);
    expect(html).toContain('No retreat is scheduled right now.');
    expect(html).not.toContain('data-upcoming');
  });
  it('lists an upcoming retreat with dates and a detail link, and no notice', async () => {
    const html = await render([...allRetreats, upcoming]);
    expect(html).toContain('Upcoming retreats');
    expect(html).toContain('data-upcoming');
    expect(html).toContain('href="/en/classes/retreats/kundadhana-2027-04/"');
    expect(html).toContain('Apr 9');
    expect(html).toContain('2027');
    expect(html).not.toContain('No retreat is scheduled right now.');
  });
  it('lists them soonest first and works in Burmese', async () => {
    const later = {
      ...upcoming,
      id: 'kundadhana-2028-04',
      startDate: '2028-04-09',
      endDate: '2028-04-11',
    };
    const html = await render([later, upcoming], 'my');
    expect(html.indexOf('kundadhana-2027-04')).toBeLessThan(
      html.indexOf('kundadhana-2028-04'),
    );
    expect(html).toContain('ကျင်းပမည့် တရားစခန်းများ');
  });
});
