import { useEffect, useRef, useState } from 'react';
import { send } from './send';
import { AlertIcon, CheckIcon, SearchIcon } from './Brand';
import type { CustomerSummary } from './messages';

/**
 * Customer selector (spec §7.4.3).
 *
 * The operator must always know who they are filling for, so the selected customer's name and
 * the last four digits of their mobile stay visible everywhere this is used (§8.2). Once someone
 * is selected the search collapses — the selected card is the thing that must not be missed.
 */

/** Initials for the avatar. Derived in the UI only; never stored, never sent anywhere. */
function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function CustomerPicker({
  selected,
  onSelect,
}: {
  selected: CustomerSummary | null;
  onSelect: (customer: CustomerSummary) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSearch = open || !selected;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    // Debounced: an operator types a name fast, and every keystroke is a database query.
    timer.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setError(null);
        const response = await send<{ customers: CustomerSummary[] }>({
          type: 'SEARCH_CUSTOMERS',
          query: query.trim(),
        });
        setSearching(false);
        if (response.ok) setResults(response.data.customers);
        else setError('Could not search right now.');
      })();
    }, 250);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const choose = (customer: CustomerSummary) => {
    onSelect(customer);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="stack-sm">
      {selected ? (
        <div className="customer-bar">
          <div className="row">
            <div className="avatar" aria-hidden="true">
              {initials(selected.displayName)}
            </div>
            <div className="grow">
              <div className="strong truncate">{selected.displayName}</div>
              <div className="tiny muted truncate">
                {selected.customerCode ? `${selected.customerCode} · ` : ''}
                {selected.mobileLast4 ? `••••${selected.mobileLast4}` : 'no mobile on file'}
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost tiny"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              {open ? 'Cancel' : 'Change'}
            </button>
          </div>
        </div>
      ) : (
        <div className="notice notice-warn">
          <AlertIcon size={13} />
          <span>Select a customer before filling any form.</span>
        </div>
      )}

      {showSearch ? (
        <>
          <div className="search-wrap">
            <SearchIcon size={13} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, mobile or code"
              aria-label="Search customers"
              autoFocus={open}
            />
          </div>

          {searching ? (
            <p className="tiny muted row">
              <span className="spinner spinner-ink" />
              Searching…
            </p>
          ) : null}

          {error ? (
            <p className="tiny" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          ) : null}

          {!searching && query.trim().length >= 2 && results.length === 0 && !error ? (
            <p className="tiny muted">No customer matches that.</p>
          ) : null}

          {results.length > 0 ? (
            <div className="card card-flush result-list">
              {results.map((customer) => {
                const isSelected = customer.id === selected?.id;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className="result-item"
                    onClick={() => choose(customer)}
                  >
                    <span className="spread">
                      <span className="grow truncate">
                        {/* Operator-entered text, rendered as text — never as markup (§19.6). */}
                        {customer.displayName}
                      </span>
                      {isSelected ? <CheckIcon size={13} className="muted" /> : null}
                    </span>
                    <span className="tiny muted truncate" style={{ display: 'block' }}>
                      {customer.customerCode}
                      {customer.mobileLast4 ? ` · ••••${customer.mobileLast4}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
