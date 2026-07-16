import { Client } from '@elastic/elasticsearch';
import type { PageDto, SearchQuery, SearchResultDto } from './types.js';

const indexName = process.env.COMPLIANCE_SEARCH_INDEX || 'procurex-compliance-admin';

export type SearchIndexDocument = SearchResultDto & {
  searchText: string;
};

function elasticUrl() {
  return process.env.ELASTICSEARCH_URL || process.env.ELASTICSEARCH_NODE || '';
}

function client() {
  const node = elasticUrl();
  if (!node) return null;
  return new Client({
    node,
    auth:
      process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
        ? {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD
          }
        : undefined
  });
}

export function elasticsearchConfigured() {
  return Boolean(elasticUrl());
}

export async function searchComplianceIndex(query: SearchQuery): Promise<PageDto<SearchResultDto> | null> {
  const es = client();
  if (!es) return null;
  const from = (query.page - 1) * query.pageSize;
  const filters = [
    query.type ? { term: { type: query.type } } : null,
    query.status ? { term: { status: query.status } } : null,
    query.stage ? { term: { stage: query.stage } } : null,
    query.from || query.to
      ? {
          range: {
            createdAt: {
              ...(query.from ? { gte: query.from.toISOString() } : {}),
              ...(query.to ? { lte: query.to.toISOString() } : {})
            }
          }
        }
      : null
  ].filter(Boolean);
  const response = await es.search<SearchIndexDocument>({
    index: indexName,
    from,
    size: query.pageSize,
    query: {
      bool: {
        must: query.q
          ? [
              {
                multi_match: {
                  query: query.q,
                  fields: ['title^3', 'subtitle^2', 'summary', 'party', 'searchText']
                }
              }
            ]
          : [{ match_all: {} }],
        filter: filters as object[]
      }
    }
  });
  return {
    items: response.hits.hits.map((hit) => safeSearchResult(hit._source)),
    page: query.page,
    pageSize: query.pageSize,
    total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value ?? 0
  };
}

export async function rebuildComplianceIndex(documents: SearchIndexDocument[]) {
  const es = client();
  if (!es) return { backend: 'database' as const, indexed: 0, skipped: true };
  await es.indices.create(
    {
      index: indexName,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          type: { type: 'keyword' },
          status: { type: 'keyword' },
          stage: { type: 'keyword' },
          title: { type: 'text' },
          subtitle: { type: 'text' },
          summary: { type: 'text' },
          party: { type: 'text' },
          searchText: { type: 'text' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' }
        }
      }
    },
    { ignore: [400] }
  );
  if (documents.length === 0) return { backend: 'elasticsearch' as const, indexed: 0, skipped: false };
  const operations = documents.flatMap((document) => [{ index: { _index: indexName, _id: `${document.type}:${document.id}` } }, document]);
  const result = await es.bulk({ refresh: true, operations });
  if (result.errors) {
    const failed = result.items.filter((item) => item.index?.error).length;
    return { backend: 'elasticsearch' as const, indexed: documents.length - failed, failed, skipped: false };
  }
  return { backend: 'elasticsearch' as const, indexed: documents.length, skipped: false };
}

function safeSearchResult(source: SearchIndexDocument | undefined): SearchResultDto {
  return {
    id: String(source?.id ?? ''),
    type: String(source?.type ?? 'record'),
    title: String(source?.title ?? ''),
    subtitle: String(source?.subtitle ?? ''),
    status: source?.status,
    stage: source?.stage,
    party: source?.party,
    amount: source?.amount,
    summary: source?.summary,
    routeHint: source?.routeHint,
    createdAt: source?.createdAt,
    updatedAt: source?.updatedAt
  };
}
