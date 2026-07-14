import { pathToFileURL } from 'node:url';
import { prisma } from '../src/db/prisma.js';
import {
  DEMO_EVALUATION_AWARD_BUYER_EMAIL,
  DEMO_EVALUATION_AWARD_DATASET,
  DEMO_EVALUATION_AWARD_KEYPHRASE,
  DEMO_EVALUATION_AWARD_WINNER_EMAIL,
  DEMO_EVALUATION_AWARD_WINNER_NAME,
  seedHassanAwardDemo
} from './seed-demo-evaluation-award.js';

export { seedHassanAwardDemo };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedHassanAwardDemo()
    .then(() => {
      console.log(`Seeded ${DEMO_EVALUATION_AWARD_DATASET}. Buyer: ${DEMO_EVALUATION_AWARD_BUYER_EMAIL} / Demo123!. Winner: ${DEMO_EVALUATION_AWARD_WINNER_NAME} (${DEMO_EVALUATION_AWARD_WINNER_EMAIL}) / Demo123!. Signing keyphrase: ${DEMO_EVALUATION_AWARD_KEYPHRASE}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
