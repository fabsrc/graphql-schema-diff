import {
  printSchema,
  findBreakingChanges,
  findDangerousChanges,
  GraphQLSchema,
  introspectionQuery,
  buildClientSchema,
  buildSchema,
  IntrospectionQuery,
  DangerousChange,
  BreakingChange
} from 'graphql';
import fs from 'fs';
import isGlob from 'is-glob';
import fetch from 'node-fetch';
import disparity from 'disparity';
import { fileLoader, mergeTypes } from 'merge-graphql-schemas';

interface Headers {
  [key: string]: string;
}

async function fetchRemoteSchema(
  endpoint: string,
  headers?: Headers
): Promise<GraphQLSchema> {
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

  const { data }: { data: IntrospectionQuery } = await res.json();
  return buildClientSchema(data);
}

function readLocalSchema(schemaPath: string): GraphQLSchema {
  if (isGlob(schemaPath)) {
    const typesArray = fileLoader(schemaPath);

    if (typesArray.length === 0) {
      throw new Error(`No types found with glob pattern '${schemaPath}'`);
    }

    const mergedSchema = mergeTypes(typesArray, { all: true });
    return buildSchema(mergedSchema);
  } else {
    const schemaString = fs.readFileSync(schemaPath, 'utf8');
    return buildSchema(schemaString);
  }
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
}

export async function getDiff(
  schema1Location: string,
  schema2Location: string,
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
      ...(options.leftSchema && options.leftSchema.headers)
    }
  };
  const [schema1, schema2] = await Promise.all([
    getSchema(schema1Location, leftSchemaOptions),
    getSchema(schema2Location, rightSchemaOptions)
  ]);

  if (!schema1 || !schema2) {
    throw new Error('Schemas not defined');
  }

  const [schema1SDL, schema2SDL] = [printSchema(schema1), printSchema(schema2)];

  if (schema1SDL === schema2SDL) {
    return;
  }

  const diff = disparity.unified(schema1SDL, schema2SDL, {
    paths: [schema1Location, schema2Location]
  });
  const diffNoColor = disparity.unifiedNoColor(schema1SDL, schema2SDL, {
    paths: [schema1Location, schema2Location]
  });
  const dangerousChanges = findDangerousChanges(schema1, schema2);
  const breakingChanges = findBreakingChanges(schema1, schema2);

  return {
    diff,
    diffNoColor,
    dangerousChanges,
    breakingChanges
  };
}
