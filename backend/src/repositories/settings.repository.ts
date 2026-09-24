import { prisma, type Tx } from '../config/prisma';

export const settingsRepository = {
  all() { return prisma.appSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] }); },

  byGroup(group: string) { return prisma.appSetting.findMany({ where: { group }, orderBy: { key: 'asc' } }); },

  get(key: string, db: Tx | typeof prisma = prisma) { return db.appSetting.findUnique({ where: { key } }); },

  upsert(key: string, value: string, meta: { label: string; group: string; valueType: string; updatedById?: string }, db: Tx | typeof prisma = prisma) {
    return db.appSetting.upsert({
      where: { key },
      create: { key, value, label: meta.label, group: meta.group, valueType: meta.valueType, updatedById: meta.updatedById },
      update: { value, updatedById: meta.updatedById },
    });
  },

  flags() { return prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }); },

  setFlag(key: string, enabled: boolean) {
    return prisma.featureFlag.upsert({ where: { key }, create: { key, enabled }, update: { enabled } });
  },
};
