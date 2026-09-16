/** Custom project routes share the LAN binding policy without loosening privileged RPCs. */
import { describe, expect, it, vi } from 'vitest'
import { createWebRequestTrust } from '../src/web-request-trust.ts'
import { isTrustedApiRequest } from '../src/api-request-trust.ts'

vi.mock('node:os', () => ({ networkInterfaces: () => ({
  lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  en0: [{ address: '192.168.1.5', family: 'IPv4', internal: false }],
  en1: [{ address: 'fe80::1', family: 'IPv6', internal: false }],
  absent: undefined,
}) }))

const request = (host: string, origin?: string, site?: string) => ({ headers: { host, origin, 'sec-fetch-site': site } })
describe('LAN project route access', () => {
  it('accepts only a local interface and the actual port after all-interface binding', () => {
    const trusted = createWebRequestTrust({ host: '0.0.0.0', port: 3080 })
    expect(trusted(request('192.168.1.5:3080', 'http://192.168.1.5:3080'))).toBe(true)
    expect(trusted(request('192.168.1.5:3080'))).toBe(true)
    expect(trusted(request('192.168.1.5:3081'))).toBe(false)
    expect(trusted(request('192.168.1.6:3080'))).toBe(false)
    expect(trusted(request('evil.example:3080', 'http://evil.example:3080'))).toBe(false)
    expect(trusted(request('192.168.1.5:3080', 'http://evil.example'))).toBe(false)
    expect(trusted(request('192.168.1.5:3080', 'http://192.168.1.5:3080', 'cross-site'))).toBe(false)
    expect(trusted(request('127.0.0.1:3080'))).toBe(true)
  })
  it('retains local-only defaults and the separate privileged-RPC loopback restriction', () => {
    const trusted = createWebRequestTrust({ host: '127.0.0.1', port: 3080 })
    expect(trusted(request('192.168.1.5:3080'))).toBe(false)
    expect(trusted(request('127.0.0.1:3080'))).toBe(true)
    expect(isTrustedApiRequest(request('192.168.1.5:3080'), [])).toBe(false)
  })
})
