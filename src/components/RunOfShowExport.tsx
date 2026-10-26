/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { useEventContext } from '../context/EventContext';
import {
  Printer,
  Download,
  Upload,
  RotateCcw,
  Calendar,
  CheckCircle,
  Phone,
  Mail,
  DollarSign,
  AlertCircle,
  FileText,
  FolderArchive,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '../utils/deterministicPlanner';

export const RunOfShowExport: React.FC = () => {
  const {
    activeEvent,
    budgetSummary,
    tasks,
    vendors,
    activePlan,
    exportStateToJson,
    importStateFromJson,
    resetToDefaults,
  } = useEventContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipDownloadStatus, setZipDownloadStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!activeEvent) return null;

  const currency = activeEvent.currency;

  const handleDownloadSourceZip = async () => {
    setIsDownloadingZip(true);
    setZipDownloadStatus(null);
    try {
      const res = await fetch('/api/download-zip');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'celebria-ai-source.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const sizeKb = (blob.size / 1024).toFixed(1);
      setZipDownloadStatus({
        success: true,
        message: `Successfully downloaded celebria-ai-source.zip (${sizeKb} KB). Includes all React/TypeScript components, Express server, Gemini integration, 16 automated tests, and Docker deployment config!`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown download error';
      setZipDownloadStatus({
        success: false,
        message: `Download failed: ${errorMsg}. You can also open /api/download-zip in a new browser tab.`,
      });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportStateToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `celebria-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importStateFromJson(content);
      setImportStatus(res);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (
      confirm(
        'Reset all events to the default demonstration templates? (Sophia & Liam Wedding, Marcus 40th Birthday, and Oakridge Festival)'
      )
    ) {
      resetToDefaults();
      alert('Workspace reset to factory templates.');
    }
  };

  // Day-of tasks or final phase tasks
  const dayOfTasks = tasks.filter(
    (t) => t.phase === 'phase_day_of' || t.phase === 'phase_week_of'
  );

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar (Hidden in print) */}
      <div className="no-print bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight">
            Celebration Run-of-Show & Data Exports
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Printable master event brief, vendor roster, and full JSON backup/restore
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadSourceZip}
            disabled={isDownloadingZip}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 disabled:opacity-60 rounded-lg transition-colors shadow-xs"
            title="Download full project source code as celebria-ai-source.zip"
          >
            {isDownloadingZip ? (
              <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
            ) : (
              <FolderArchive className="w-4 h-4 text-amber-300" />
            )}
            <span>{isDownloadingZip ? 'Packaging Source ZIP...' : 'Download Source (.ZIP)'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Print Run-of-Show (PDF)</span>
          </button>

          <button
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Download JSON</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors shadow-xs"
          >
            <Upload className="w-4 h-4 text-stone-600" />
            <span>Restore Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
            title="Reset to default templates"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      {/* ZIP Download Status Banner */}
      {zipDownloadStatus && (
        <div
          role="alert"
          className={`no-print p-3.5 rounded-xl text-xs flex items-start gap-2.5 shadow-2xs ${
            zipDownloadStatus.success
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
          }`}
        >
          {zipDownloadStatus.success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">
              {zipDownloadStatus.success ? 'Project Export Ready' : 'Download Notice'}
            </span>
            <span>{zipDownloadStatus.message}</span>
          </div>
        </div>
      )}

      {importStatus && (
        <div
          role="alert"
          className={`no-print p-3 rounded-lg text-xs flex items-center gap-2 ${
            importStatus.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {importStatus.success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* MASTER EVENT BRIEF (Optimized for Screen & Print) */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b border-stone-200 pb-6 print:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-2xs font-bold uppercase tracking-widest text-indigo-900 block mb-1">
                Celebria AI · Master Celebration Brief
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                {activeEvent.name}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">
                {activeEvent.type.toUpperCase()} · {activeEvent.date} {activeEvent.time ? `at ${activeEvent.time}` : ''} · {activeEvent.location}
              </p>
            </div>

            <div className="text-right text-xs text-stone-500 font-mono">
              <div>Guest Count: <strong className="text-stone-900">{activeEvent.guestCount}</strong></div>
              <div>Total Budget: <strong className="text-stone-900">{formatCurrency(activeEvent.totalBudget, currency)}</strong></div>
              <div>Setting: <strong className="text-stone-900">{activeEvent.venueType}</strong></div>
            </div>
          </div>

          {activeEvent.notes && (
            <p className="text-xs text-stone-600 mt-3 pt-3 border-t border-stone-100 italic">
              Special Notes: {activeEvent.notes}
            </p>
          )}
        </div>

        {/* Section 1: Executive Strategic Overview */}
        {activePlan && (
          <div className="space-y-2 print-break-inside-avoid">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              1. Celebration Overview & Strategic Narrative
            </h3>
            <p className="text-xs sm:text-sm text-stone-800 leading-relaxed bg-stone-50 print:bg-transparent p-4 print:p-0 rounded-lg border border-stone-200 print:border-none">
              {activePlan.planningStrategy}
            </p>
          </div>
        )}

        {/* Section 2: Day-of Timeline & Execution Milestones */}
        <div className="space-y-3 print-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-stone-200 pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              2. Day-of Run-of-Show Milestones
            </h3>
            <span className="text-2xs text-stone-400 font-mono">
              ({dayOfTasks.length} milestones)
            </span>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {dayOfTasks.length > 0 ? (
              dayOfTasks.map((t) => (
                <div key={t.id} className="py-2.5 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="font-bold text-stone-900 flex items-center gap-2">
                      <span>{t.title}</span>
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded-xs bg-stone-100 text-stone-700">
                        {t.category}
                      </span>
                    </div>
                    {t.description && <p className="text-2xs text-stone-600">{t.description}</p>}
                  </div>
                  <div className="text-right shrink-0 font-mono text-2xs text-stone-500">
                    <div>{t.dueDate}</div>
                    <div className="text-stone-700 font-semibold">{t.priority.toUpperCase()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3 text-2xs text-stone-500 italic">
                No day-of milestones scheduled. Add tasks in the Timeline tab under "Day of Celebration".
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Vendor Roster & Contacts Directory */}
        <div className="space-y-3 print-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-stone-200 pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              3. Vendor Directory & Contact Roster
            </h3>
            <span className="text-2xs text-stone-400 font-mono">
              ({vendors.length} vendors)
            </span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-2xs uppercase text-stone-400">
                <th className="py-2">Vendor & Category</th>
                <th className="py-2">Contact Person</th>
                <th className="py-2">Phone / Email</th>
                <th className="py-2 text-right">Status</th>
                <th className="py-2 text-right">Contract Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {vendors.length > 0 ? (
                vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 font-semibold text-stone-900">
                      <div>{v.name}</div>
                      <div className="text-2xs font-normal text-stone-500">{v.category}</div>
                    </td>
                    <td className="py-2 text-stone-700">{v.contactPerson || '—'}</td>
                    <td className="py-2 text-stone-600 font-mono text-2xs">
                      {v.phone && <div>{v.phone}</div>}
                      {v.email && <div>{v.email}</div>}
                    </td>
                    <td className="py-2 text-right font-medium text-stone-800">
                      {v.status.toUpperCase()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-stone-900 font-medium">
                      {v.contractPrice
                        ? formatCurrency(v.contractPrice, currency)
                        : v.quotedPrice
                        ? `(Est) ${formatCurrency(v.quotedPrice, currency)}`
                        : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-stone-400 italic">
                    No vendors listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Section 4: Budget Reconciliation Audit */}
        <div className="space-y-3 print-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-stone-200 pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              4. Financial Reconciliation Summary
            </h3>
            <span className="text-2xs text-stone-700 font-mono">
              Budget: {formatCurrency(budgetSummary.totalBudget, currency)} · Spent:{' '}
              {formatCurrency(budgetSummary.totalActual, currency)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-stone-50 print:bg-transparent p-4 print:p-0 rounded-lg">
            <div>
              <span className="text-2xs text-stone-500 uppercase block">Total Ceiling</span>
              <span className="font-bold font-mono tabular-nums text-stone-900">
                {formatCurrency(budgetSummary.totalBudget, currency)}
              </span>
            </div>
            <div>
              <span className="text-2xs text-stone-500 uppercase block">Total Planned</span>
              <span className="font-bold font-mono tabular-nums text-stone-900">
                {formatCurrency(budgetSummary.totalPlanned, currency)}
              </span>
            </div>
            <div>
              <span className="text-2xs text-stone-500 uppercase block">Actual Spent</span>
              <span className="font-bold font-mono tabular-nums text-stone-900">
                {formatCurrency(budgetSummary.totalActual, currency)}
              </span>
            </div>
            <div>
              <span className="text-2xs text-stone-500 uppercase block">Remaining Balance</span>
              <span
                className={`font-bold font-mono tabular-nums ${
                  budgetSummary.remainingBalance < 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(budgetSummary.remainingBalance, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Inclusivity & Emergency Contingencies */}
        <div className="space-y-3 print-break-inside-avoid border-t border-stone-200 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            5. Inclusivity Protocols & Emergency Contingencies
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-stone-50 print:bg-transparent rounded-lg border border-stone-200 print:border-none">
              <span className="font-bold text-stone-900 block mb-1">
                Dietary & Allergen Protocol:
              </span>
              <p className="text-stone-700">
                {activeEvent.dietaryRequirements.join(', ') || 'No special dietary restrictions logged.'}
              </p>
            </div>
            <div className="p-3 bg-stone-50 print:bg-transparent rounded-lg border border-stone-200 print:border-none">
              <span className="font-bold text-stone-900 block mb-1">
                Accessibility Accommodations:
              </span>
              <p className="text-stone-700">
                {activeEvent.accessibilityNeeds.join(', ') || 'Standard accessibility verified.'}
              </p>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="border-t border-stone-200 pt-4 text-center text-2xs text-stone-400">
          Generated with Celebria AI — “Your vision. Your budget. Your perfect celebration.”
        </div>
      </div>
    </div>
  );
};
