import { useQuery } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';

export const useLookupsQuery = () => {
  return useQuery({
    queryKey: queryKeys.lookups.all,
    queryFn: () => api.get('/lookups'),
    staleTime: 5 * 60 * 1000 // 5 minutes cache
  });
};

export const useUsersQuery = () => {
  return useQuery({
    queryKey: queryKeys.lookups.users,
    queryFn: () => api.get('/lookups/users'),
    staleTime: 5 * 60 * 1000
  });
};
