'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { normalizePhoneNumber } from '@/lib/phoneUtils'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function getNumbers() {
  try {
    const userId = await getUserId()
    console.log('Starting getNumbers...');

    const numbers = await prisma.number.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        contacts: true,
        campaigns: true
      }
    });
    
    console.log(`Fetched ${numbers.length} numbers`);
    return numbers;
  } catch (error) {
    console.error('Error fetching numbers:', error);
    throw error;
  }
}

export async function addNumber(data) {
  try {
    const userId = await getUserId()
    const phoneNumber = normalizePhoneNumber(data.phoneNumber)
    if (!phoneNumber) {
      throw new Error('Invalid phone number')
    }
    
    const number = await prisma.number.create({
      data: {
        userId,
        phoneNumber,
        status: data.status || 'ACTIVE',
      },
      include: {
        contacts: true,
        campaigns: true
      }
    });
    return number;
  } catch (error) {
    console.error('Error creating number:', error);
    throw error;
  }
}

export async function updateNumber(data) {
  try {
    const userId = await getUserId()
    const phoneNumber = data.phoneNumber === undefined ? undefined : normalizePhoneNumber(data.phoneNumber)
    if (data.phoneNumber !== undefined && !phoneNumber) {
      throw new Error('Invalid phone number')
    }
    
    // Verify ownership
    const existing = await prisma.number.findFirst({
      where: { id: data.id, userId }
    })
    if (!existing) {
      throw new Error('Number not found')
    }
    
    const number = await prisma.number.update({
      where: { id: data.id },
      data: {
        phoneNumber,
        status: data.status,
      },
      include: {
        contacts: true,
        campaigns: true
      }
    });
    return number;
  } catch (error) {
    console.error('Error updating number:', error);
    throw error;
  }
}

export async function deleteNumber(id) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.number.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Number not found')
    }
    
    await prisma.number.delete({
      where: { id }
    })
    return { success: true }
  } catch (error) {
    console.error('Error deleting number:', error)
    throw new Error('Failed to delete number')
  }
}

export async function getActiveNumbersCount() {
  try {
    const userId = await getUserId()
    
    const count = await prisma.number.count({
      where: {
        userId,
        status: 'ACTIVE'
      }
    });
    return count;
  } catch (error) {
    console.error('Error getting active numbers count:', error);
    throw new Error('Failed to get active numbers count');
  }
}
