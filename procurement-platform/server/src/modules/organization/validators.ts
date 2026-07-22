/* Validates organization request payloads at the module boundary before service logic trusts client input. */
import { z } from 'zod';

export const moduleStatusQuerySchema = z.object({}).passthrough();

