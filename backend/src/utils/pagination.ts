import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../shared/constants';
import type { Paginated, PaginationMeta } from '../../../shared/types';

export interface PageArgs { page?: number; pageSize?: number; }

export function toSkipTake(args: PageArgs) {
  const page = Math.max(1, Number(args.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(args.pageSize) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, pagination: buildMeta(total, page, pageSize) };
}
