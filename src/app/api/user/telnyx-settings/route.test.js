import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/messagingProfileCache', () => ({ invalidateMessagingProfile: mocks.invalidate }))

import { PUT } from './route'

const request = (body) => ({ json: async () => body })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'tenant-a' } })
  mocks.findUnique.mockResolvedValue({ telnyxMessagingProfileId: 'profile-old' })
  mocks.update.mockImplementation(async ({ data }) => data)
})

describe('Telnyx sender phone settings', () => {

  it.each(['', '   ', null])('allows explicitly clearing optional phone with %j', async (input) => {
    const response = await PUT(request({ telnyxPhoneNumber: input }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ telnyxPhoneNumber: null }),
    }))
  })

  it('does not clear the phone when updating only non-phone settings', async () => {
    const response = await PUT(request({ telnyxApiKey: 'new-key' }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ telnyxApiKey: 'new-key', telnyxPhoneNumber: undefined }),
    }))
  })

  it.each(['442079460958', '+999123456789', '+44 20 7946 0958 x12', 'not a number', 0, false, {}, []])('rejects %j without updating or clearing settings', async (input) => {
    const response = await PUT(request({ telnyxApiKey: 'new-key', telnyxPhoneNumber: input }))

    expect(response.status).toBe(400)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
