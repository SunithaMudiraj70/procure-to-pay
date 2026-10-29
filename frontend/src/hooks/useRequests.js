import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const useRequestsQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.requests.all(filters),
    queryFn: () => api.get('/requests', filters)
  });
};

export const useRequestDetailQuery = (prId) => {
  return useQuery({
    queryKey: queryKeys.requests.detail(prId),
    queryFn: () => api.get(`/requests/${prId}`),
    enabled: Boolean(prId)
  });
};

export const useRequestPreviewQuery = ({ total, budgetId }, options = {}) => {
  return useQuery({
    queryKey: queryKeys.requests.preview({ total, budgetId }),
    queryFn: () => api.get('/requests/preview', { total, budgetId }),
    enabled: Boolean(total !== undefined && total !== null && total > 0),
    ...options
  });
};

export const useRequestAuditQuery = (prId) => {
  return useQuery({
    queryKey: queryKeys.requests.audit(prId),
    queryFn: () => api.get(`/requests/${prId}/audit`),
    enabled: Boolean(prId)
  });
};

export const useCreateRequestMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: (payload) => api.post('/requests', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups.all });
      addToast({
        type: 'success',
        title: 'Draft Saved',
        message: `Purchase request ${data.pr_id} created successfully.`
      });
    },
    onError: (err) => {
      const detailsMsg = Array.isArray(err.details)
        ? `: ${err.details.map((d) => `${d.field ? d.field + ': ' : ''}${d.message}`).join(', ')}`
        : '';
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: `${err.message || 'Failed to create request'}${detailsMsg}`
      });
    }
  });
};

export const useSubmitRequestMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ prId, body }) => api.post(`/requests/${prId}/submit`, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(variables.prId) });
      addToast({
        type: 'success',
        title: 'Request Submitted',
        message: `Request ${variables.prId} submitted for approval (Level ${data.required_level}).`
      });
    },
    onError: (err) => {
      const detailsMsg = Array.isArray(err.details)
        ? `: ${err.details.map((d) => `${d.field ? d.field + ': ' : ''}${d.message}`).join(', ')}`
        : '';
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: `${err.message || 'Failed to submit request'}${detailsMsg}`
      });
    }
  });
};

export const useCreateRfqMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ prId, body }) => api.post(`/requests/${prId}/rfq`, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(variables.prId) });
      addToast({
        type: 'success',
        title: 'RFQ Issued',
        message: `RFQ ${data.rfq_id} issued with ${data.invited_suppliers} suppliers.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'RFQ Issuance Failed',
        message: err.message
      });
    }
  });
};

export const useCreateSingleSourcePoMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ prId, body }) => api.post(`/requests/${prId}/single-source-po`, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(variables.prId) });
      addToast({
        type: 'success',
        title: 'Purchase Order Issued',
        message: `PO ${data.po_id} issued directly for ${variables.prId}.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'PO Issuance Failed',
        message: err.message
      });
    }
  });
};
