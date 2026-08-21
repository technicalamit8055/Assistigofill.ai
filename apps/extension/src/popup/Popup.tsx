import { useCallback, useEffect, useState } from 'react';
import { send } from '../shared/send';
import { CustomerPicker } from '../shared/CustomerPicker';
import {
  AlertIcon,
  ArrowIcon,
  ExternalIcon,
  Header,
  PlugIcon,
  ScanIcon,
  ShieldIcon,
  Wordmark,
} from '../shared/Brand';
import type { CustomerSummary, SessionState } from '../shared/messages';

/** Popup (spec §7.4.1): connection status, customer selection, and a way into the side panel. */
export function Popup() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    const response = await send<SessionState>({ type: 'GET_SESSION' });
    setSession(response.ok ? response.data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The connect page pairs in another tab, so the popup re-checks when it regains focus.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const selectCustomer = async (customer: CustomerSummary) => {
    await send({ type: 'SELECT_CUSTOMER', customer });
    await refresh();
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  };

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="panel row muted small">
          <span className="spinner spinner-ink" />
          Checking your connection…
        </div>
      </div>
    );
  }

  if (!session?.connected) {
    return (
      <div className="app">
        <div className="panel stack" style={{ paddingTop: 18 }}>
          <Wordmark height={44} />

          <div>
            <h1 style={{ fontSize: 17, marginTop: 8 }}>
              Fill any form in <span className="gradient-text">one click</span>
            </h1>
            <p className="small muted" style={{ marginTop: 4 }}>
              Connect your Assistigo account to fill forms from a saved customer profile.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary btn-block"
            disabled={connecting}
            onClick={() => {
              setConnecting(true);
              void send({ type: 'CONNECT_ACCOUNT' });
            }}
          >
            {connecting ? (
              <>
                <span className="spinner" />
                Waiting for the dashboard…
              </>
            ) : (
              <>
                <PlugIcon size={15} />
                Connect account
                <ArrowIcon size={14} />
              </>
            )}
          </button>

          {connecting ? (
            <p className="tiny muted" style={{ textAlign: 'center' }}>
              Approve the connection in the tab that just opened, then come back here.
            </p>
          ) : null}

          <div className="notice notice-info">
            <ShieldIcon size={13} />
            <span>
              You sign in on the Assistigo dashboard. Your password is never typed into this
              extension.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const ready = Boolean(session.selectedCustomer) && session.canFill;

  return (
    <div className="app">
      <Header
        right={
          <span className="badge badge-ok">
            <span className="dot live-dot" />
            Connected
          </span>
        }
      />

      <div className="panel stack">
        <div className="spread">
          <span className="small strong truncate">{session.organizationName}</span>
          <span className="badge badge-muted">{session.role}</span>
        </div>

        <CustomerPicker selected={session.selectedCustomer} onSelect={selectCustomer} />

        {!session.canFill ? (
          <div className="notice notice-warn">
            <AlertIcon size={13} />
            <span>Your role can view customers but not fill forms.</span>
          </div>
        ) : null}

        <button
          type="button"
          className="btn-primary btn-block"
          disabled={!ready}
          onClick={() => void openSidePanel()}
        >
          <ScanIcon size={15} />
          Detect fields on this page
        </button>

        {!session.selectedCustomer && session.canFill ? (
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Pick a customer to enable detection.
          </p>
        ) : null}

        <hr className="divider" />

        <div className="spread">
          <button
            type="button"
            className="btn-ghost small"
            onClick={() => void send({ type: 'OPEN_DASHBOARD' })}
          >
            <span className="row" style={{ gap: 6 }}>
              <ExternalIcon size={13} />
              Open dashboard
            </span>
          </button>

          <button
            type="button"
            className="btn-danger-ghost tiny"
            onClick={async () => {
              await send({ type: 'DISCONNECT' });
              await refresh();
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
