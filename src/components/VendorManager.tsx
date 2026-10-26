/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import {
  VendorEntry,
  VendorStatus,
  VENDOR_STATUSES,
} from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  DollarSign,
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  X,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '../utils/deterministicPlanner';

export const VendorManager: React.FC = () => {
  const {
    activeEvent,
    vendors,
    vendorSummary,
    addVendor,
    updateVendor,
    deleteVendor,
  } = useEventContext();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorEntry | null>(null);

  // Form inputs
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Venue');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<VendorStatus>('identified');
  const [formQuoted, setFormQuoted] = useState<number>(0);
  const [formContracted, setFormContracted] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  if (!activeEvent) return null;

  const currency = activeEvent.currency;

  const openAddModal = (defaultCat?: string) => {
    setEditingVendor(null);
    setFormName('');
    setFormCategory(defaultCat || 'Venue');
    setFormContact('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('identified');
    setFormQuoted(0);
    setFormContracted(0);
    setFormNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (v: VendorEntry) => {
    setEditingVendor(v);
    setFormName(v.name);
    setFormCategory(v.category);
    setFormContact(v.contactPerson || '');
    setFormEmail(v.email || '');
    setFormPhone(v.phone || '');
    setFormStatus(v.status);
    setFormQuoted(v.quotedPrice || 0);
    setFormContracted(v.contractPrice || 0);
    setFormNotes(v.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Vendor or company name is required.');
      return;
    }

    const payload = {
      name: formName.trim(),
      category: formCategory.trim() || 'General Service',
      contactPerson: formContact.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      status: formStatus,
      quotedPrice: Number(formQuoted) > 0 ? Number(formQuoted) : undefined,
      contractPrice: Number(formContracted) > 0 ? Number(formContracted) : undefined,
      notes: formNotes.trim() || undefined,
    };

    if (editingVendor) {
      updateVendor(editingVendor.id, payload);
    } else {
      addVendor({
        ...payload,
        eventId: activeEvent.id,
      });
    }
    setModalOpen(false);
  };

  // Filter vendors
  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Vendor Status Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Vendors
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-stone-900 mt-1">
            {vendorSummary.totalVendors}
          </div>
          <div className="text-xs text-stone-500 mt-1">Tracked in directory</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Contracted & Booked
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {vendorSummary.bookedVendors}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Committed: {formatCurrency(vendorSummary.contractedTotal, currency)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Quotes Under Review
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-indigo-950 mt-1">
            {vendorSummary.quotedVendors}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Quoted total: {formatCurrency(vendorSummary.quotedTotal, currency)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Initial Inquiries
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-stone-900 mt-1">
            {vendorSummary.inquiredVendors}
          </div>
          <div className="text-xs text-stone-500 mt-1">Awaiting price quotes</div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendors by name, category, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800 bg-white focus:border-indigo-600"
              aria-label="Filter vendors by status"
            >
              <option value="all">All Statuses</option>
              {VENDOR_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => openAddModal()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vendor</span>
        </button>
      </div>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.length > 0 ? (
          filteredVendors.map((vendor) => {
            return (
              <div
                key={vendor.id}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-stone-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-2xs font-semibold uppercase tracking-wider text-stone-400">
                        {vendor.category}
                      </span>
                      <h4 className="text-base font-bold text-stone-900 tracking-tight mt-0.5">
                        {vendor.name}
                      </h4>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-2xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        vendor.status === 'booked'
                          ? 'bg-emerald-100 text-emerald-800'
                          : vendor.status === 'quoted'
                          ? 'bg-indigo-100 text-indigo-800'
                          : vendor.status === 'inquired'
                          ? 'bg-amber-100 text-amber-800'
                          : vendor.status === 'declined'
                          ? 'bg-stone-100 text-stone-500'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {VENDOR_STATUSES.find((s) => s.id === vendor.status)?.label || vendor.status}
                    </span>
                  </div>

                  {/* Financial terms */}
                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-2xs text-stone-400 block uppercase">Quoted</span>
                      <span className="font-semibold text-stone-800 tabular-nums">
                        {vendor.quotedPrice ? formatCurrency(vendor.quotedPrice, currency) : 'TBD'}
                      </span>
                    </div>
                    {vendor.contractPrice && (
                      <div className="text-right">
                        <span className="text-2xs text-stone-400 block uppercase">Contract</span>
                        <span className="font-bold text-emerald-700 tabular-nums">
                          {formatCurrency(vendor.contractPrice, currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact details */}
                  <div className="mt-3 space-y-1 text-xs text-stone-600">
                    {vendor.contactPerson && (
                      <div className="font-medium text-stone-800">
                        Contact: {vendor.contactPerson}
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-1.5 text-stone-500 truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                        <span className="truncate">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-1.5 text-stone-500">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                        <span>{vendor.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes & search criteria */}
                  {vendor.notes && (
                    <div className="mt-3 p-2.5 rounded-md bg-stone-50 border border-stone-100 text-2xs text-stone-600 leading-relaxed">
                      {vendor.notes}
                    </div>
                  )}

                  {/* AI Negotiation Tips */}
                  {vendor.negotiationTips && vendor.negotiationTips.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-stone-100">
                      <span className="text-2xs font-semibold text-indigo-900 block mb-1">
                        AI Recommended Questions:
                      </span>
                      <ul className="text-2xs text-stone-600 space-y-0.5 list-disc pl-3">
                        {vendor.negotiationTips.slice(0, 2).map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {/* Status quick toggle */}
                    <button
                      onClick={() =>
                        updateVendor(vendor.id, {
                          status: vendor.status === 'booked' ? 'quoted' : 'booked',
                        })
                      }
                      className={`text-2xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        vendor.status === 'booked'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      {vendor.status === 'booked' ? '✓ Contracted' : 'Mark Contracted'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(vendor)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                      title="Edit vendor"
                      aria-label={`Edit ${vendor.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove vendor "${vendor.name}"?`)) {
                          deleteVendor(vendor.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Delete vendor"
                      aria-label={`Delete ${vendor.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-500">
            No vendors found. Click "Add Vendor" to record supplier quotes and contact details.
          </div>
        )}
      </div>

      {/* Add / Edit Vendor Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-modal-title"
        >
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h3 id="vendor-modal-title" className="text-sm font-bold text-stone-900 tracking-tight">
                {editingVendor ? 'Edit Vendor Details' : 'Add New Vendor'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Vendor / Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Napa Valley Floral Co., Soundwave DJ Collective"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Vendor Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
                  >
                    <option value="Venue">Venue & Pavilion</option>
                    <option value="Catering & Bar">Catering & Bar</option>
                    <option value="Photography / Video">Photography / Video</option>
                    <option value="Florals & Decor">Florals & Decor</option>
                    <option value="Entertainment / DJ">Entertainment / DJ / Band</option>
                    <option value="Transportation">Transportation & Shuttles</option>
                    <option value="Invitations & Print">Invitations & Signage</option>
                    <option value="Rentals & AV">Rentals (Tables, Tents, AV)</option>
                    <option value="Other">Other Event Services</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Pipeline Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as VendorStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 bg-white focus:border-indigo-600"
                  >
                    {VENDOR_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Quoted Price ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formQuoted}
                    onChange={(e) => setFormQuoted(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 font-mono focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Final Contract Price ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formContracted}
                    onChange={(e) => setFormContracted(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 font-mono focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Coordinator name"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="vendor@email.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Notes & Proposal Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Includes 2 wireless mics, requires 2-hour setup buffer"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs"
                >
                  {editingVendor ? 'Save Updates' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
