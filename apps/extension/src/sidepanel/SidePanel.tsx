import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SKIP_REASON_LABELS,
  confidenceBand,
  type DetectedField,
  type DetectionPayload,
  type FieldMapping,
  type FillResult,
} from '@assistigo/form-engine';
import { send } from '../shared/send';
import { CustomerPicker } from '../shared/CustomerPicker';
import {
  AlertIcon,
  ArrowIcon,
  CheckIcon,
  ExternalIcon,
  Header,
  HelpIcon,
  LinkIcon,
  Mark,
  ScanIcon,
  ShieldIcon,
  SparkIcon,
} from '../shared/Brand';
import type { CustomerSummary, SessionState } from '../shared/messages';

/** Faint dot grids and sparkles behind the connect screen's hero. Purely decorative. */
function ConnectDecor() {
  return (
    <svg className="connect-decor" viewBox="0 0 400 300" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="connect-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect x="-20" y="10" width="90" height="90" fill="url(#connect-dots)" opacity="0.5" />
      <rect x="330" y="120" width="90" height="90" fill="url(#connect-dots)" opacity="0.5" />
      <path d="M20 90 Q 90 40 180 55" stroke="currentColor" strokeWidth="1" opacity="0.25" fill="none" />
      <rect x="336" y="16" width="30" height="38" rx="4" fill="none" stroke="currentColor" opacity="0.3" />
      <path d="M343 27h16M343 34h16M343 41h10" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
      <path d="M56 18l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="currentColor" opacity="0.35" />
      <path d="M300 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor" opacity="0.3" />
      <path d="M250 20l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/** How-it-works illustration: profile data flows through a lock to fill the page safely. */
function ConnectIllustration() {
  return (
    <svg className="connect-illustration" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="connect-lock-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0066ff" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M50 120 Q 90 145 130 128"
        stroke="var(--brand-500)"
        strokeWidth="2"
        strokeDasharray="4 5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M190 128 Q 230 145 270 120"
        stroke="var(--brand-500)"
        strokeWidth="2"
        strokeDasharray="4 5"
        fill="none"
        opacity="0.6"
      />

      <g>
        <rect x="70" y="8" width="180" height="96" rx="10" fill="var(--surface)" stroke="var(--line)" />
        <rect x="70" y="8" width="180" height="20" rx="10" fill="var(--line-soft)" />
        <rect x="70" y="18" width="180" height="10" fill="var(--line-soft)" />
        <circle cx="82" cy="18" r="2.5" fill="var(--line)" />
        <circle cx="90" cy="18" r="2.5" fill="var(--line)" />
        <circle cx="98" cy="18" r="2.5" fill="var(--line)" />
        <rect x="86" y="40" width="150" height="8" rx="4" fill="var(--brand-100)" />
        <rect x="86" y="56" width="100" height="8" rx="4" fill="var(--line-soft)" />
        <rect x="86" y="72" width="70" height="8" rx="4" fill="var(--line-soft)" />
        <rect x="86" y="88" width="115" height="8" rx="4" fill="var(--line-soft)" />
      </g>

      <g transform="translate(20,104)">
        <circle cx="20" cy="20" r="22" fill="var(--brand-50)" stroke="var(--brand-100)" />
        <circle cx="20" cy="15" r="6" fill="var(--brand-500)" />
        <path d="M9 30c1.5-6 6-9 11-9s9.5 3 11 9" fill="var(--brand-500)" />
      </g>

      <g transform="translate(138,100)">
        <rect x="0" y="0" width="44" height="44" rx="14" fill="url(#connect-lock-gradient)" />
        <rect x="14" y="21" width="16" height="13" rx="3" fill="#fff" />
        <path d="M17 21v-4a5 5 0 0 1 10 0v4" stroke="#fff" strokeWidth="2.5" fill="none" />
      </g>

      <g transform="translate(258,104)">
        <circle cx="20" cy="20" r="22" fill="var(--brand-50)" stroke="var(--brand-100)" />
        <path d="M20 8l11 4v8c0 8-4.7 13.6-11 16-6.3-2.4-11-8-11-16v-8l11-4Z" fill="var(--brand-500)" />
        <path d="m14.5 20 3.6 3.6 7-7" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

type Proposal = {
  fillSessionId: string;
  mappings: FieldMapping[];
  values: Record<string, string>;
};

type Stage = 'idle' | 'detecting' | 'reviewing' | 'filling' | 'done';

const BAND_BADGE: Record<ReturnType<typeof confidenceBand>, string> = {
  high: 'badge-ok',
  medium: 'badge-warn',
  low: 'badge-danger',
};

function fieldLabel(field: DetectedField | undefined): string {
  return (
    field?.labelText ?? field?.ariaLabel ?? field?.placeholder ?? field?.name ?? 'Unnamed field'
  );
}

export function SidePanel() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [detection, setDetection] = useState<DetectionPayload | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [results, setResults] = useState<FillResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  const refreshSession = useCallback(async () => {
    const response = await send<SessionState>({ type: 'GET_SESSION' });
    setSession(response.ok ? response.data : null);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Pairing happens in a dashboard tab; re-check when the panel is looked at again.
  useEffect(() => {
    const onFocus = () => void refreshSession();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSession]);

  const fieldBySignature = useMemo(
    () => new Map((detection?.fields ?? []).map((field) => [field.signature, field])),
    [detection],
  );

  const fillable = useMemo(
    () =>
      (proposal?.mappings ?? []).filter(
        (mapping) =>
          mapping.customerField !== null &&
          (mapping.skipReason === undefined || mapping.skipReason === 'low_confidence'),
      ),
    [proposal],
  );

  const blocked = useMemo(
    () => (proposal?.mappings ?? []).filter((mapping) => mapping.safetyClass !== 'normal'),
    [proposal],
  );

  const detect = async () => {
    setStage('detecting');
    setError(null);
    setResults(null);
    setReported(false);

    const detected = await send<DetectionPayload>({ type: 'DETECT_FIELDS' });
    if (!detected.ok) {
      setError('Could not read this page. Open a form page and try again.');
      setStage('idle');
      return;
    }
    setDetection(detected.data);

    const mapped = await send<Proposal>({ type: 'REQUEST_MAPPING' });
    if (!mapped.ok) {
      setError(
        mapped.error === 'no_customer_selected'
          ? 'Select a customer first.'
          : 'Could not work out what goes where. You can still fill this form by hand.',
      );
      setStage('idle');
      return;
    }

    setProposal(mapped.data);
    // Fields that need review start unticked, so the operator has to look at them.
    setApproved(
      new Set(
        mapped.data.mappings
          .filter(
            (mapping) =>
              mapping.customerField !== null &&
              mapping.skipReason === undefined &&
              !mapping.reviewRequired,
          )
          .map((mapping) => mapping.signature),
      ),
    );
    setStage('reviewing');
  };

  const fill = async () => {
    if (!proposal) return;
    setStage('filling');

    const instructions = fillable
      .filter((mapping) => approved.has(mapping.signature))
      .map((mapping) => ({
        signature: mapping.signature,
        value: edits[mapping.signature] ?? proposal.values[mapping.customerField!] ?? '',
        inputType: fieldBySignature.get(mapping.signature)?.inputType ?? 'text',
      }))
      .filter((instruction) => instruction.value !== '');

    const response = await send<{ results: FillResult[] }>({
      type: 'APPLY_FILL',
      instructions,
    });

    if (!response.ok) {
      setError('The fill did not complete. Nothing was submitted.');
      setStage('reviewing');
      return;
    }

    setResults(response.data.results);
    setStage('done');
  };

  const toggle = (signature: string) => {
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(signature)) next.delete(signature);
      else next.add(signature);
      return next;
    });
  };

  const allSelected = fillable.length > 0 && approved.size === fillable.length;

  const toggleAll = () => {
    setApproved(allSelected ? new Set() : new Set(fillable.map((m) => m.signature)));
  };

  if (!session?.connected) {
    return (
      <div className="app">
        <div className="connect-hero">
          <ConnectDecor />

          <div className="connect-logo">
            <Mark size={64} className="connect-logo__mark" />
            <p className="connect-wordmark">
              Assistigo<span className="connect-wordmark__accent">.ai</span>
            </p>
          </div>

          <div className="connect-copy">
            <h1 className="connect-heading">
              Review and fill, <span className="gradient-text">safely</span>
            </h1>
            <p className="small muted">
              Connect your Assistigo account to fill this page from a saved customer profile.
            </p>
          </div>

          <ConnectIllustration />

          <button
            type="button"
            className="btn-primary btn-block"
            onClick={() => void send({ type: 'CONNECT_ACCOUNT' })}
          >
            <LinkIcon size={16} />
            Connect account
            <ArrowIcon size={14} />
          </button>

          <div className="safety-card">
            <span className="safety-card__icon">
              <ShieldIcon size={17} />
            </span>
            <div className="safety-card__body">
              <p className="strong">Your data is safe with Assistigo</p>
              <p className="small muted">
                You sign in on the Assistigo dashboard. Your password is never typed into this
                extension.
              </p>
            </div>
          </div>
        </div>

        <hr className="divider" />

        <div className="connect-footer">
          <button type="button" className="btn-ghost connect-footer__link">
            <HelpIcon size={13} />
            Need help?
          </button>
          <span className="connect-footer__divider" aria-hidden="true" />
          <button type="button" className="btn-ghost connect-footer__link connect-footer__link--accent">
            Learn more
            <ExternalIcon size={12} />
          </button>
        </div>
      </div>
    );
  }

  const filledCount = results?.filter((result) => result.action === 'filled').length ?? 0;
  const skippedCount = results?.filter((result) => result.action === 'skipped').length ?? 0;
  const failedCount = results?.filter((result) => result.action === 'failed').length ?? 0;
  const totalResults = filledCount + skippedCount + failedCount;

  return (
    <div className="app">
      <Header
        title="Review and fill"
        right={<span className="badge badge-brand truncate">{session.organizationName}</span>}
      />

      <div className="panel stack">
        <CustomerPicker
          selected={session.selectedCustomer}
          onSelect={async (customer: CustomerSummary) => {
            await send({ type: 'SELECT_CUSTOMER', customer });
            await refreshSession();
            setProposal(null);
            setResults(null);
            setStage('idle');
          }}
        />

        {error ? (
          <div className="notice notice-danger">
            <AlertIcon size={13} />
            <span>{error}</span>
          </div>
        ) : null}

        {stage === 'idle' || stage === 'detecting' ? (
          <>
            {!proposal ? (
              <div className="card empty">
                <div className="empty-art">
                  <ScanIcon size={20} />
                </div>
                <p className="strong">Nothing detected yet</p>
                <p className="tiny muted" style={{ marginTop: 2 }}>
                  Open the form you want to fill, then read the page.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="btn-primary btn-block"
              disabled={!session.selectedCustomer || stage === 'detecting'}
              onClick={() => void detect()}
            >
              {stage === 'detecting' ? (
                <>
                  <span className="spinner" />
                  Reading the page…
                </>
              ) : (
                <>
                  <ScanIcon size={15} />
                  Detect fields
                </>
              )}
            </button>
          </>
        ) : null}

        {proposal && stage !== 'done' ? (
          <>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-value">{detection?.fields.length ?? 0}</div>
                <div className="stat-label">detected</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fillable.length}</div>
                <div className="stat-label">mappable</div>
              </div>
              <div className="stat">
                <div className="stat-value gradient-text">{approved.size}</div>
                <div className="stat-label">selected</div>
              </div>
            </div>

            {blocked.length > 0 ? (
              <div className="notice notice-warn">
                <ShieldIcon size={13} />
                <span>
                  {blocked.length} field{blocked.length === 1 ? '' : 's'} must be filled by you:{' '}
                  {blocked
                    .map((mapping) => SKIP_REASON_LABELS[mapping.skipReason ?? 'no_mapping'].en)
                    .join(', ')}
                  .
                </span>
              </div>
            ) : null}

            {fillable.length > 0 ? (
              <div className="spread">
                <h2>Fields to fill</h2>
                <button type="button" className="btn-ghost tiny" onClick={toggleAll}>
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            ) : null}

            <div className="card card-flush">
              {fillable.length === 0 ? (
                <div className="empty">
                  <div className="empty-art">
                    <SparkIcon size={20} />
                  </div>
                  <p className="strong">No matches on this page</p>
                  <p className="tiny muted" style={{ marginTop: 2 }}>
                    Nothing here matches this customer&rsquo;s saved details. Report the form and
                    it can be supported.
                  </p>
                </div>
              ) : (
                fillable.map((mapping) => {
                  const field = fieldBySignature.get(mapping.signature);
                  const band = confidenceBand(mapping.confidence);
                  const ticked = approved.has(mapping.signature);
                  const value =
                    edits[mapping.signature] ?? proposal.values[mapping.customerField!] ?? '';

                  const rowClass = [
                    'field-row',
                    mapping.reviewRequired ? 'field-row-review' : '',
                    ticked ? '' : 'field-row-off',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div key={mapping.signature} className={rowClass}>
                      <label className="field-head">
                        <input
                          type="checkbox"
                          checked={ticked}
                          onChange={() => toggle(mapping.signature)}
                          style={{ marginTop: 2 }}
                        />
                        <span className="grow">
                          <span className="spread">
                            {/* Host-page text, rendered as text — never as markup (§19.6). */}
                            <span className="strong truncate">{fieldLabel(field)}</span>
                            <span className={`badge ${BAND_BADGE[band]}`}>
                              {Math.round(mapping.confidence * 100)}%
                            </span>
                          </span>
                          <span className="field-key truncate" style={{ display: 'block' }}>
                            {mapping.customerField} · {mapping.source}
                          </span>
                        </span>
                      </label>

                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          setEdits((current) => ({
                            ...current,
                            [mapping.signature]: event.target.value,
                          }))
                        }
                        style={{ marginTop: 7 }}
                        aria-label={`Value for ${fieldLabel(field)}`}
                      />

                      {mapping.reviewRequired ? (
                        <p
                          className="tiny row"
                          style={{ color: 'var(--warn)', margin: '5px 0 0', gap: 5 }}
                        >
                          <AlertIcon size={12} />
                          Check this one before filling.
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              className="btn-primary btn-block"
              disabled={approved.size === 0 || stage === 'filling'}
              onClick={() => void fill()}
            >
              {stage === 'filling' ? (
                <>
                  <span className="spinner" />
                  Filling…
                </>
              ) : (
                <>
                  <CheckIcon size={15} />
                  {`Fill ${approved.size} field${approved.size === 1 ? '' : 's'}`}
                </>
              )}
            </button>

            <div className="notice notice-info">
              <ShieldIcon size={13} />
              <span>
                Assistigo fills the fields you ticked. Check the form, complete any CAPTCHA or OTP
                yourself, then press the portal&rsquo;s own submit button.
              </span>
            </div>
          </>
        ) : null}

        {stage === 'done' && results ? (
          <>
            <div className="card-glow stack">
              <div className="stat-grid">
                <div className="stat">
                  <div className="stat-value" style={{ color: 'var(--ok)' }}>
                    {filledCount}
                  </div>
                  <div className="stat-label">filled</div>
                </div>
                <div className="stat">
                  <div className="stat-value muted">{skippedCount}</div>
                  <div className="stat-label">skipped</div>
                </div>
                <div className="stat">
                  <div
                    className="stat-value"
                    style={{ color: failedCount > 0 ? 'var(--danger)' : undefined }}
                  >
                    {failedCount}
                  </div>
                  <div className="stat-label">failed</div>
                </div>
              </div>

              <div
                className="meter"
                role="img"
                aria-label={`${filledCount} of ${totalResults} fields filled`}
              >
                <span
                  style={{
                    width: totalResults === 0 ? '0%' : `${(filledCount / totalResults) * 100}%`,
                  }}
                />
              </div>

              <div className="notice notice-warn">
                <ShieldIcon size={13} />
                <span>Nothing has been submitted. Review the form and press submit yourself.</span>
              </div>

              {results.some((result) => result.action === 'skipped' && result.skipReason) ? (
                <div className="stack-sm">
                  <h2>Skipped</h2>
                  {results
                    .filter((result) => result.action === 'skipped' && result.skipReason)
                    .map((result) => (
                      <p key={result.signature} className="tiny muted truncate">
                        {fieldLabel(fieldBySignature.get(result.signature))} —{' '}
                        {SKIP_REASON_LABELS[result.skipReason!].en}
                      </p>
                    ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="btn-secondary btn-block"
              onClick={() =>
                void send({
                  type: 'CREATE_APPLICATION',
                  title: detection?.page.title?.slice(0, 160) ?? 'Application',
                })
              }
            >
              Save as an application
            </button>

            <button
              type="button"
              className="btn-ghost small btn-block"
              onClick={() => setStage('reviewing')}
            >
              Back to review
            </button>
          </>
        ) : null}

        {proposal ? (
          <>
            <hr className="divider" />
            <button
              type="button"
              className="btn-ghost tiny btn-block"
              disabled={reported}
              onClick={async () => {
                const response = await send({
                  type: 'REPORT_FORM',
                  note: 'Reported from the review panel',
                  includeScreenshot: false,
                });
                if (response.ok) setReported(true);
              }}
            >
              {reported ? 'Reported — thank you' : 'Report this form'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
