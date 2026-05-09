/**
 * Job State Machine Tests
 * 
 * Tests valid and invalid job status transitions
 */

import { describe, it, expect } from 'vitest';
import {
  validateJobTransition,
  isValidStatus,
  getValidTransitions,
  isTerminalState,
  enforceJobTransition,
} from '../job-state-machine';

describe('Job State Machine', () => {
  describe('validateJobTransition', () => {
    it('should allow valid transition: lead_intake → scheduled', () => {
      const result = validateJobTransition('lead_intake', 'scheduled');
      expect(result.allowed).toBe(true);
      expect(result.from).toBe('lead_intake');
      expect(result.to).toBe('scheduled');
    });

    it('should allow valid transition: lead_intake → cancelled', () => {
      const result = validateJobTransition('lead_intake', 'cancelled');
      expect(result.allowed).toBe(true);
    });

    it('should allow valid transition: scheduled → in_progress', () => {
      const result = validateJobTransition('scheduled', 'in_progress');
      expect(result.allowed).toBe(true);
    });

    it('should allow valid transition: in_progress → completed', () => {
      const result = validateJobTransition('in_progress', 'completed');
      expect(result.allowed).toBe(true);
    });

    it('should reject invalid transition: lead_intake → completed', () => {
      const result = validateJobTransition('lead_intake', 'completed');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });

    it('should reject invalid transition: scheduled → completed', () => {
      const result = validateJobTransition('scheduled', 'completed');
      expect(result.allowed).toBe(false);
    });

    it('should reject invalid transition: completed → scheduled', () => {
      const result = validateJobTransition('completed', 'scheduled');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('terminal state');
    });

    it('should reject invalid transition: cancelled → lead_intake', () => {
      const result = validateJobTransition('cancelled', 'lead_intake');
      expect(result.allowed).toBe(false);
    });

    it('should handle on_hold transitions correctly', () => {
      const result1 = validateJobTransition('scheduled', 'on_hold');
      expect(result1.allowed).toBe(true);

      const result2 = validateJobTransition('on_hold', 'in_progress');
      expect(result2.allowed).toBe(true);

      const result3 = validateJobTransition('on_hold', 'cancelled');
      expect(result3.allowed).toBe(true);
    });

    it('should reject invalid status values', () => {
      const result = validateJobTransition('invalid_status', 'scheduled');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid current status');
    });
  });

  describe('isValidStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidStatus('lead_intake')).toBe(true);
      expect(isValidStatus('scheduled')).toBe(true);
      expect(isValidStatus('in_progress')).toBe(true);
      expect(isValidStatus('completed')).toBe(true);
      expect(isValidStatus('cancelled')).toBe(true);
      expect(isValidStatus('on_hold')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidStatus('invalid')).toBe(false);
      expect(isValidStatus('pending')).toBe(false);
      expect(isValidStatus('')).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for lead_intake', () => {
      const transitions = getValidTransitions('lead_intake');
      expect(transitions).toContain('scheduled');
      expect(transitions).toContain('cancelled');
      expect(transitions.length).toBe(2);
    });

    it('should return valid transitions for scheduled', () => {
      const transitions = getValidTransitions('scheduled');
      expect(transitions).toContain('in_progress');
      expect(transitions).toContain('cancelled');
      expect(transitions).toContain('on_hold');
      expect(transitions.length).toBe(3);
    });

    it('should return empty array for terminal states', () => {
      expect(getValidTransitions('completed')).toEqual([]);
      expect(getValidTransitions('cancelled')).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states', () => {
      expect(isTerminalState('completed')).toBe(true);
      expect(isTerminalState('cancelled')).toBe(true);
    });

    it('should identify non-terminal states', () => {
      expect(isTerminalState('lead_intake')).toBe(false);
      expect(isTerminalState('scheduled')).toBe(false);
      expect(isTerminalState('in_progress')).toBe(false);
      expect(isTerminalState('on_hold')).toBe(false);
    });
  });

  describe('enforceJobTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        enforceJobTransition('lead_intake', 'scheduled');
      }).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => {
        enforceJobTransition('lead_intake', 'completed');
      }).toThrow('Invalid job status transition');
    });
  });
});
