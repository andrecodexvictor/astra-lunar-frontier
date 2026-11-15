import { describe, expect, it } from 'vitest';
import { renderResourceHud, resourceDisplay, resourceReminder, resourceReminderTarget } from '../../src/presentation/resourceHud';

describe('resource HUD', () => {
  const reserves = { oxygen: 0.5, battery: 12, potable: 5, food: 3 };
  it('clamps display scales and marks measured low thresholds', () => {
    expect(resourceDisplay('oxygen', 2).ratio).toBe(1);
    expect(resourceDisplay('food', -1).ratio).toBe(0);
    expect(resourceDisplay('oxygen', 0.15).low).toBe(true);
    expect(resourceDisplay('oxygen', 0.151).low).toBe(false);
  });
  it('shows qualitative bars while preserving exact values and scale context', () => {
    const html = renderResourceHud({ ...reserves, oxygen: 0.123456 });
    expect(html).toContain('role="meter"');
    expect(html).toContain('0.123456 kg');
    expect(html).toContain('escala de exibição, não capacidade de armazenamento');
    const visibleText = html.replace(/<[^>]*>/g, '');
    expect(visibleText).not.toContain('0.123456');
    expect(visibleText).not.toContain('kg');
    expect(visibleText).toContain('Baixa');
  });
  it('gives a stable measured reminder only during play', () => {
    const low = { ...reserves, oxygen: 0.1, food: 0.1 };
    expect(resourceReminder(low, false)).toBeNull();
    expect(resourceReminder(low, true)).toContain('alimento');
    expect(resourceReminder(reserves, true)).toBeNull();
    expect(resourceReminderTarget('Confira o cultivo.', true)).toEqual({ cometa: 'Confira o cultivo.', pip: null });
    expect(resourceReminderTarget('Confira o cultivo.', false)).toEqual({ cometa: null, pip: 'Confira o cultivo.' });
  });
});
