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

async function fetchRemoteSchema(endpoint: string): Promise<GraphQLSchema> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ query: introspectionQuery })
  })
    .then(res => {
      if (res.ok) {
        return res;
      }

      throw new Error(`${res.status} - ${res.statusText} (${endpoint})`);
    })
    .then(res => res.json())
    .then(({ data }: { data: IntrospectionQuery }) => buildClientSchema(data));
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

async function getSchema(schemaLocation: string): Promise<GraphQLSchema> {
  if (schemaLocation.match(/^https?/)) {
    return fetchRemoteSchema(schemaLocation);
  } else {
    return readLocalSchema(schemaLocation);
  }
}

interface DiffResponse {
  diff: string;
  diffNoColor: string;
  dangerousChanges: DangerousChange[];
  breakingChanges: BreakingChange[];
}

export async function getDiff(
  schema1Location: string,
  schema2Location: string
): Promise<DiffResponse | undefined> {
  const [schema1, schema2] = await Promise.all([
    getSchema(schema1Location),
    getSchema(schema2Location)
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
