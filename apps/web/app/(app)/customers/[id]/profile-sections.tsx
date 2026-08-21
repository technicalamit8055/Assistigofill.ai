'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Field, Select, TextField, Textarea } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';
import { buildEditDecisions, type EditableFieldMeta } from '@/lib/customers/edit-decisions';
import { CustomerProfileField } from './customer-profile-field';

export type ProfileFieldOption = { value: string; label: string };

export type ProfileField = {
  key: string;
  label: string;
  dataType:
    | 'name'
    | 'text'
    | 'longtext'
    | 'date'
    | 'year'
    | 'mobile'
    | 'email'
    | 'pincode'
    | 'number'
    | 'enum'
    | 'boolean';
  value: string | null;
  sensitive: boolean;
  encrypted: boolean;
  hasEncryptedValue: boolean;
  maxLength: number | null;
  options: ProfileFieldOption[] | null;
};

export type ProfileSection = {
  section: string;
  title: string;
  fields: ProfileField[];
};

/**
 * Renders the profile field sections shown on a customer's page (§11), and owns the toggle
 * between that read-only view and a form that edits every field in place.
 *
 * Saving reuses `POST /api/customers/:id/values` — the same write path the paste-text review
 * flow already uses — rather than a second, hand-rolled mapping from field key to storage
 * location. That path already knows how to merge into a JSON column without clobbering
 * sibling fields, encrypt the fields that must never be plaintext, and keep a full Aadhaar
 * number from surviving under any key (docs/AI_PIPELINE.md §9).
 */
export function CustomerProfileSections({
  customerId,
  sections,
  canUpdate,
  canReveal,
}: {
  customerId: string;
  sections: ProfileSection[];
  canUpdate: boolean;
  canReveal: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          fields: section.fields.filter((field) => field.value !== null || field.hasEncryptedValue),
        }))
        .filter((section) => section.fields.length > 0),
    [sections],
  );

  const allFields = useMemo<EditableFieldMeta[]>(
    () =>
      sections.flatMap((section) =>
        section.fields.map((field) => ({
          key: field.key,
          value: field.value,
          encrypted: field.encrypted,
        })),
      ),
    [sections],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formValues = new Map<string, string>();
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      if (typeof value === 'string') formValues.set(key, value);
    }

    const decisions = buildEditDecisions(allFields, formValues);
    if (decisions.length === 0) {
      setMode('view');
      setError(null);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}/values`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decisions }),
      });

      const json = (await response.json()) as
        | { data: { acceptedCount: number } }
        | { error: { messageKey: string } };

      if (!response.ok || 'error' in json) {
        setError('error' in json ? json.error.messageKey : 'errors.internal');
        return;
      }

      setMode('view');
      router.refresh();
    } catch {
      setError('errors.internal');
    } finally {
      setPending(false);
    }
  }

  function cancelEdit() {
    setMode('view');
    setError(null);
  }

  if (viewSections.length === 0 && !canUpdate) return null;

  return (
    <div className="space-y-6">
      {canUpdate && mode === 'view' ? (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" type="button" onClick={() => setMode('edit')}>
            {t('customers.editDetails')}
          </Button>
        </div>
      ) : null}

      {mode === 'view'
        ? viewSections.map((section) => (
            <Card key={section.section} title={section.title}>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((field) => (
                  <CustomerProfileField
                    key={field.key}
                    customerId={customerId}
                    fieldKey={field.key}
                    label={field.label}
                    value={field.value}
                    hasEncryptedValue={field.hasEncryptedValue}
                    sensitive={field.sensitive}
                    canReveal={canReveal}
                  />
                ))}
              </dl>
            </Card>
          ))
        : (
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
              <Alert tone="info">{t('customers.editHelp')}</Alert>
              {error ? <Alert tone="danger">{t(error)}</Alert> : null}

              {sections.map((section) => (
                <Card key={section.section} title={section.title}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.fields.map((field) => (
                      <ProfileFieldInput key={field.key} field={field} />
                    ))}
                  </div>
                </Card>
              ))}

              <div className="flex items-center gap-3">
                <Button type="submit" loading={pending}>
                  {t('common.save')}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={pending}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          )}
    </div>
  );
}

function ProfileFieldInput({ field }: { field: ProfileField }): ReactNode {
  const t = useTranslations();

  const placeholder = field.encrypted
    ? field.hasEncryptedValue
      ? t('customers.editKeepEncrypted')
      : t('customers.editSetEncrypted')
    : undefined;
  const defaultValue = field.encrypted ? '' : field.value ?? '';
  const sensitiveLabel = t('common.masked');

  if (field.dataType === 'enum') {
    return (
      <Field
        label={field.label}
        htmlFor={field.key}
        sensitive={field.sensitive}
        sensitiveLabel={sensitiveLabel}
      >
        <Select id={field.key} name={field.key} defaultValue={defaultValue}>
          <option value="">{t('common.optional')}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.dataType === 'boolean') {
    return (
      <Field
        label={field.label}
        htmlFor={field.key}
        sensitive={field.sensitive}
        sensitiveLabel={sensitiveLabel}
      >
        <Select id={field.key} name={field.key} defaultValue={defaultValue}>
          <option value="">{t('common.optional')}</option>
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </Select>
      </Field>
    );
  }

  if (field.dataType === 'longtext') {
    return (
      <Field
        label={field.label}
        htmlFor={field.key}
        sensitive={field.sensitive}
        sensitiveLabel={sensitiveLabel}
        className="sm:col-span-2 lg:col-span-3"
      >
        <Textarea
          id={field.key}
          name={field.key}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      </Field>
    );
  }

  const inputType =
    field.dataType === 'date'
      ? 'date'
      : field.dataType === 'email'
        ? 'email'
        : field.dataType === 'mobile'
          ? 'tel'
          : field.dataType === 'number'
            ? 'number'
            : 'text';

  const maxLength =
    field.dataType === 'pincode' ? 6 : field.dataType === 'year' ? 4 : field.maxLength ?? undefined;

  return (
    <TextField
      label={field.label}
      name={field.key}
      type={inputType}
      defaultValue={defaultValue}
      placeholder={placeholder}
      maxLength={maxLength}
      sensitive={field.sensitive}
      sensitiveLabel={sensitiveLabel}
    />
  );
}
