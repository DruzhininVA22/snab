import * as React from 'react';
import { useLocation } from 'react-router-dom';
import QuotationsListView from './QuotationsPageListView';
import QuotationDetailPage from './QuotationDetailPage';

/**
 * Wrapper-page for Quotes.
 *
 * ВАЖНО: не делаем условные хуки.
 * Этот компонент всегда вызывает один и тот же набор хуков,
 * а ветвление делаем через рендер разных подкомпонентов.
 */
export default function QuotationsPage() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const quoteIdStr = params.get('quote_id');
  const quoteId = quoteIdStr ? Number(quoteIdStr) : null;

  if (quoteId && Number.isFinite(quoteId)) {
    return <QuotationDetailPage quoteId={quoteId} />;
  }

  return <QuotationsListView />;
}
