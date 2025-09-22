'use server'

import prisma from '@/lib/prisma'

export async function getNumbers() {
  try {
    console.log('Starting getNumbers...');

    const numbers = await prisma.number.findMany({
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
    const number = await prisma.number.create({
      data: {
        phoneNumber: data.phoneNumber,
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
    const number = await prisma.number.update({
      where: { id: data.id },
      data: {
        phoneNumber: data.phoneNumber,
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
    const count = await prisma.number.count({
      where: {
        status: 'ACTIVE'
      }
    });
    return count;
  } catch (error) {
    console.error('Error getting active numbers count:', error);
    throw new Error('Failed to get active numbers count');
  }
} 