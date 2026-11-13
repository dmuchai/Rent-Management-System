export const AUTHORITY_CONTEXT_INVALID_CODE = 'AUTHORITY_CONTEXT_INVALID' as const;

export type AuthorityContextInvalidPayload = {
  code: typeof AUTHORITY_CONTEXT_INVALID_CODE;
  error: string;
};

export function authorityContextInvalidPayload(): AuthorityContextInvalidPayload {
  return {
    code: AUTHORITY_CONTEXT_INVALID_CODE,
    error: 'The selected account context is no longer available',
  };
}

export function isAuthorityContextInvalidResponse(status: number, payload: unknown): boolean {
  if (status !== 401 || !payload || typeof payload !== 'object') return false;
  return (payload as { code?: unknown }).code === AUTHORITY_CONTEXT_INVALID_CODE;
}
