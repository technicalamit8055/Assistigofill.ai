'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card, Input, Spinner } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

type SearchResult = {
  id: string;
  displayName: string;
  customerCode: string;
  mobileLast4: string | null;
  district: string | null;
  state: string | null;
  verificationStatus: string;
};

/**
 * Live search over name/mobile/customer code/village/district (spec §7.3.2). Hits the
 * `search_customers` RPC via /api/customers/search rather than the plain list query, since the
 * dashboard list is only the 25 most recent records.
 */
export function CustomerSearchBox() {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === '') {
      setResults(null);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(response)))
        .then((body: { data: { customers: SearchResult[] } }) => {
          setResults(body.data.customers);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('customers.searchPlaceholder')}
          aria-label={t('common.search')}
        />
        {loading ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        ) : null}
      </div>

      {results !== null ? (
        <Card className="p-0">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">{t('customers.empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    href={`/customers/${result.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {result.displayName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {result.customerCode}
                        {result.district ? ` · ${result.district}` : ''}
                        {result.mobileLast4 ? ` · •••••• ${result.mobileLast4}` : ''}
                      </p>
                    </div>
                    <Badge tone="neutral" className="shrink-0">
                      {result.verificationStatus}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
