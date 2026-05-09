import axios from 'axios';
import { randomUUID } from 'crypto';

const API_URL = 'http://localhost:5000/api';
const AGENT_TOKEN = 'your_hardcoded_internal_token_here'; // This needs to match the environment variable

async function runAuditTest() {
  console.log('🚀 Starting Reconciliation Audit Verification...');

  try {
    const correlationId = randomUUID();
    const idempotencyKey = `test-sync-${Date.now()}`;

    // 1. Mock a sync event by calling /api/intake/sync directly
    // (In a real scenario, this is called by the Agent Platform)
    console.log('\n--- 1. Simulating Sync Callback ---');
    const syncPayload = {
      correlationId,
      status: 'completed',
      metadata: {
        idempotency_key: idempotencyKey,
        action_taken: 'lead_processed',
        result: { success: true }
      }
    };

    // Note: We need a valid HMAC signature to pass validation if we call the real endpoint.
    // For this test, we'll assume the internal token is enough or we'll mock the storage call.
    // Since we're testing the AUDIT ENDPOINTS, we just need some data in the ledger.

    console.log('Searching for sync audit for correlationId:', correlationId);
    
    // 2. Test /api/audit/sync
    console.log('\n--- 2. Testing /api/audit/sync ---');
    const syncAudit = await axios.get(`${API_URL}/audit/sync`, {
      params: { correlationId },
      headers: { 'X-INTERNAL-TOKEN': AGENT_TOKEN }
    });
    console.log('Sync Audit Response:', JSON.stringify(syncAudit.data, null, 2));

    // 3. Test /api/audit/errors
    console.log('\n--- 3. Testing /api/audit/errors ---');
    const errorAudit = await axios.get(`${API_URL}/audit/errors`, {
      headers: { 'X-INTERNAL-TOKEN': AGENT_TOKEN }
    });
    console.log('Error Audit (First 2):', JSON.stringify(errorAudit.data.entries.slice(0, 2), null, 2));

    console.log('\n✅ Audit Verification Complete!');
  } catch (error: any) {
    console.error('\n❌ Audit Verification Failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// runAuditTest();
