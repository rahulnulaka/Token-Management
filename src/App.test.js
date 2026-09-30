import { normalizeEntryRow } from './excelUtils';

test('normalizes Excel rows with either Ticket ID header format', () => {
  expect(normalizeEntryRow({
    'Ticket Id': 'B0001',
    Type: 'Buyer',
    'Serial #': 1,
    Name: 'Alice',
    Email: 'alice@example.com',
    Phone: '9876543210',
    Payment: 'Cash',
    Date: '20/09/2026',
    Time: '10:30 AM',
  })).toMatchObject({
    ticketId: 'B0001',
    type: 'B',
    serial: 1,
    name: 'Alice',
    payment: 'Cash',
  });

  expect(normalizeEntryRow({
    'Ticket ID': 'S0002',
    Type: 'Seller',
    'Serial #': 2,
    Name: 'Bob',
    Email: '',
    Phone: '9123456780',
    Payment: 'UPI',
    Date: '20/09/2026',
    Time: '11:00 AM',
  })).toMatchObject({
    ticketId: 'S0002',
    type: 'S',
    serial: 2,
    name: 'Bob',
    payment: 'UPI',
  });
});
