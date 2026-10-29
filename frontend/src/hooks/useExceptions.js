import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const useExceptionsQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.exceptions.all(filters),
    queryFn: () => api.get('/exceptions', filters)
  });
};

export const useViolationsQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.exceptions.violations(filters),
    queryFn: () => api.get('/violations', filters)
  });
};

export const useResolveExceptionMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ exceptionId, status, note }) =>
      api.post(`/exceptions/${exceptionId}/resolve`, { status, note }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['violations'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      addToast({
        type: 'success',
        title: `Exception ${variables.status === 'resolved' ? 'Resolved' : 'Waived'}`,
        message: `Exception ${variables.exceptionId} marked as ${variables.status}.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Resolution Failed',
        message: err.message
      });
    }
  });
};
