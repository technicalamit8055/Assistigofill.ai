'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Input, Textarea } from '@assistigo/ui';
import { useI18n, useTranslations } from '@/lib/i18n/client';
import { formatConfidence } from '@/lib/documents/format';

/**
 * Add profile details by pasting them as text (§9.3).
 *
 * The same two-step shape as document review — propose, then a human decides — because it is
 * the same product rule: nothing reaches a profile until an operator accepts it (§12.6). The
 * difference is only where the text came from, so the operator learns one interaction, not two.
 *
 * The pasted text stays in this component. It is sent to `/api/customers/parse-text`, which
 * stores nothing, and is never included in the save request — only the fields the operator
 * accepted are.
 *
 * Rendered inside the `AddProfileInfo` card (./add-profile-info.tsx) alongside the upload panel;
 * it owns no `Card` of its own.
 */

type ProposedField = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  sourceText: string;
  status: 'ok' | 'needs_review';
  reviewReason: string | null;
  fieldLabel: { en: string; hi: string } | null;
  sensitivity: 'normal' | 'sensitive' | 'high_risk';
};

type Warning = { code: string; messageKey: string; fieldKey?: string };

type ParseResponse = {
  fields: ProposedField[];
  warnings: Warning[];
  confidence: number | null;
  lineCount: number;
};

type Decision = { action: 'accept' | 'edit' | 'reject'; value: string };

const CONFIDENCE_TONE = (confidence: number): 'success' | 'warning' | 'danger' =>
  confidence >= 0.9 ? 'success' : confidence >= 0.7 ? 'warning' : 'danger';

export function PasteTextPanel({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const { locale } = useI18n();
  const router = useRouter();

  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [pending, setPending] = useState<'parse' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const acceptedCount = useMemo(
    () => Object.values(decisions).filter((decision) => decision.action !== 'reject').length,
    [decisions],
  );

  function setDecision(key: string, decision: Decision | null) {
    setDecisions((current) => {
      const next = { ...current };
      if (decision === null) delete next[key];
      else next[key] = decision;
      return next;
    });
  }

  function reset() {
    setText('');
    setParsed(null);
    setDecisions({});
    setError(null);
    setSavedCount(null);
  }

  async function parse() {
    if (text.trim() === '') return;

    setPending('parse');
    setError(null);
    setSavedCount(null);

    try {
      const response = await fetch('/api/customers/parse-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const json = (await response.json()) as
        | { data: ParseResponse }
        | { error: { messageKey: string } };

      if (!response.ok || 'error' in json) {
        setError('error' in json ? json.error.messageKey : 'errors.internal');
        return;
      }

      setParsed(json.data);
      // Pre-accepting would defeat the review. Every field starts undecided, exactly as it does
      // on the document review screen.
      setDecisions({});
    } catch {
      setError('errors.internal');
    } finally {
      setPending(null);
    }
  }

  async function save() {
    if (!parsed) return;

    const payload = Object.entries(decisions).map(([fieldKey, decision]) => {
      const field = parsed.fields.find((candidate) => candidate.key === fieldKey);

      return {
        fieldKey,
        action: decision.action,
        ...(decision.action === 'reject' ? {} : { value: decision.value }),
        // Only meaningful for `accept`; the server discards it for an edited value, because a
        // value a human typed is not described by the extractor's confidence.
        ...(decision.action === 'accept' && field ? { confidence: field.confidence } : {}),
      };
    });

    if (payload.length === 0) return;

    setPending('save');
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}/values`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decisions: payload }),
      });

      const json = (await response.json()) as
        | { data: { acceptedCount: number } }
        | { error: { messageKey: string } };

      if (!response.ok || 'error' in json) {
        setError('error' in json ? json.error.messageKey : 'errors.internal');
        return;
      }

      setSavedCount(json.data.acceptedCount);
      setText('');
      setParsed(null);
      setDecisions({});
      router.refresh();
    } catch {
      setError('errors.internal');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600">{t('customers.paste.help')}</p>

      {savedCount !== null ? (
        <Alert tone="success" className="mb-4">
          {t('customers.paste.saved', { count: savedCount })}
        </Alert>
      ) : null}

      {parsed === null ? (
        <div className="space-y-3">
          <Textarea
            aria-label={t('customers.paste.title')}
            rows={8}
            value={text}
            placeholder={t('customers.paste.placeholder')}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-xs text-slate-500">{t('customers.paste.privacyNote')}</p>

          {error ? <Alert tone="danger">{t(error)}</Alert> : null}

          <Button onClick={parse} loading={pending === 'parse'} disabled={text.trim() === ''}>
            {t('customers.paste.parse')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('customers.paste.readLines', {
              fields: parsed.fields.length,
              lines: parsed.lineCount,
            })}
          </p>

          {parsed.warnings.length > 0 ? (
            <Alert tone="warning" title={t('customers.paste.warningsTitle')}>
              <ul className="list-disc space-y-1 pl-4">
                {parsed.warnings.map((warning) => (
                  <li key={`${warning.code}:${warning.fieldKey ?? ''}`}>{t(warning.messageKey)}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {parsed.fields.length === 0 ? (
            <p className="text-sm text-slate-500">{t('customers.paste.noFields')}</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {parsed.fields.map((field) => {
                const decision = decisions[field.key];
                const rejected = decision?.action === 'reject';
                const editing = decision?.action === 'edit';

                return (
                  <li key={field.key} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {field.fieldLabel ? field.fieldLabel[locale] : field.key}
                        </p>
                        {/* The heading the operator's own text used, next to what we mapped it to. */}
                        <p className="mt-0.5 text-xs text-slate-500">{field.label}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={CONFIDENCE_TONE(field.confidence)}>
                          {formatConfidence(field.confidence)}
                        </Badge>
                        {field.reviewReason ? (
                          <Badge tone="neutral">
                            {t(`documents.review.reasons.${field.reviewReason}`)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3">
                      {editing ? (
                        <Input
                          aria-label={field.fieldLabel ? field.fieldLabel[locale] : field.key}
                          value={decision.value}
                          autoFocus
                          onChange={(event) =>
                            setDecision(field.key, { action: 'edit', value: event.target.value })
                          }
                        />
                      ) : (
                        <p
                          className={
                            rejected
                              ? 'text-sm text-slate-400 line-through'
                              : 'text-sm font-medium text-slate-900'
                          }
                        >
                          {field.value}
                        </p>
                      )}
                    </div>

                    <p className="mt-2 truncate text-xs text-slate-400" title={field.sourceText}>
                      {t('customers.paste.source')}: {field.sourceText}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={decision?.action === 'accept' ? 'primary' : 'secondary'}
                        onClick={() =>
                          setDecision(field.key, { action: 'accept', value: field.value })
                        }
                      >
                        {t('documents.review.accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant={editing ? 'primary' : 'secondary'}
                        onClick={() =>
                          setDecision(field.key, {
                            action: 'edit',
                            value: decision?.value ?? field.value,
                          })
                        }
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant={rejected ? 'primary' : 'ghost'}
                        onClick={() => setDecision(field.key, { action: 'reject', value: '' })}
                      >
                        {t('documents.review.reject')}
                      </Button>
                      {decision ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDecision(field.key, null)}
                        >
                          {t('documents.review.undo')}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error ? <Alert tone="danger">{t(error)}</Alert> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={save}
              loading={pending === 'save'}
              disabled={Object.keys(decisions).length === 0}
            >
              {t('documents.review.save')}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {t('customers.paste.startOver')}
            </Button>
            <p className="text-sm text-slate-500">
              {t('documents.review.pendingCount', {
                accepted: acceptedCount,
                total: parsed.fields.length,
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
