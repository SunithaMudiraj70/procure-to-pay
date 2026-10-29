import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const useRfqsQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.rfqs.all(filters),
    queryFn: () => api.get('/rfqs', filters)
  });
};

export const useRfqComparisonQuery = (rfqId) => {
  return useQuery({
    queryKey: queryKeys.rfqs.comparison(rfqId),
    queryFn: () => api.get(`/rfqs/${rfqId}/comparison`),
    enabled: Boolean(rfqId)
  });
};

export const useAddQuoteMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ rfqId, body }) => api.post(`/rfqs/${rfqId}/quotes`, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.rfqs.comparison(variables.rfqId) });
      addToast({
        type: 'success',
        title: 'Quote Recorded',
        message: `Quote ${data.quote_id} added successfully.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Quote Submission Failed',
        message: err.message
      });
    }
  });
};

export const useEvaluateRfqMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: (rfqId) => api.post(`/rfqs/${rfqId}/evaluate`, {}),
    onSuccess: (data, rfqId) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.rfqs.comparison(rfqId) });
      addToast({
        type: 'success',
        title: 'Evaluation Complete',
        message: `Evaluation run ${data.evaluation_run} scored ${data.quotes_evaluated} quotes.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Evaluation Failed',
        message: err.message
      });
    }
  });
};

export const useAwardRfqMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ rfqId, body }) => api.post(`/rfqs/${rfqId}/award`, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.rfqs.comparison(variables.rfqId) });
      addToast({
        type: 'success',
        title: 'Quote Awarded',
        message: `Award ${data.award_id} created for quote ${data.quote_id}.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Award Failed',
        message: err.message
      });
    }
  });
};

export const useCreatePoFromRfqMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: (rfqId) => api.post(`/rfqs/${rfqId}/purchase-order`, {}),
    onSuccess: (data, rfqId) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rfqs.comparison(rfqId) });
      addToast({
        type: 'success',
        title: 'Purchase Order Generated',
        message: `PO ${data.po_id} issued successfully.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'PO Generation Failed',
        message: err.message
      });
    }
  });
};
