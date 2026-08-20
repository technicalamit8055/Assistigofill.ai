/**
 * Tests for the `ocr.extract` job handler.
 *
 * The handler is where the extraction pipeline meets the database, so what is worth asserting
 * is the crossing itself: that the right statuses are written, that classification is allowed to
 * correct the operator's guess, and — the one that matters most — that nothing carrying a full
 * Aadhaar reaches a stored column.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_DOCUMENT_BY_CODE, containsAadhaarLikeNumber } from '@assistigo/ai';

// serverEnv() validates the whole server schema on first call, so the required keys must exist
// before the module under test is imported.
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.OCR_PROVIDER = 'mock';

const { handleOcrExtract } = await import('./ocr-extract');

type Captured = { table: string; op: 'upsert' | 'update'; payload: Record<string, unknown> };

/**
 * A stub Supabase client covering exactly the calls this handler makes. Deliberately small:
 * a general-purpose fake would be a second implementation to keep in sync.
 */
function stubClient(document: Record<string, unknown> | null, fileText: string) {
  const captured: Captured[] = [];

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: () =>
          Promise.resolve({
            data: table === 'documents' ? document : { settings: {} },
            error: null,
          }),
        update(payload: Record<string, unknown>) {
          captured.push({ table, op: 'update', payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        upsert(payload: Record<string, unknown>) {
          captured.push({ table, op: 'upsert', payload });
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
    storage: {
      from: () => ({
        download: () =>
          Promise.resolve({
            data: { arrayBuffer: () => Promise.resolve(new TextEncoder().encode(fileText).buffer) },
            error: null,
          }),
      }),
    },
  };

  // The handler's parameter is the real client type; this stub implements the slice it uses.
  return { client: client as never, captured };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    organization_id: '22222222-2222-4222-8222-222222222222',
    storage_path: 'org/22222222-2222-4222-8222-222222222222/customer/x/y/demo.pdf',
    storage_bucket: 'customer-documents',
    original_filename: 'demo-aadhaar.pdf',
    mime_type: 'application/pdf',
    document_type: 'unknown',
    ...overrides,
  };
}

const aadhaarText = DEMO_DOCUMENT_BY_CODE.get('aadhaar_like')?.text ?? '';

function extractionRow(captured: Captured[]) {
  return captured.find((entry) => entry.table === 'document_extractions')?.payload;
}

function documentUpdate(captured: Captured[]) {
  return captured.find((entry) => entry.table === 'documents')?.payload;
}

describe('handleOcrExtract', () => {
  beforeEach(() => {
    // The handler logs a completion line; keep the test output readable.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('stores the extraction and marks the document as needing review', async () => {
    const { client, captured } = stubClient(documentRow(), aadhaarText);

    const result = await handleOcrExtract(client, { documentId: documentRow().id });

    expect(result).toEqual({ ok: true });
    expect(extractionRow(captured)?.status).toBe('review_required');
    expect(documentUpdate(captured)?.status).toBe('review_required');
  });

  it('lets classification correct the type the operator guessed on upload', async () => {
    const { client, captured } = stubClient(documentRow(), aadhaarText);
    await handleOcrExtract(client, { documentId: documentRow().id });

    expect(extractionRow(captured)?.document_type).toBe('aadhaar_like');
    expect(documentUpdate(captured)?.document_type).toBe('aadhaar_like');
  });

  it('keeps the operator label when classification cannot place the document', async () => {
    const { client, captured } = stubClient(
      documentRow({ document_type: 'income_certificate', original_filename: 'scan.pdf' }),
      'nothing recognisable on this page at all',
    );

    await handleOcrExtract(client, { documentId: documentRow().id });

    // Overwriting a human's label with `unknown` would lose information, not add it.
    expect(documentUpdate(captured)?.document_type).toBe('income_certificate');
  });

  it('never stores a full Aadhaar in the raw text or any extracted field', async () => {
    const { client, captured } = stubClient(documentRow(), aadhaarText);
    await handleOcrExtract(client, { documentId: documentRow().id });

    const row = extractionRow(captured);
    expect(containsAadhaarLikeNumber(String(row?.raw_text ?? ''))).toBe(false);
    expect(containsAadhaarLikeNumber(JSON.stringify(row?.extracted_fields ?? []))).toBe(false);
  });

  it('records the failure so the operator can see it, rather than failing silently', async () => {
    const { client, captured } = stubClient(documentRow(), aadhaarText);
    const broken = {
      ...(client as unknown as Record<string, unknown>),
      storage: {
        from: () => ({ download: () => Promise.reject(new Error('object not found')) }),
      },
    } as never;

    const result = await handleOcrExtract(broken, { documentId: documentRow().id });

    expect(result.ok).toBe(false);
    expect(extractionRow(captured)?.status).toBe('failed');
    expect(documentUpdate(captured)?.status).toBe('failed');
    // The provider's error string can echo page content, so only a stable code is stored.
    expect(extractionRow(captured)?.error_code).toBe('EXTRACTION_FAILED');
    expect(JSON.stringify(extractionRow(captured))).not.toContain('object not found');
  });

  it('treats a document deleted between enqueue and run as nothing to do', async () => {
    const { client, captured } = stubClient(null, aadhaarText);

    const result = await handleOcrExtract(client, { documentId: documentRow().id });

    expect(result).toEqual({ ok: true });
    expect(captured).toEqual([]);
  });

  it('rejects a payload that is not a document id', async () => {
    const { client } = stubClient(documentRow(), aadhaarText);
    await expect(handleOcrExtract(client, { documentId: 'not-a-uuid' })).rejects.toThrow();
  });
});
