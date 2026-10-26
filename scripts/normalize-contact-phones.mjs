import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { normalizePhoneNumber } from '../src/lib/phoneUtils.js';

const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--enforce', '--help'].includes(arg)) ||
    (args.includes('--enforce') && !args.includes('--apply'))) {
  throw new Error('Usage: node --env-file=.env scripts/normalize-contact-phones.mjs [--apply [--enforce]]');
}
if (args.includes('--help')) {
  console.log('Audits contact phone formats by default. --apply canonicalizes possible numbers without merging or deleting contacts. --apply --enforce also installs database format guards before the pass. Invalid historical numbers remain unchanged and are counted for review.');
} else {
  const apply = args.includes('--apply');
  const enforce = args.includes('--enforce');
  const prisma = new PrismaClient();
  try {
    if (enforce) {
      const migration = await readFile(new URL('../prisma/migrations/enforce_canonical_phone_format.sql', import.meta.url), 'utf8');
      await prisma.$executeRawUnsafe(migration);
    }
    const summary = {
      mode: apply ? 'apply' : 'audit', databaseGuardsInstalled: enforce, scanned: 0, alreadyCanonical: 0,
      normalizable: 0, invalid: 0, canonicalCollisionGroups: 0,
      updated: 0, concurrentlyChanged: 0,
    };
    const groups = new Map();
    const changes = [];
    let cursor;
    while (true) {
      const contacts = await prisma.contact.findMany({
        select: { id: true, userId: true, phone: true },
        orderBy: { id: 'asc' },
        take: 5000,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      if (contacts.length === 0) break;
      for (const contact of contacts) {
        summary.scanned++;
        const canonical = normalizePhoneNumber(contact.phone);
        if (!canonical) {
          summary.invalid++;
          continue;
        }
        const key = `${contact.userId}:${canonical}`;
        const count = (groups.get(key) || 0) + 1;
        groups.set(key, count);
        if (count === 2) summary.canonicalCollisionGroups++;
        if (contact.phone === canonical) {
          summary.alreadyCanonical++;
        } else {
          summary.normalizable++;
          changes.push({ ...contact, canonical });
        }
      }
      cursor = contacts[contacts.length - 1].id;
    }

    if (apply) {
      for (let i = 0; i < changes.length; i += 100) {
        const results = await prisma.$transaction(changes.slice(i, i + 100).map(contact =>
          prisma.contact.updateMany({
            where: { id: contact.id, userId: contact.userId, phone: contact.phone },
            data: { phone: contact.canonical },
          })
        ));
        for (const result of results) {
          summary.updated += result.count;
          if (result.count === 0) summary.concurrentlyChanged++;
        }
      }
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
