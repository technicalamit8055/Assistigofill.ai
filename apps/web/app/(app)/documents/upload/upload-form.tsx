'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Button, Card, Select } from '@assistigo/ui';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  MAX_UPLOAD_BYTES,
  isAllowedUploadMimeType,
  type DocumentType,
} from '@assistigo/core';
import { useI18n, useTranslations } from '@/lib/i18n/client';
import { formatBytes } from '@/lib/documents/format';

type UploadIntent = {
  documentId: string;
  uploadUrl: string;
  uploadToken: string;
  storagePath: string;
};

type CustomerOption = { id: string; label: string };

/**
 * Three steps, one button (§9.3):
 *
 *   1. ask the server to reserve a document row and a one-time upload URL,
 *   2. PUT the bytes straight to storage — they never pass through a route handler,
 *   3. tell the server to verify the bytes and queue extraction.
 *
 * The file itself is never held in component state beyond the upload; there is no reason for a
 * customer's Aadhaar scan to outlive the request that stored it.
 */
export function UploadForm({
  customers,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  defaultCustomerId?: string | null;
}) {
  const t = useTranslations();
  const { locale } = useI18n();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    // Checked again on the server — this is only here so the operator finds out now rather
    // than after waiting for a 15 MB upload.
    if (!isAllowedUploadMimeType(selected.type)) {
      setFile(null);
      setError('validation.unsupported_file_type');
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError('validation.file_too_large');
      return;
    }

    setFile(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    const form = new FormData(event.currentTarget);
    const customerId = String(form.get('customerId') ?? '');
    const documentType = String(form.get('documentType') ?? '');

    setPending(true);
    setError(null);

    try {
      const intentResponse = await fetch('/api/documents/upload-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          customerId: customerId === '' ? null : customerId,
          ...(documentType === '' ? {} : { documentType }),
        }),
      });

      const intentJson = (await intentResponse.json()) as
        | { data: UploadIntent }
        | { error: { messageKey: string } };

      if (!intentResponse.ok || 'error' in intentJson) {
        setError('error' in intentJson ? intentJson.error.messageKey : 'errors.internal');
        setPending(false);
        return;
      }

      const intent = intentJson.data;

      const uploadResponse = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        setError('documents.errors.uploadFailed');
        setPending(false);
        return;
      }

      // The server has not seen a byte until this call: it downloads the object, checks the
      // magic bytes against what we claimed, and only then queues extraction.
      const processResponse = await fetch(`/api/documents/${intent.documentId}/process`, {
        method: 'POST',
      });

      const processJson = (await processResponse.json()) as
        | { data: unknown }
        | { error: { messageKey: string } };

      if (!processResponse.ok || 'error' in processJson) {
        setError('error' in processJson ? processJson.error.messageKey : 'errors.internal');
        setPending(false);
        return;
      }

      router.push(`/documents/${intent.documentId}`);
      router.refresh();
    } catch {
      setError('errors.internal');
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="file" className="text-sm font-medium text-slate-800">
            {t('documents.file')}
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept={ALLOWED_UPLOAD_MIME_TYPES.join(',')}
            onChange={handleFileChange}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-slate-500">
            {t('documents.fileHint', { size: formatBytes(MAX_UPLOAD_BYTES) })}
          </p>
          {file ? (
            <p className="text-xs text-slate-600">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="customerId" className="text-sm font-medium text-slate-800">
            {t('documents.customer')}
          </label>
          <Select id="customerId" name="customerId" defaultValue={defaultCustomerId ?? ''}>
            <option value="">{t('documents.noCustomer')}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">{t('documents.customerHint')}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="documentType" className="text-sm font-medium text-slate-800">
            {t('documents.type')}
          </label>
          <Select id="documentType" name="documentType" defaultValue="">
            <option value="">{t('documents.detectType')}</option>
            {DOCUMENT_TYPES.filter((type) => type !== 'unknown').map((type: DocumentType) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type][locale]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">{t('documents.typeHint')}</p>
        </div>

        {error ? <Alert tone="danger">{t(error)}</Alert> : null}

        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={!file}>
            {t('documents.upload')}
          </Button>
          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </Card>
  );
}
