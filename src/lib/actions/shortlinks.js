'use server'

import prisma from '@/lib/prisma'

export async function getShortlinks() {
  try {
    const shortlinks = await prisma.shortlink.findMany({
      include: {
        campaign: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    return shortlinks
  } catch (error) {
    console.error('Error fetching shortlinks:', error)
    throw new Error('Failed to fetch shortlinks')
  }
}

export async function addShortlink(data) {
  try {
    const shortlink = await prisma.shortlink.create({
      data: {
        slug: data.slug,
        destination: data.destination
      }
    })
    return shortlink
  } catch (error) {
    console.error('Error adding shortlink:', error)
    throw new Error('Failed to add shortlink')
  }
}

export async function updateShortlink(data) {
  try {
    const shortlink = await prisma.shortlink.update({
      where: { id: data.id },
      data: {
        slug: data.slug,
        destination: data.destination
      }
    })
    return shortlink
  } catch (error) {
    console.error('Error updating shortlink:', error)
    throw new Error('Failed to update shortlink')
  }
}

export async function deleteShortlink(id) {
  try {
    await prisma.shortlink.delete({
      where: { id }
    })
    return true
  } catch (error) {
    console.error('Error deleting shortlink:', error)
    throw new Error('Failed to delete shortlink')
  }
} 