import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

interface BadgeCounts {
  notifications: number;
  verifications: number;
  redemptions: number;
  risk: number;
}

/**
 * A single polled query feeds every navigation badge, rather than each nav item
 * mounting its own request.
 */
export function useBadgeCounts(): BadgeCounts {
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  const staffCounts = useQuery({
    queryKey: ['badges', 'staff'],
    queryFn: async () => {
      const [queue, redemptions, risk] = await Promise.all([
        api.get<{ pending: number }>('/verifications/stats'),
        api.get<{ pagination: { total: number } }>('/redemptions/admin', { query: { status: 'POINTS_LOCKED', pageSize: 1 } }),
        api.get<{ pagination: { total: number } }>('/risk', { query: { status: 'OPEN', pageSize: 1 } }),
      ]);
      return {
        verifications: queue.pending,
        redemptions: redemptions.pagination.total,
        risk: risk.pagination.total,
      };
    },
    enabled: isStaff,
    refetchInterval: 90_000,
  });

  return {
    notifications: unread.data?.count ?? 0,
    verifications: staffCounts.data?.verifications ?? 0,
    redemptions: staffCounts.data?.redemptions ?? 0,
    risk: staffCounts.data?.risk ?? 0,
  };
}
