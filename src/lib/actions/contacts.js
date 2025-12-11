'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function getContacts() {
  try {
    const userId = await getUserId()
    console.log('Starting getContacts...');
    
    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        tags: true
      }
    });
    
    console.log(`Fetched ${contacts.length} contacts`);
    return contacts;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
}

export async function addContact(data) {
  try {
    const userId = await getUserId()
    
    // Handle tags - either connect existing ones or create new ones (for this user)
    const tagConnections = await Promise.all(
      (data.tags || []).map(async (tagName) => {
        const tag = await prisma.tag.upsert({
          where: { 
            name_userId: { name: tagName, userId }
          },
          update: {},
          create: { name: tagName, userId }
        });
        return { id: tag.id };
      })
    );

    // Handle clickid - support both array and single value
    let clickidArray = []
    if (data.clickid) {
      clickidArray = Array.isArray(data.clickid) ? data.clickid : [data.clickid]
    } else if (data.clickId) {
      clickidArray = Array.isArray(data.clickId) ? data.clickId : [data.clickId]
    }

    const contact = await prisma.contact.create({
      data: {
        userId,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone,
        clickid: clickidArray,
        source: data.source || null,
        age: data.age || null,
        ip: data.ip || null,
        useragent: data.useragent || null,
        referrer: data.referrer || null,
        subscribed: data.subscribed !== undefined ? data.subscribed : true,
        tags: {
          connect: tagConnections
        }
      },
      include: {
        tags: true
      }
    });
    return contact;
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
}

export async function updateContact(data) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: { id: data.id, userId }
    })
    if (!existing) {
      throw new Error('Contact not found')
    }
    
    // Handle tags update
    const tagConnections = await Promise.all(
      (data.tags || []).map(async (tagName) => {
        const tag = await prisma.tag.upsert({
          where: { 
            name_userId: { name: tagName, userId }
          },
          update: {},
          create: { name: tagName, userId }
        });
        return { id: tag.id };
      })
    );

    // Handle clickid - support both array and single value
    let clickidArray = []
    if (data.clickid !== undefined) {
      clickidArray = Array.isArray(data.clickid) ? data.clickid : (data.clickid ? [data.clickid] : [])
    } else if (data.clickId !== undefined) {
      clickidArray = Array.isArray(data.clickId) ? data.clickId : (data.clickId ? [data.clickId] : [])
    }

    // If unsubscribing, set unsubscribe reason to "manual"
    const updateData = {
      firstName: data.firstName !== undefined ? (data.firstName || null) : undefined,
      lastName: data.lastName !== undefined ? (data.lastName || null) : undefined,
      email: data.email !== undefined ? (data.email || null) : undefined,
      phone: data.phone,
      clickid: clickidArray.length > 0 ? clickidArray : undefined,
      source: data.source !== undefined ? (data.source || null) : undefined,
      age: data.age !== undefined ? (data.age || null) : undefined,
      ip: data.ip !== undefined ? (data.ip || null) : undefined,
      useragent: data.useragent !== undefined ? (data.useragent || null) : undefined,
      referrer: data.referrer !== undefined ? (data.referrer || null) : undefined,
      subscribed: data.subscribed,
      tags: {
        set: [], // Clear existing tags
        connect: tagConnections // Connect new tags
      }
    };

    // If unsubscribing, set unsubscribe reason to "manual"
    if (data.subscribed === false && existing.subscribed === true) {
      updateData.unsubscribeReason = 'manual';
    } else if (data.subscribed === true && existing.subscribed === false) {
      // If resubscribing, clear unsubscribe reason
      updateData.unsubscribeReason = null;
    }

    const contact = await prisma.contact.update({
      where: { id: data.id },
      data: updateData,
      include: {
        tags: true
      }
    });
    return contact;
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
}

export async function deleteContact(id) {
  try {
    const userId = await getUserId()
    
    // Verify ownership before deleting
    const existing = await prisma.contact.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Contact not found')
    }
    
    await prisma.contact.delete({
      where: { id }
    })
    return { success: true }
  } catch (error) {
    console.error('Error deleting contact:', error)
    throw new Error('Failed to delete contact')
  }
}

export async function getSubscribedContactsCount() {
  try {
    const userId = await getUserId()
    
    const count = await prisma.contact.count({
      where: {
        userId,
        subscribed: true
      }
    });
    return count;
  } catch (error) {
    console.error('Error getting subscribed contacts count:', error);
    throw new Error('Failed to get subscribed contacts count');
  }
}
