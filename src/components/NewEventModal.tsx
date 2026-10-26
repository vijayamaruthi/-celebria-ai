/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useEventContext } from '../context/EventContext';
import { CelebrationEvent, EventType, VenueType } from '../types';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { generateDeterministicPlan } from '../utils/deterministicPlanner';

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: CelebrationEvent | null;
}

export const NewEventModal: React.FC<NewEventModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
}) => {
  const { createEvent, updateEvent, applyPlanToWorkspace } = useEventContext();

  const [step, setStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<EventType>('wedding');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('16:00');
  const [location, setLocation] = useState('');
  const [venueType, setVenueType] = useState<VenueType>('hybrid');
  const [guestCount, setGuestCount] = useState<number>(100);
  const [totalBudget, setTotalBudget] = useState<number>(20000);
  const [currency, setCurrency] = useState('USD');
  const [theme, setTheme] = useState('');
  const [priorityInput, setPriorityInput] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [dietaryInput, setDietaryInput] = useState('');
  const [dietaryRequirements, setDietaryRequirements] = useState<string[]>([]);
  const [accessibilityInput, setAccessibilityInput] = useState('');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Preset priority suggestions
  const prioritySuggestions = [
    'Documentary Photography & Video',
    'Exceptional Gourmet Catering',
    'Live Music & Energetic Band/DJ',
    'Focal Floral & Ambient Lighting Decor',
    'Interactive Guest Experiences',
    'Accessible Navigation & Zero-Waste Sustainability',
  ];

  const dietarySuggestions = [
    'Vegetarian Options',
    'Vegan Options',
    'Gluten-Free / Celiac Safe',
    'Nut-Free Kitchen Protocol',
    'Halal Options',
    'Kosher Options',
  ];

  const accessibilitySuggestions = [
    'Step-Free Entrance & Wheelchair Ramps',
    'Dedicated Quiet Sensory Lounge Area',
    'Sign Language (ASL) Interpreter',
    'Reserved Front-Row Accessible Seating',
    'Large Print / Braille Day-of Schedules',
  ];

  useEffect(() => {
    if (eventToEdit) {
      setName(eventToEdit.name);
      setType(eventToEdit.type);
      setDate(eventToEdit.date);
      setTime(eventToEdit.time || '16:00');
      setLocation(eventToEdit.location);
      setVenueType(eventToEdit.venueType);
      setGuestCount(eventToEdit.guestCount);
      setTotalBudget(eventToEdit.totalBudget);
      setCurrency(eventToEdit.currency);
      setTheme(eventToEdit.theme);
      setPriorities(eventToEdit.priorities || []);
      setDietaryRequirements(eventToEdit.dietaryRequirements || []);
      setAccessibilityNeeds(eventToEdit.accessibilityNeeds || []);
      setNotes(eventToEdit.notes || '');
      setStep(1);
    } else {
      // Default future date 90 days ahead
      const future = new Date();
      future.setDate(future.getDate() + 90);
      setName('');
      setType('wedding');
      setDate(future.toISOString().split('T')[0]);
      setTime('16:00');
      setLocation('');
      setVenueType('hybrid');
      setGuestCount(80);
      setTotalBudget(15000);
      setCurrency('USD');
      setTheme('');
      setPriorities(['Documentary Photography & Video', 'Exceptional Gourmet Catering']);
      setDietaryRequirements(['Vegetarian Options', 'Nut-Free Kitchen Protocol']);
      setAccessibilityNeeds(['Step-Free Entrance & Wheelchair Ramps']);
      setNotes('');
      setStep(1);
    }
    setErrorMsg('');
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = (
    item: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmed = item.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const handleRemoveTag = (
    itemToRemove: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter((x) => x !== itemToRemove));
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Please enter a name for the celebration.');
        return;
      }
      if (!date) {
        setErrorMsg('Please select a target celebration date.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (guestCount <= 0 || isNaN(guestCount)) {
        setErrorMsg('Guest count must be at least 1 person.');
        return;
      }
      if (totalBudget < 0 || isNaN(totalBudget)) {
        setErrorMsg('Total budget must be a positive number.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Event name is required.');
      setStep(1);
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      date,
      time,
      location: location.trim() || 'Venue TBD',
      venueType,
      guestCount: Math.max(1, Number(guestCount) || 1),
      totalBudget: Math.max(0, Number(totalBudget) || 0),
      currency,
      theme: theme.trim() || `${type.charAt(0).toUpperCase() + type.slice(1)} Celebration`,
      priorities,
      dietaryRequirements,
      accessibilityNeeds,
      notes: notes.trim(),
    };

    if (eventToEdit) {
      updateEvent(eventToEdit.id, payload);
      onClose();
    } else {
      const created = createEvent(payload);
      // Auto-initialize seed plan
      const plan = generateDeterministicPlan(created);
      applyPlanToWorkspace(plan);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/60">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-stone-900 tracking-tight">
              {eventToEdit ? 'Edit Celebration Details' : 'Design New Celebration'}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Step {step} of 4 · {step === 1 ? 'Core Details' : step === 2 ? 'Guest Scale & Budget' : step === 3 ? 'Aesthetic & Priorities' : 'Logistics & Inclusivity'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="w-full bg-stone-100 h-1">
          <div
            className="bg-indigo-900 h-1 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="event-name" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Event Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="event-name"
                  type="text"
                  required
                  placeholder="e.g. Maya & Alex's Coastal Wedding, Leo's 50th Gala"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-type" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Event Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="event-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as EventType)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm bg-white focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <option value="wedding">Wedding Celebration</option>
                    <option value="birthday">Birthday Party</option>
                    <option value="community">Community Event / Festival</option>
                    <option value="gala">Charity Gala / Fundraiser</option>
                    <option value="anniversary">Anniversary Gathering</option>
                    <option value="baby_shower">Baby Shower / Family Welcome</option>
                    <option value="other">Custom Celebration</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="venue-type" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Setting / Venue Preference
                  </label>
                  <select
                    id="venue-type"
                    value={venueType}
                    onChange={(e) => setVenueType(e.target.value as VenueType)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm bg-white focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <option value="indoor">Indoor (Ballroom, Loft, Gallery)</option>
                    <option value="outdoor">Outdoor (Garden, Park, Vineyard, Beach)</option>
                    <option value="hybrid">Hybrid (Outdoor Ceremony + Covered Reception)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-date" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Target Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="event-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="event-time" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Start Time
                  </label>
                  <input
                    id="event-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="event-location" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Location or City
                </label>
                <input
                  id="event-location"
                  type="text"
                  placeholder="e.g. Sonoma County, San Francisco Conservatory, Local Civic Park"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
                />
              </div>
            </div>
          )}

          {/* STEP 2: SCALE & BUDGET */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="guest-count" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Expected Number of Guests <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="guest-count"
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600 font-mono tabular-nums"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Catering and venue ratios will calibrate to this count.
                  </p>
                </div>

                <div>
                  <label htmlFor="currency" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm bg-white focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600 font-mono"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="total-budget" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Total Spending Budget <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-stone-500 text-sm font-mono">
                    {currency}
                  </span>
                  <input
                    id="total-budget"
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                    className="w-full pl-16 pr-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600 font-mono tabular-nums"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500 mt-1.5">
                  <span>
                    Approx. per guest:{' '}
                    <strong className="font-mono tabular-nums text-stone-800">
                      ${guestCount > 0 ? Math.round(totalBudget / guestCount) : 0}
                    </strong>
                  </span>
                  <span>Includes 8-10% suggested contingency cushion</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: THEME & PRIORITIES */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="event-theme" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Preferred Style or Aesthetic Theme
                </label>
                <input
                  id="event-theme"
                  type="text"
                  placeholder="e.g. Modern Minimalist, Botanical Garden Elegance, Vintage Vinyl Speakeasy"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Key Priorities (Where to allocate focus and funds)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type custom priority and press Add"
                    value={priorityInput}
                    onChange={(e) => setPriorityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(priorityInput, priorities, setPriorities, setPriorityInput);
                      }
                    }}
                    className="flex-1 px-3.5 py-2 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(priorityInput, priorities, setPriorities, setPriorityInput)}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>

                {/* Selected priorities */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {priorities.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-medium"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(item, priorities, setPriorities)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* Quick suggestions */}
                <div className="mt-3">
                  <span className="text-xs text-stone-500 font-medium">Quick suggestions:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {prioritySuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          if (!priorities.includes(sug)) setPriorities([...priorities, sug]);
                        }}
                        className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
                          priorities.includes(sug)
                            ? 'bg-indigo-900 text-white border-indigo-900'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: LOGISTICS & INCLUSIVITY */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Dietary Accommodations
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {dietarySuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        if (dietaryRequirements.includes(item)) {
                          handleRemoveTag(item, dietaryRequirements, setDietaryRequirements);
                        } else {
                          setDietaryRequirements([...dietaryRequirements, item]);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        dietaryRequirements.includes(item)
                          ? 'bg-indigo-900 text-white border-indigo-900'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {dietaryRequirements.includes(item) ? '✓ ' : '+ '}
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Custom allergy or dietary preference"
                    value={dietaryInput}
                    onChange={(e) => setDietaryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(dietaryInput, dietaryRequirements, setDietaryRequirements, setDietaryInput);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-stone-900 text-xs focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(dietaryInput, dietaryRequirements, setDietaryRequirements, setDietaryInput)}
                    className="px-3 py-1.5 bg-stone-100 text-stone-700 text-xs rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Accessibility & Inclusivity Protocols
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {accessibilitySuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        if (accessibilityNeeds.includes(item)) {
                          handleRemoveTag(item, accessibilityNeeds, setAccessibilityNeeds);
                        } else {
                          setAccessibilityNeeds([...accessibilityNeeds, item]);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        accessibilityNeeds.includes(item)
                          ? 'bg-indigo-900 text-white border-indigo-900'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {accessibilityNeeds.includes(item) ? '✓ ' : '+ '}
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Other accessibility requirement"
                    value={accessibilityInput}
                    onChange={(e) => setAccessibilityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(accessibilityInput, accessibilityNeeds, setAccessibilityNeeds, setAccessibilityInput);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-stone-900 text-xs focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(accessibilityInput, accessibilityNeeds, setAccessibilityNeeds, setAccessibilityInput)}
                    className="px-3 py-1.5 bg-stone-100 text-stone-700 text-xs rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="event-notes" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Special Notes or Family Traditions
                </label>
                <textarea
                  id="event-notes"
                  rows={2}
                  placeholder="e.g. Surprise dance tribute at 8 PM, elderly guests need quiet lounge, bring commemorative guestbook"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-stone-900 text-sm focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          {/* Footer controls */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-lg"
              >
                Cancel
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs transition-colors"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{eventToEdit ? 'Save Changes' : 'Launch Celebration Plan'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
