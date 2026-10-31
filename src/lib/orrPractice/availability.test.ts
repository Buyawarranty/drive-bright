import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_STATE,
  applyTelephonyCallState,
  breakRecycleDue,
  canBeOfferedLeads,
  qualifiesAsInactivity,
  recordInactivity,
  setManualStatus,
  type AvailabilityState,
} from './availability';

const MIN = 60_000;
const NOW = Date.parse('2026-11-02T12:00:00Z');

const busyCall: AvailabilityState = { status: 'busy_call', previousStatus: 'available', breakStartedAt: null };
const onBreak = (startedAt: number): AvailabilityState => ({ status: 'on_break', previousStatus: 'available', breakStartedAt: startedAt });

const fullCtx = {
  claimed: true,
  wasAvailable: true,
  noActivityInAllowedPeriod: true,
  onCallBreakOrException: false,
  technicalFailure: false,
};

describe('ORR availability rules', () => {
  it('only available agents are offered leads', () => {
    expect(canBeOfferedLeads(AVAILABLE_STATE)).toBe(true);
    expect(canBeOfferedLeads(busyCall)).toBe(false);
    expect(canBeOfferedLeads(onBreak(NOW))).toBe(false);
    expect(canBeOfferedLeads({ status: 'offline', previousStatus: 'available', breakStartedAt: null })).toBe(false);
  });

  it('a phone call sets Busy and the call end restores the previous status', () => {
    const onCall = applyTelephonyCallState(AVAILABLE_STATE, true);
    expect(onCall.status).toBe('busy_call');
    expect(applyTelephonyCallState(onCall, false).status).toBe('available');
  });

  it('Break or Offline chosen during a call wins when the call ends', () => {
    const onCall = applyTelephonyCallState(AVAILABLE_STATE, true);
    const brokeMidCall = setManualStatus(onCall, 'on_break', NOW);
    expect(applyTelephonyCallState(brokeMidCall, false).status).toBe('on_break');
  });

  it('break recycling waits for the 60-minute grace period', () => {
    const s = onBreak(NOW);
    expect(breakRecycleDue(s, NOW + 30 * MIN)).toBe(false);
    expect(breakRecycleDue(s, NOW + 61 * MIN)).toBe(true);
  });

  it('never records inactivity for an unclaimed lead', () => {
    expect(qualifiesAsInactivity({ ...fullCtx, claimed: false })).toBe(false);
    const r = recordInactivity('a1', 'l1', NOW, { ...fullCtx, claimed: false }, []);
    expect(r.event).toBeNull();
    expect(r.recycleLead).toBe(false);
  });

  it('never records inactivity during a call, break, exception or technical failure', () => {
    expect(qualifiesAsInactivity({ ...fullCtx, onCallBreakOrException: true })).toBe(false);
    expect(qualifiesAsInactivity({ ...fullCtx, technicalFailure: true })).toBe(false);
    expect(qualifiesAsInactivity({ ...fullCtx, wasAvailable: false })).toBe(false);
  });

  it('a single verified event recycles the lead without a block', () => {
    const r = recordInactivity('a1', 'l1', NOW, fullCtx, []);
    expect(r.event).toEqual({ agentId: 'a1', leadId: 'l1', at: NOW });
    expect(r.recycleLead).toBe(true);
    expect(r.managerReviewDue).toBe(false);
    expect(r.restrictNewClaims).toBe(false);
  });

  it('repeated verified neglect flags a manager review and restricts claims', () => {
    const prior = [
      { agentId: 'a1', leadId: 'l1', at: NOW - 2 * 24 * 60 * MIN },
      { agentId: 'a1', leadId: 'l2', at: NOW - 1 * 24 * 60 * MIN },
    ];
    const r = recordInactivity('a1', 'l3', NOW, fullCtx, prior);
    expect(r.managerReviewDue).toBe(true);
    expect(r.restrictNewClaims).toBe(true);
  });

  it('old events outside the 5-day window do not count towards review', () => {
    const prior = [
      { agentId: 'a1', leadId: 'l1', at: NOW - 9 * 24 * 60 * MIN },
      { agentId: 'a1', leadId: 'l2', at: NOW - 7 * 24 * 60 * MIN },
    ];
    const r = recordInactivity('a1', 'l3', NOW, fullCtx, prior);
    expect(r.managerReviewDue).toBe(false);
  });

  it('a manager can set a manual Busy when telephony is unavailable', () => {
    const s = setManualStatus(AVAILABLE_STATE, 'busy_manual', NOW);
    expect(s.status).toBe('busy_manual');
    expect(canBeOfferedLeads(s)).toBe(false);
    expect(setManualStatus(s, 'available', NOW).status).toBe('available');
  });
});
