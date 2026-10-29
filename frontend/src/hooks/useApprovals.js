import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const useApprovalsQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.approvals.all(filters),
    queryFn: () => api.get('/approvals', filters)
  });
};

export const useDecideApprovalMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ approvalId, decision, comments }) =>
      api.post(`/approvals/${approvalId}/decision`, { decision, comments }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups.all });
      addToast({
        type: data.approval.decision === 'approved' ? 'success' : 'warning',
        title: `Approval ${data.approval.decision === 'approved' ? 'Granted' : 'Rejected'}`,
        message: `Decision recorded for request ${data.pr_id}. Status: ${data.pr_status}`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Decision Failed',
        message: err.message
      });
    }
  });
};
