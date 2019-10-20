import {
  printSchema,
  findBreakingChanges,
  findDangerousChanges,
  GraphQLSchema,
  buildClientSchema,
  DangerousChange,
  BreakingChange,
  introspectionFromSchema,
  getIntrospectionQuery
} from 'graphql';
import { lexicographicSortSchema } from 'graphql/utilities';
import fetch from 'node-fetch';
import disparity from 'disparity';
import { loadSchema } from 'graphql-toolkit';

export interface Headers {
  [key: string]: string;
}

async function fetchRemoteSchema(
  endpoint: string,
  headers?: Headers
): Promise<GraphQLSchema> {
  const introspectionQuery = getIntrospectionQuery({ descriptions: false });
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify({ query: introspectionQuery })
  });

  if (!res.ok) {
    throw new Error(`${res.status} - ${res.statusText} (${endpoint})`);
  }

  const responseBody = await res.json();

  if (!responseBody || !responseBody.data || !responseBody.data.__schema) {
    throw new Error(`Invalid response from GraphQL endpoint: ${endpoint}`);
  }

  return buildClientSchema(responseBody.data);
}

async function readLocalSchema(schemaPath: string): Promise<GraphQLSchema> {
  const schema = await loadSchema(schemaPath);
  const introspection = introspectionFromSchema(schema, {
    descriptions: false
  });
  return buildClientSchema(introspection);
}

async function getSchema(
  schemaLocation: string,
  options: { headers?: Headers } = {}
): Promise<GraphQLSchema> {
  if (schemaLocation.match(/^https?/)) {
    return fetchRemoteSchema(schemaLocation, options.headers);
  } else {
    return readLocalSchema(schemaLocation);
  }
}

export interface DiffResponse {
  diff: string;
  diffNoColor: string;
  dangerousChanges: DangerousChange[];
  breakingChanges: BreakingChange[];
}

export interface DiffOptions {
  leftSchema?: {
    headers?: Headers;
  };
  rightSchema?: {
    headers?: Headers;
  };
  headers?: Headers;
  sortSchema?: boolean;
}

export async function getDiff(
  leftSchemaLocation: string,
  rightSchemaLocation: string,
  options: DiffOptions = {}
): Promise<DiffResponse | undefined> {
  const leftSchemaOptions = {
    headers: {
      ...options.headers,
      ...(options.leftSchema && options.leftSchema.headers)
    }
  };
  const rightSchemaOptions = {
    headers: {
      ...options.headers,
      ...(options.rightSchema && options.rightSchema.headers)
    }
  };
  let [leftSchema, rightSchema] = await Promise.all([
    getSchema(leftSchemaLocation, leftSchemaOptions),
    getSchema(rightSchemaLocation, rightSchemaOptions)
  ]);

  if (!leftSchema || !rightSchema) {
    throw new Error('Schemas not defined');
  }

  if (options.sortSchema) {
    [leftSchema, rightSchema] = [
      lexicographicSortSchema(leftSchema),
      lexicographicSortSchema(rightSchema)
    ];
  }

  const [leftSchemaSDL, rightSchemaSDL] = [
    printSchema(leftSchema),
    printSchema(rightSchema)
  ];

  if (leftSchemaSDL === rightSchemaSDL) {
    return;
  }

  const diff = disparity.unified(leftSchemaSDL, rightSchemaSDL, {
    paths: [leftSchemaLocation, rightSchemaLocation]
  });
  const diffNoColor = disparity.unifiedNoColor(leftSchemaSDL, rightSchemaSDL, {
    paths: [leftSchemaLocation, rightSchemaLocation]
  });
  const dangerousChanges = findDangerousChanges(leftSchema, rightSchema);
  const breakingChanges = findBreakingChanges(leftSchema, rightSchema);

  return {
    diff,
    diffNoColor,
    dangerousChanges,
    breakingChanges
  };
}
