/** Connection-owned authorization for custom owner-only HTTP routes. */
import type { ConnectionTrustRequest, HostConnectionHandle } from './rpc.ts'

/**
 * Reuse the live Connection's authority fence, credentials, and Peer identity.
 * @param connection - the owning Host Connection, never request-supplied identity.
 * @returns a predicate accepting authenticated owner requests only.
 */
export function createWebRequestTrust(connection: Pick<HostConnectionHandle, 'admit'>): (request: ConnectionTrustRequest) => boolean {
  return (request) => {
    const admission = connection.admit(request)
    return !('rejection' in admission) && admission.peer.principal.kind === 'owner'
  }
}
