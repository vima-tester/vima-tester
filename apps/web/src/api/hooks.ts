import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentSummary, RunRequest, RunResponse } from '@vima/protocol';
import { ApiRequestError, createPairingCode, listAgents, revokeAgent, runRequest } from './client';

/** Query key root for everything agent-related. */
export const agentsQueryKey = ['agents'] as const;

/** Never retry an auth failure: the relay answered, and retrying cannot help. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  return failureCount < 2;
}

/** Poll the paired-agent list so the connected indicator stays honest. */
export function useAgents(enabled = true) {
  return useQuery<AgentSummary[], ApiRequestError>({
    queryKey: agentsQueryKey,
    queryFn: listAgents,
    enabled,
    refetchInterval: 5000,
    staleTime: 2000,
    retry: shouldRetry,
  });
}

export function useCreatePairingCode() {
  return useMutation({
    mutationFn: createPairingCode,
    retry: false,
  });
}

export function useRevokeAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => revokeAgent(agentId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentsQueryKey });
    },
  });
}

/** The one mutation that talks to the user's local agent through the relay. */
export function useRunRequest() {
  return useMutation<RunResponse, ApiRequestError, RunRequest>({
    mutationFn: runRequest,
    retry: false,
  });
}
