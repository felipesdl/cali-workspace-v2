const monthLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

export function formatOverviewMonth(value: string) {
  const label = monthLabel.format(new Date(`${value}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

export function overviewHours(minutes: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(minutes / 60)} h`;
}
