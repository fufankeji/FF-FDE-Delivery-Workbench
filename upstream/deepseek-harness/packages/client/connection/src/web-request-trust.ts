/** Same-origin checks for custom routes on an explicitly LAN-enabled Web server. */
import { networkInterfaces } from 'node:os'
import type { IncomingMessage } from 'node:http'
import { isTrustedApiRequest } from './api-request-trust.ts'

/**
 * Capture the server's local IPv4 authorities for project HTTP routes.
 * Loopback remains accepted; LAN IPs require an all-interface bind and the exact listening port.
 * This is not authentication. Settings and credential routes retain their separate loopback checks.
 * @param server - actual listening address and port, not request-supplied forwarding headers.
 * @returns request predicate retaining Host, Origin and Fetch-Metadata checks.
 */
export function createWebRequestTrust(server: { readonly host: string; readonly port: number }): (request: Pick<IncomingMessage, 'headers'>) => boolean {
  const trusted = server.host === '0.0.0.0'
    ? Object.values(networkInterfaces()).flat()
      .filter((iface): iface is NonNullable<typeof iface> => iface !== undefined && iface.family === 'IPv4' && !iface.internal)
      .map(iface => `${iface.address}:${String(server.port)}`)
    : []
  return request => isTrustedApiRequest(request, trusted)
}
