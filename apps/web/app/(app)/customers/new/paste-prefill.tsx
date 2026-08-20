'use client';

import { useState } from 'react';
import { Alert, Button, Textarea } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

/**
 * Fills the new-customer form from pasted text (§9.3).
 *
 * Deliberately weaker than the profile's paste panel, and for a reason: creating a customer must
 * stay under 30 seconds (§9.2), so this fills the six fields the create form has and stops. It
 * does not write anything — the operator still reads every value in the form and submits it
 * themselves, which is the same human gate the review screen provides, just in a form they were
 * already going to fill.
 *
 * Anything the create form has no home for is counted and reported, not silently dropped: the
 * operator is told to paste the same text again on the profile, where the full review flow can
 * take all of it.
 */

type ProposedField = { key: string; value: string };

/** Parsed key → the create form's input name. */
const FORM_FIELD_BY_KEY: Readonly<Record<string, string>> = {
  'customer.full_name': 'fullName',
  'customer.mobile': 'mobile',
  'customer.father_name': 'fatherName',
  // Already normalised to ISO by the extractor, which is what `<input type="date">` wants.
  'customer.date_of_birth': 'dateOfBirth',
  // Already normalised to male/female/transgender/other, matching the select's option values.
  'customer.gender': 'gender',
  'customer.address.district': 'district',
};

export function PastePrefill({
  onPrefill,
}: {
  onPrefill: (values: Record<string, string>) => void;
}) {
  const t = useTranslations();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ used: number; extra: number } | null>(null);

  async function parse() {
    if (text.trim() === '') return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/customers/parse-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const json = (await response.json()) as
        | { data: { fields: ProposedField[] } }
        | { error: { messageKey: string } };

      if (!response.ok || 'error' in json) {
        setError('error' in json ? json.error.messageKey : 'errors.internal');
        return;
      }

      const values: Record<string, string> = {};
      let extra = 0;

      for (const field of json.data.fields) {
        const name = FORM_FIELD_BY_KEY[field.key];
        if (name) values[name] = field.value;
        else extra += 1;
      }

      onPrefill(values);
      setResult({ used: Object.keys(values).length, extra });
    } catch {
      setError('errors.internal');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('customers.paste.prefill')}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{t('customers.paste.prefillHelp')}</p>

      <Textarea
        aria-label={t('customers.paste.prefill')}
        rows={6}
        value={text}
        autoFocus
        placeholder={t('customers.paste.placeholder')}
        onChange={(event) => setText(event.target.value)}
      />

      <p className="text-xs text-slate-500">{t('customers.paste.privacyNote')}</p>

      {error ? <Alert tone="danger">{t(error)}</Alert> : null}

      {result ? (
        <Alert tone={result.used > 0 ? 'success' : 'warning'}>
          {result.used > 0
            ? t('customers.paste.prefilled', { count: result.used })
            : t('customers.paste.noFields')}
          {result.extra > 0 ? ` ${t('customers.paste.prefillExtra', { count: result.extra })}` : ''}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={parse} loading={pending} disabled={text.trim() === ''}>
          {t('customers.paste.parse')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setText('');
            setResult(null);
            setError(null);
          }}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
