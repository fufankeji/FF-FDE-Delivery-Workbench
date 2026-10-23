/** Custom routes require the live Connection's authenticated owner identity. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { createWebRequestTrust } from '../src/web-request-trust.ts'
import { Peer } from '../src/peer.ts'
import type { PeerAdmission } from '../src/rpc.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface PrincipalMap {
    /** Test-only non-owner caller shared by the access specs. */
    'test-guest': { readonly kind: 'test-guest'; readonly guest: string }
  }
}

describe('custom owner route authorization', () => {
  it.each([401, 403] as const)('rejects Connection admission status %s without a fallback', (rejection) => {
    const request = { headers: { host: '192.168.1.5:3080' } }
    const admit = vi.fn((): PeerAdmission => ({ rejection }))
    expect(createWebRequestTrust({ admit })(request)).toBe(false)
    expect(admit).toHaveBeenCalledExactlyOnceWith(request)
  })

  it('accepts an authenticated owner and rejects another admitted identity', async () => {
    const ctx = new Context()
    const owner = new Peer(ctx, { principal: { kind: 'owner' } })
    const guest = new Peer(ctx, { principal: { kind: 'test-guest', guest: 'limited' } })
    try {
      const request = { headers: { host: '127.0.0.1:3080' } }
      expect(createWebRequestTrust({ admit: () => ({ peer: owner }) })(request)).toBe(true)
      expect(createWebRequestTrust({ admit: () => ({ peer: guest }) })(request)).toBe(false)
    } finally {
      await Promise.all([owner.dispose(), guest.dispose()])
      await ctx.fiber.dispose()
    }
  })
})
