export function normalizeEntryRow(row = {}) {
  const rawType = row.Type ?? row.type ?? '';
  const ticketId = row['Ticket ID'] ?? row['Ticket Id'] ?? '';

  return {
    ticketId: ticketId || '',
    type: rawType === 'Buyer' || rawType === 'B' ? 'B' : 'S',
    serial: row['Serial #'] ?? row['Serial No'] ?? 0,
    name: row.Name ?? '',
    email: row.Email ?? '',
    phone: row.Phone ?? '',
    payment: row.Payment ?? '',
    date: row.Date ?? '',
    time: row.Time ?? '',
  };
}
