import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ticketRepository } from '../db/ticketRepository';

vi.mock('../db.js', () => {
  const mockDb = {
    tickets: [
      { ticket_id: 't_1', user_id: 101, provided_recovery_key: 'key1', issue_type: 'recovery_request', status: 'open' },
      { ticket_id: 't_2', user_id: 102, provided_recovery_key: 'key2', issue_type: 'other_request', status: 'resolved' },
    ] as any[],
  };
  return {
    db: mockDb,
    saveDb: vi.fn(),
  };
});

describe('ticketRepository tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find all tickets', () => {
    const list = ticketRepository.findAll();
    expect(list).toHaveLength(2);
  });

  it('should find ticket by ID', () => {
    const t = ticketRepository.findById('t_2');
    expect(t).toBeDefined();
    expect(t?.status).toBe('resolved');
  });

  it('should find open recovery request ticket', () => {
    const t = ticketRepository.findOpenRecoveryRequest(101);
    expect(t).toBeDefined();
    expect(t?.ticket_id).toBe('t_1');
  });

  it('should find ticket by recovery key', () => {
    const t = ticketRepository.findWithRecoveryKey(101, 'key1');
    expect(t).toBeDefined();
    expect(t?.ticket_id).toBe('t_1');
  });
});
