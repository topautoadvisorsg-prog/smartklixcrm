/**
 * Cache Layer Tests
 * 
 * Tests cache key generation, TTL configuration, and helper functions
 * Note: Does NOT test actual Redis operations (requires Redis server)
 */

import { describe, it, expect } from 'vitest';
import { TTL, cacheKeys } from '../cache';

describe('Cache Layer - Configuration', () => {
  describe('TTL constants', () => {
    it('should have dashboard stats TTL of 60 seconds', () => {
      expect(TTL.DASHBOARD_STATS).toBe(60);
    });

    it('should have contact lookup TTL of 5 minutes', () => {
      expect(TTL.CONTACT_LOOKUP).toBe(300);
    });

    it('should have contact list TTL of 2 minutes', () => {
      expect(TTL.CONTACT_LIST).toBe(120);
    });

    it('should have job list TTL of 2 minutes', () => {
      expect(TTL.JOB_LIST).toBe(120);
    });

    it('should have settings TTL of 5 minutes', () => {
      expect(TTL.SETTINGS).toBe(300);
    });

    it('should have generic TTL of 5 minutes', () => {
      expect(TTL.GENERIC).toBe(300);
    });

    it('should have reasonable TTL values (between 30s and 10min)', () => {
      Object.values(TTL).forEach(ttl => {
        expect(ttl).toBeGreaterThanOrEqual(30);
        expect(ttl).toBeLessThanOrEqual(600);
      });
    });
  });
});

describe('Cache Layer - Key Generation', () => {
  describe('Dashboard keys', () => {
    it('should generate dashboard stats key with user ID', () => {
      const key = cacheKeys.dashboardStats("user-123");
      expect(key).toBe("dashboard:stats:user-123");
    });

    it('should generate dashboard metrics key with date range', () => {
      const key = cacheKeys.dashboardMetrics("7d");
      expect(key).toBe("dashboard:metrics:7d");
    });
  });

  describe('Contact keys', () => {
    it('should generate contact by ID key', () => {
      const key = cacheKeys.contactById("contact-456");
      expect(key).toBe("contact:id:contact-456");
    });

    it('should generate contact by email key', () => {
      const key = cacheKeys.contactByEmail("test@example.com");
      expect(key).toBe("contact:email:test@example.com");
    });

    it('should generate contact by phone key', () => {
      const key = cacheKeys.contactByPhone("+1234567890");
      expect(key).toBe("contact:phone:+1234567890");
    });

    it('should generate contact list key with pagination', () => {
      const key = cacheKeys.contactList(1, 20);
      expect(key).toBe("contacts:list:1:20");
    });
  });

  describe('Job keys', () => {
    it('should generate job by ID key', () => {
      const key = cacheKeys.jobById("job-789");
      expect(key).toBe("job:id:job-789");
    });

    it('should generate job list key without status', () => {
      const key = cacheKeys.jobList();
      expect(key).toBe("jobs:list");
    });

    it('should generate job list key with status', () => {
      const key = cacheKeys.jobList("in_progress");
      expect(key).toBe("jobs:list:in_progress");
    });
  });

  describe('Settings keys', () => {
    it('should generate app settings key', () => {
      const key = cacheKeys.appSettings();
      expect(key).toBe("settings:app");
    });

    it('should generate AI settings key', () => {
      const key = cacheKeys.aiSettings();
      expect(key).toBe("settings:ai");
    });
  });

  describe('Proposal keys', () => {
    it('should generate proposal by ID key', () => {
      const key = cacheKeys.proposalById("proposal-abc");
      expect(key).toBe("proposal:id:proposal-abc");
    });

    it('should generate proposal list key with status', () => {
      const key = cacheKeys.proposalList("pending");
      expect(key).toBe("proposals:list:pending");
    });
  });

  describe('Ledger keys', () => {
    it('should generate ledger entries key with filters', () => {
      const key = cacheKeys.ledgerEntries("status=pending");
      expect(key).toBe("ledger:entries:status=pending");
    });
  });
});

describe('Cache Layer - Key Patterns', () => {
  it('should use colon-separated namespaces', () => {
    const keys = [
      cacheKeys.dashboardStats("user-123"),
      cacheKeys.contactByEmail("test@example.com"),
      cacheKeys.jobById("job-789"),
    ];

    keys.forEach(key => {
      expect(key).toMatch(/^[a-z]+:[a-z]+:/);
    });
  });

  it('should be URL-safe', () => {
    const keys = [
      cacheKeys.contactByEmail("user+test@example.com"),
      cacheKeys.contactByPhone("+1-234-567-890"),
    ];

    keys.forEach(key => {
      expect(key).not.toContain(' ');
      expect(key).not.toContain('\n');
    });
  });

  it('should be deterministic', () => {
    const key1 = cacheKeys.contactByEmail("test@example.com");
    const key2 = cacheKeys.contactByEmail("test@example.com");
    expect(key1).toBe(key2);
  });

  it('should be unique for different inputs', () => {
    const key1 = cacheKeys.contactById("contact-1");
    const key2 = cacheKeys.contactById("contact-2");
    expect(key1).not.toBe(key2);
  });
});

describe('Cache Layer - Cache Invalidation Patterns', () => {
  it('should have consistent contact key prefix for invalidation', () => {
    const keys = [
      cacheKeys.contactById("123"),
      cacheKeys.contactByEmail("test@example.com"),
      cacheKeys.contactByPhone("+1234567890"),
    ];

    keys.forEach(key => {
      expect(key.startsWith("contact:")).toBe(true);
    });
  });

  it('should have consistent jobs key prefix for invalidation', () => {
    const keys = [
      cacheKeys.jobById("123"),
      cacheKeys.jobList("in_progress"),
    ];

    keys.forEach(key => {
      expect(key.startsWith("job")).toBe(true);
    });
  });

  it('should have consistent dashboard key prefix for invalidation', () => {
    const keys = [
      cacheKeys.dashboardStats("user-123"),
      cacheKeys.dashboardMetrics("7d"),
    ];

    keys.forEach(key => {
      expect(key.startsWith("dashboard:")).toBe(true);
    });
  });
});
