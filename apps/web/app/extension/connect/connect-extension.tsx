'use client';

import { useState } from 'react';
import { Alert, Button, Card } from '@assistigo/ui';

/**
 * The pairing gesture.
 *
 * Two steps, both of which must succeed:
 *   1. POST /api/extension/pairing-code — mints a one-time code against this browser session.
 *   2. chrome.runtime.sendMessage(extensionId, { code }) — hands it to the service worker,
 *      which redeems it at /api/extension/pair.
 *
 * The code is never rendered, never logged and never put in the URL. It exists in this
 * component for the length of one function call.
 *
 * Pairing is behind a button rather than running on mount: granting an extension your session
 * is an authorisation, and an authorisation should be something the operator did on purpose.
 */

type Stage = 'idle' | 'pairing' | 'done' | 'error';

/** Minimal shape of the message channel a web page gets from `externally_connectable`. */
type ExternallyConnectable = {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
      callback: (response?: { ok?: boolean; error?: string }) => void,
    ) => void;
    lastError?: { message?: string };
  };
};

const NOT_INSTALLED =
  'The Assistigo extension did not answer. Check that it is installed and enabled, then try again.';

export function ConnectExtension({
  extensionId,
  organizationName,
  email,
}: {
  extensionId: string;
  organizationName: string;
  email: string | null;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const pair = async () => {
    setStage('pairing');
    setMessage(null);

    let code: string;
    try {
      const response = await fetch('/api/extension/pairing-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ extensionId }),
      });
      if (!response.ok) throw new Error('mint_failed');
      const body = (await response.json()) as { data?: { code?: string } };
      if (!body.data?.code) throw new Error('mint_failed');
      code = body.data.code;
    } catch {
      setStage('error');
      setMessage('Could not start pairing. Reload this page and try again.');
      return;
    }

    const chromeApi = (globalThis as { chrome?: ExternallyConnectable }).chrome;
    const sendMessage = chromeApi?.runtime?.sendMessage;

    if (!sendMessage) {
      setStage('error');
      setMessage(NOT_INSTALLED);
      return;
    }

    // Callback form rather than the promise form: on a web page, a missing or disabled
    // extension surfaces as chrome.runtime.lastError with an undefined response, not a
    // rejection.
    sendMessage(extensionId, { code }, (response) => {
      if (chromeApi?.runtime?.lastError || !response) {
        setStage('error');
        setMessage(NOT_INSTALLED);
        return;
      }
      if (!response.ok) {
        setStage('error');
        setMessage('The extension refused the connection. Try again from the toolbar icon.');
        return;
      }
      setStage('done');
    });
  };

  if (stage === 'done') {
    return (
      <Card>
        <Alert tone="success" title="Extension connected">
          Assistigo is now linked to <strong>{organizationName}</strong>. Close this tab, open the
          form you want to fill, then use the extension&rsquo;s side panel.
        </Alert>
      </Card>
    );
  }

  return (
    <Card
      title="Connect your browser extension"
      description="The extension will be able to read forms you open and fill them from a customer profile you select. It can never submit a form for you."
    >
      <div className="space-y-4">
        <dl className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Workspace</dt>
            <dd className="font-medium text-slate-900">{organizationName}</dd>
          </div>
          {email ? (
            <div className="mt-1 flex justify-between gap-4">
              <dt className="text-slate-500">Signed in as</dt>
              <dd className="truncate font-medium text-slate-900">{email}</dd>
            </div>
          ) : null}
        </dl>

        {stage === 'error' && message ? (
          <Alert tone="danger" title="Not connected">
            {message}
          </Alert>
        ) : null}

        <Button onClick={() => void pair()} loading={stage === 'pairing'} size="lg">
          {stage === 'pairing' ? 'Connecting…' : 'Connect this extension'}
        </Button>

        <p className="text-xs text-slate-500">
          Not you, or not expecting this? Close this tab — nothing is connected until you press the
          button.
        </p>
      </div>
    </Card>
  );
}
