'use client';

import { useActionState } from 'react';
import { Alert, Button, Select } from '@assistigo/ui';
import { ASSIGNABLE_ROLES, type OrgRole } from '@assistigo/core';
import { useTranslations } from '@/lib/i18n/client';
import { changeMemberRoleAction, removeMemberAction, type MembersState } from './actions';

export function MemberRowActions({
  memberId,
  currentRole,
  actorRole,
  isSelf,
}: {
  memberId: string;
  currentRole: OrgRole;
  actorRole: OrgRole;
  isSelf: boolean;
}) {
  const t = useTranslations();
  const [roleState, roleAction, rolePending] = useActionState<MembersState, FormData>(
    changeMemberRoleAction,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState<MembersState, FormData>(
    removeMemberAction,
    {},
  );

  const assignable = ASSIGNABLE_ROLES[actorRole];

  // Changing your own role is how people accidentally lock themselves out of their own
  // workspace, so it is not offered here.
  const canEdit = !isSelf && assignable.includes(currentRole);
  const error = roleState.error ?? removeState.error;

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? (
        <Alert tone="danger" className="px-2 py-1 text-xs">
          {t(error)}
        </Alert>
      ) : null}

      {canEdit ? (
        <>
          <form action={roleAction}>
            <input type="hidden" name="memberId" value={memberId} />
            <Select
              name="role"
              defaultValue={currentRole}
              disabled={rolePending}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-8 py-0 text-xs"
              aria-label={t('settings.role')}
            >
              {assignable.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </Select>
          </form>

          <form action={removeAction}>
            <input type="hidden" name="memberId" value={memberId} />
            <Button type="submit" variant="ghost" size="sm" loading={removePending}>
              {t('settings.removeMember')}
            </Button>
          </form>
        </>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );
}
