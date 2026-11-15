/** Display scales for the HUD. These are reference marks, not storage limits. */
export const RESOURCE_DISPLAY_SCALES = { oxygen: 0.5, battery: 12, potable: 5, food: 3 } as const;
export type HudResource = keyof typeof RESOURCE_DISPLAY_SCALES;

const definitions: Record<HudResource, { label: string; icon: string; unit: string; color: string; low: number; reminder: string }> = {
  oxygen: { label: 'O₂', icon: '◉', unit: 'kg', color: '#65d9e8', low: 0.15, reminder: 'A reserva de oxigênio está baixa. Confira o gerador de oxigênio.' },
  battery: { label: 'ENERGIA', icon: '⚡', unit: 'kWh', color: '#ffc86b', low: 1.5, reminder: 'A energia está baixa. Confira os painéis e o consumo.' },
  potable: { label: 'ÁGUA', icon: '💧', unit: 'kg', color: '#77b7ff', low: 1, reminder: 'A água está baixa. Confira o sistema de água.' },
  food: { label: 'ALIMENTO', icon: '🌱', unit: 'kg', color: '#8bc787', low: 0.5, reminder: 'O alimento está baixo. Confira o cultivo.' },
};

export type HudResources = Record<HudResource, number>;
export function resourceDisplay(key: HudResource, value: number) {
  const definition = definitions[key];
  const scale = RESOURCE_DISPLAY_SCALES[key];
  const ratio = Math.max(0, Math.min(1, Number.isFinite(value) ? value / scale : 0));
  const low = value <= definition.low;
  return { ...definition, scale, ratio, low, status: low ? 'Baixa' : ratio <= 0.5 ? 'Atenção' : 'Boa' };
}

export function resourceReminder(resources: HudResources, active: boolean): string | null {
  if (!active) return null;
  // Pick the lowest fraction of its warning threshold, with a stable tie order.
  const keys: HudResource[] = ['oxygen', 'battery', 'potable', 'food'];
  const low = keys.filter((key) => resourceDisplay(key, resources[key]).low)
    .sort((a, b) => resources[a] / definitions[a].low - resources[b] / definitions[b].low)[0];
  return low ? definitions[low].reminder : null;
}

export function resourceReminderTarget(reminder: string | null, cometaEnabled: boolean): { cometa: string | null; pip: string | null } {
  return { cometa: cometaEnabled ? reminder : null, pip: cometaEnabled ? null : reminder };
}

export function renderResourceHud(resources: HudResources, active = true): string {
  return (['oxygen', 'battery', 'potable', 'food'] as HudResource[]).map((key) => {
    const value = resources[key];
    const display = resourceDisplay(key, value);
    const exact = `${display.label}: ${value} ${display.unit}; referência visual ${display.scale} ${display.unit} (escala de exibição, não capacidade de armazenamento); ${display.status}`;
    return `<div class="resource${active && display.low ? ' resource-low' : ''}" style="--resource:${display.color}" title="${exact}">
      <span class="resource-name"><span aria-hidden="true">${display.icon}</span> ${display.label}</span>
      <div class="resource-meter" role="meter" aria-label="${display.label}" aria-valuemin="0" aria-valuemax="${display.scale}" aria-valuenow="${display.ratio * display.scale}" aria-valuetext="${exact}"><span style="width:${display.ratio * 100}%"></span></div>
      <strong>${active && display.low ? '⚠ ' : ''}${display.status}</strong>
    </div>`;
  }).join('');
}
