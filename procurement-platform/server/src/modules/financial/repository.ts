/* Encapsulates financial persistence queries so service logic does not depend on raw Prisma access patterns. */
export class ModuleRepository {
  async health() {
    return { ready: true };
  }
}

