import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { buildPages, ROLE_NAMES } from './content';
import { annotate, renderPages } from './BookPages';
import './manual-book.css';

/// Printable manual: every page at real short-bond size, one per sheet.
///   #/manual-print/<role>          farm letterhead (role = agronomist | farm_owner | field_staff | admin | all)
///   #/manual-print/all?v=bsu&start=258   BSU header for the manuscript appendix, page numbers from 258
///   add &lang=tl or &lang=taglish for the Tagalog or Taglish edition
export default function ManualPrint() {
  const { role = 'all' } = useParams();
  const [q] = useSearchParams();
  const variant = q.get('v') === 'bsu' ? 'bsu' : 'farm';
  const start = parseInt(q.get('start') || '1', 10) || 1;
  const lang = ['tl', 'taglish'].includes(q.get('lang')) ? q.get('lang') : 'en';
  const safeRole = role === 'all' || ROLE_NAMES[role] ? role : 'all';
  const pages = useMemo(() => annotate(buildPages(safeRole, lang), start), [safeRole, start, lang]);

  return (
    <div className="mb-print">
      <div className="mb-print-bar">
        <button className="btn green sm" onClick={() => window.print()}>Print or save as PDF</button>
        <span style={{ color: '#dfe6d8', fontSize: 13, alignSelf: 'center' }}>
          Paper: Letter (short bond, 8.5 × 11 in). Margins: none. Background graphics: on.
        </span>
      </div>
      {renderPages(pages, { role: safeRole, variant, lang })}
    </div>
  );
}
