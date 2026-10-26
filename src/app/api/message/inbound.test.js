import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sender: vi.fn(),
  user: vi.fn(),
  contacts: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    phoneNumber: { findFirst: mocks.sender },
    user: { findFirst: mocks.user },
    contact: { updateMany: mocks.contacts },
  },
}))

import { POST as inbound } from './inbound'
import { POST as failsafe } from './inbound-failsafe'

const request = (from = '+44 (20) 7946-0958', to = '+61 2 9374 4000') => ({
  json: async () => ({
    data: {
      event_type: 'message.received',
      payload: {
        direction: 'inbound',
        from: { phone_number: from },
        to: [{ phone_number: to }],
        text: 'STOP',
      },
    },
  }),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.sender.mockResolvedValue(null)
  mocks.user.mockResolvedValue({ id: 'tenant-a' })
  mocks.contacts.mockResolvedValue({ count: 1 })
})

describe.each([['inbound', inbound], ['failsafe', failsafe]])('%s international STOP matching', (_name, post) => {
  it('normalizes international contacts and scopes updates to the receiving tenant', async () => {
    const response = await post(request())

    expect(response.status).toBe(200)
    expect(mocks.user).toHaveBeenCalledWith({
      where: { telnyxPhoneNumber: '+61293744000' },
      select: { id: true },
    })
    expect(mocks.contacts).toHaveBeenCalledWith({
      where: { userId: 'tenant-a', phone: '+442079460958' },
      data: { subscribed: false, unsubscribeReason: 'STOP' },
    })
    expect(await response.json()).toMatchObject({ contactsUpdated: 1 })
  })

  it('does not unsubscribe any tenant when the receiving number is unknown', async () => {
    mocks.user.mockResolvedValue(null)

    const response = await post(request())

    expect(response.status).toBe(200)
    expect(mocks.contacts).not.toHaveBeenCalled()
  })

  it.each(['442079460958', '+44 20 7946 0958 ext 1', { phone: '+442079460958' }])('does not look up tenants for invalid input %j', async (from) => {
    const response = await post(request(from))

    expect(response.status).toBe(200)
    expect(mocks.sender).not.toHaveBeenCalled()
    expect(mocks.user).not.toHaveBeenCalled()
    expect(mocks.contacts).not.toHaveBeenCalled()
  })
})

it('resolves international revolver senders before legacy settings without changing tenant scope', async () => {
  mocks.sender.mockResolvedValue({ userId: 'revolver-tenant' })

  await inbound(request())

  expect(mocks.sender).toHaveBeenCalledWith({
    where: { phoneNumber: '+61293744000', enabled: true },
    select: { userId: true },
  })
  expect(mocks.user).not.toHaveBeenCalled()
  expect(mocks.contacts).toHaveBeenCalledWith({
    where: { userId: 'revolver-tenant', phone: '+442079460958' },
    data: { subscribed: false, unsubscribeReason: 'STOP' },
  })
})
