import { create } from 'zustand';

const DRAFT_STORAGE_KEY = 'procure_request_wizard_draft';

const initialDraft = {
  step: 1,
  details: {
    title: '',
    budgetId: '',
    procurementType: 'competitive',
    priority: 'normal',
    neededByDate: '',
    justification: '',
    singleSourceJustification: '',
    currencyCode: 'USD'
  },
  lines: [
    {
      itemCode: '',
      description: '',
      category: '',
      quantity: 1,
      estimatedUnitCost: 0,
      uom: 'EA'
    }
  ]
};

const loadStoredDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return initialDraft;
    const parsed = JSON.parse(raw);
    return {
      step: parsed.step || 1,
      details: { ...initialDraft.details, ...(parsed.details || {}) },
      lines: parsed.lines && parsed.lines.length > 0 ? parsed.lines : initialDraft.lines
    };
  } catch (e) {
    console.error('Failed to load stored request draft:', e);
    return initialDraft;
  }
};

const persistDraft = (state) => {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        step: state.step,
        details: state.details,
        lines: state.lines
      })
    );
  } catch (e) {
    console.error('Failed to persist request draft:', e);
  }
};

export const useRequestDraftStore = create((set, get) => ({
  ...loadStoredDraft(),

  setStep: (step) => {
    set({ step });
    persistDraft(get());
  },

  updateDetails: (details) => {
    set((state) => ({
      details: { ...state.details, ...details }
    }));
    persistDraft(get());
  },

  setLines: (lines) => {
    set({ lines });
    persistDraft(get());
  },

  addLine: (line = { itemCode: '', description: '', category: '', quantity: 1, estimatedUnitCost: 0, uom: 'EA' }) => {
    set((state) => ({
      lines: [...state.lines, line]
    }));
    persistDraft(get());
  },

  removeLine: (index) => {
    set((state) => {
      const updated = state.lines.filter((_, i) => i !== index);
      return { lines: updated.length > 0 ? updated : initialDraft.lines };
    });
    persistDraft(get());
  },

  updateLine: (index, patch) => {
    set((state) => {
      const updated = [...state.lines];
      updated[index] = { ...updated[index], ...patch };
      return { lines: updated };
    });
    persistDraft(get());
  },

  resetDraft: () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    set({
      step: 1,
      details: { ...initialDraft.details },
      lines: [...initialDraft.lines]
    });
  }
}));

export default useRequestDraftStore;
