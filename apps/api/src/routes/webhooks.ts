/**
 * Webhook routes for payment provider callbacks.
 * Receives and processes payment status updates from external payment providers.
 * No authentication required (webhook authenticity verified via signature).
 */

import { Router } from 'express';
import { failure, success } from '../lib/api-response';
import { WebhookVerifier } from '../lib/webhook-verification';
import { handleWebhookReconciliation } from '../lib/webhook-handler';
import { DemoPaymentProvider } from '../lib/payment-provider';

const router = Router();
const webhookVerifier = new WebhookVerifier();

/**
 * POST /webhooks/payment-provider
 * Receive webhook notifications from payment provider.
 * Verifies HMAC-SHA256 signature and processes status updates.
 *
 * Expected headers:
 * - X-Webhook-Signature: HMAC-SHA256 signature of raw body
 * - Content-Type: application/json
 *
 * Expected body:
 * {
 *   event: "payment.completed|payment.failed|payment.refunded|payment.pending",
 *   transactionId: "provider-txn-id",
 *   status: "SUCCESS|FAILED|REFUNDED|PENDING",
 *   timestamp: "2024-01-15T10:30:00Z",
 *   amount?: "1000.00",
 *   currency?: "USD",
 *   metadata?: { reason: "Network timeout", ... }
 * }
 */
router.post('/payment-provider', async (req, res) => {
  // Get signature from header
  const signature = req.headers['x-webhook-signature'] as string;
  if (!signature) {
    return res.status(401).json(failure('MISSING_SIGNATURE', 'X-Webhook-Signature header is required.'));
  }

  // Get raw body as string (Express middleware should provide this)
  // If not available, stringify the parsed body
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  try {
    // Verify signature and parse payload
    const payload = webhookVerifier.parseAndVerify(rawBody, signature);

    // Process webhook reconciliation
    const result = await handleWebhookReconciliation(payload, new DemoPaymentProvider());

    if (!result.success) {
      // Log failed webhook but return 200 to prevent provider retry storms
      console.warn(`Webhook processing failed for transaction ${payload.transactionId}: ${result.message}`);
      return res.status(200).json(success({
        webhookId: `webhook-${Date.now()}`,
        status: 'processed',
        message: result.message,
      }));
    }

    // Successful webhook processing
    return res.status(200).json(success({
      webhookId: `webhook-${Date.now()}`,
      status: 'processed',
      withdrawalId: result.withdrawalId,
      newStatus: result.newStatus,
      message: result.message,
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error processing webhook.';

    // Log the error
    console.error(`Webhook processing error: ${errorMsg}`);

    // Return 401 for signature verification failures, 400 for payload errors
    const statusCode = errorMsg.includes('signature') ? 401 : 400;
    return res.status(statusCode).json(failure('WEBHOOK_PROCESSING_ERROR', errorMsg));
  }
});

/**
 * GET /webhooks/health
 * Health check endpoint for payment provider to verify webhook endpoint is reachable.
 */
router.get('/health', (req, res) => {
  return res.status(200).json(success({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));
});

export default router;
