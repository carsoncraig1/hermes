import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  default: { phoneNumber: { findUnique: mocks.findUnique, create: mocks.create } },
}))
vi.mock('@/lib/messagingProfileCache', () => ({ invalidateMessagingProfile: mocks.invalidate }))

import { POST } from './route'

const request = (phoneNumber) => ({ json: async () => ({ phoneNumber, type: 'local' }) })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'tenant-a' } })
  mocks.findUnique.mockResolvedValue(null)
  mocks.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
})

describe('sender creation normalization', () => {

  it('detects an already stored canonical international sender', async () => {
    mocks.findUnique.mockImplementation(async ({ where }) =>
      where.userId_phoneNumber.userId === 'tenant-a' &&
      where.userId_phoneNumber.phoneNumber === '+442079460958' ? { id: 2 } : null)

    const response = await POST(request('+44 20 7946 0958'))

    expect(response.status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it.each(['442079460958', '+44 20 7946 0958 ext 1', 'bad', '', null, 12125550123, {}, []])('rejects invalid %j before duplicate lookup', async (input) => {
    const response = await POST(request(input))

    expect(response.status).toBe(400)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
