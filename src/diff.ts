import {
  printSchema,
  findBreakingChanges,
  findDangerousChanges,
  GraphQLSchema,
  introspectionQuery,
  buildClientSchema,
  buildSchema,
  DangerousChange,
  BreakingChange
} from 'graphql';
import fs from 'fs';
import isGlob from 'is-glob';
import fetch from 'node-fetch';
import disparity from 'disparity';
import { fileLoader, mergeTypes } from 'merge-graphql-schemas';

export interface Headers {
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

  const responseBody = await res.json();
  
  if (!responseBody || !responseBody.data || !responseBody.data.__schema) {
    throw new Error(`Invalid response from GraphQL endpoint: ${endpoint}`);
  }

  return buildClientSchema(responseBody.data);
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
  const [leftSchema, rightSchema] = await Promise.all([
    getSchema(leftSchemaLocation, leftSchemaOptions),
    getSchema(rightSchemaLocation, rightSchemaOptions)
  ]);

  if (!leftSchema || !rightSchema) {
    throw new Error('Schemas not defined');
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
