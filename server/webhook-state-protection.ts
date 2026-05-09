/**
 * Webhook State Protection - Prevents status regression
 * Ensures events cannot move status backwards
 */

export const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  soft_bounced: 3,
  opened: 4,
  clicked: 5,
  bounced: 99, // Terminal state
  failed: 99,  // Terminal state
  complained: 99, // Terminal state
};

/**
 * Check if status transition is allowed (forward only)
 * Returns true if newStatus is "ahead" of currentStatus
 */
export function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const currentOrder = STATUS_ORDER[currentStatus] ?? 0;
  const newOrder = STATUS_ORDER[newStatus] ?? 0;
  
  // Allow transition only if new state is ahead or equal
  return newOrder >= currentOrder;
}

/**
 * Get status description for logging
 */
export function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    pending: 'Waiting to send',
    sent: 'Sent to provider',
    delivered: 'Delivered to inbox',
    opened: 'Opened by recipient',
    clicked: 'Link clicked',
    bounced: 'Bounced (hard)',
    soft_bounced: 'Bounced (soft)',
    failed: 'Send failed',
    complained: 'Marked as spam',
  };
  
  return descriptions[status] || status;
}
