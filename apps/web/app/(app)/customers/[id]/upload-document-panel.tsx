'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Button, Select } from '@assistigo/ui';
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

/**
 * Upload a document straight from the customer profile (§9.3, §7.3.4).
 *
 * The same three-step upload as the standalone `/documents/upload` page — reserve, PUT the bytes
 * to storage, then ask the server to verify and queue extraction — with the customer picker
 * dropped, because this panel already knows which customer it is on.
 *
 * Extraction runs as a background job (docs/AI_PIPELINE.md), so there is no field review here:
 * once queued, the new row shows up in the Documents list below with its status, and review
 * happens on the document's own page once reading finishes. Rendered inside the `AddProfileInfo`
 * card (./add-profile-info.tsx) alongside the paste-text panel.
 */
export function UploadDocumentPanel({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const { locale } = useI18n();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    setUploadedDocumentId(null);

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

    setPending(true);
    setError(null);
    setUploadedDocumentId(null);

    try {
      const intentResponse = await fetch('/api/documents/upload-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          customerId,
          ...(documentType === '' ? {} : { documentType }),
        }),
      });

      const intentJson = (await intentResponse.json()) as
        | { data: { documentId: string; uploadUrl: string } }
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

      setUploadedDocumentId(intent.documentId);
      setFile(null);
      setDocumentType('');
      // The Documents card below reads from the same server component tree, so this is what
      // makes the new row (and its status) show up without a full page reload.
      router.refresh();
    } catch {
      setError('errors.internal');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t('customers.paste.uploadIntro')}</p>

      {uploadedDocumentId ? (
        <Alert tone="success" title={t('customers.paste.uploadedTitle')}>
          {t('customers.paste.uploadedHelp')}{' '}
          <Link href={`/documents/${uploadedDocumentId}`} className="font-medium underline">
            {t('documents.view')}
          </Link>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="profile-upload-file" className="text-sm font-medium text-slate-800">
            {t('documents.file')}
          </label>
          <input
            id="profile-upload-file"
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
          <label htmlFor="profile-upload-type" className="text-sm font-medium text-slate-800">
            {t('documents.type')}
          </label>
          <Select
            id="profile-upload-type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
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

        <Button type="submit" loading={pending} disabled={!file}>
          {t('documents.upload')}
        </Button>
      </form>
    </div>
  );
}
