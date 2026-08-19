'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, Field, Input, Select } from '@assistigo/ui';
import { ASSIGNABLE_ROLES, type OrgRole } from '@assistigo/core';
import { useTranslations } from '@/lib/i18n/client';
import { inviteMemberAction, type MembersState } from './actions';

export function InviteForm({ actorRole }: { actorRole: OrgRole }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<MembersState, FormData>(
    inviteMemberAction,
    {},
  );

  const roles = ASSIGNABLE_ROLES[actorRole];
  if (roles.length === 0) return null;

  return (
    <Card title={t('settings.invite')}>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <Field
          label={t('settings.inviteEmail')}
          htmlFor="invite-email"
          className="min-w-[240px] flex-1"
        >
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="name@example.com"
          />
        </Field>

        <Field label={t('settings.inviteRole')} htmlFor="invite-role" className="min-w-[180px]">
          <Select id="invite-role" name="role" defaultValue="operator">
            {roles.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" loading={pending}>
          {t('settings.invite')}
        </Button>
      </form>

      <p className="mt-2 text-xs text-slate-500">{t(`roles.descriptions.operator`)}</p>

      {state.error ? (
        <Alert tone="danger" className="mt-4">
          {t(state.error)}
        </Alert>
      ) : null}

      {state.notice ? (
        <Alert tone="success" className="mt-4" title={t(state.notice)}>
          {state.inviteUrl ? (
            <>
              <p className="text-sm">
                Email delivery is not configured yet, so share this link with the person you
                invited. It expires in 7 days and only works for that email address.
              </p>
              <code className="mt-2 block break-all rounded bg-white/70 px-2 py-1 font-mono text-xs">
                {state.inviteUrl}
              </code>
            </>
          ) : null}
        </Alert>
      ) : null}
    </Card>
  );
}
