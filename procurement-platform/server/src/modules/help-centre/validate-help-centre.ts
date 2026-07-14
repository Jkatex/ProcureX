import { allHelpFaqs, helpCategories } from './data/catalog.js';
import { assertValidHelpFaqs } from './validation.js';

assertValidHelpFaqs(allHelpFaqs);
console.log(`Help Centre FAQ data valid: ${allHelpFaqs.length} FAQs across ${helpCategories.length} categories.`);

