const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function generateApiKeys() {
  try {
    const users = await prisma.user.findMany({
      where: {
        apiKey: null
      }
    });

    console.log(`Found ${users.length} users without API keys`);

    for (const user of users) {
      const apiKey = `hermes_${crypto.randomBytes(32).toString('hex')}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { apiKey }
      });
      console.log(`Generated API key for user ${user.email}: ${apiKey}`);
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateApiKeys();

