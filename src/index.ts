import fs from 'fs';
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
import fetch from 'node-fetch';
import disparity from 'disparity';
import { fileLoader, mergeTypes } from 'merge-graphql-schemas';
import isGlob from 'is-glob';

interface DiffResponse {
  diff: string;
  dangerousChanges: DangerousChange[];
  breakingChanges: BreakingChange[];
}

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

      throw new Error(res.statusText);
    })
    .then(res => res.json())
    .then(({ data }: { data: IntrospectionQuery }) => buildClientSchema(data));
}

async function readLocalSchema(schemaPath: string): Promise<GraphQLSchema> {
  if (isGlob(schemaPath)) {
    const typesArray = fileLoader(schemaPath);
    const mergedSchema = mergeTypes(typesArray, { all: true });
    return Promise.resolve(buildSchema(mergedSchema));
  } else {
    const schemaString = fs.readFileSync(schemaPath, 'utf8');
    return Promise.resolve(buildSchema(schemaString));
  }
}

async function getSchema(schemaLocation: string): Promise<GraphQLSchema> {
  if (schemaLocation.match(/^https?/)) {
    return fetchRemoteSchema(schemaLocation);
  } else {
    return readLocalSchema(schemaLocation);
  }
}

export async function getDiff(
  schema1Location: string,
  schema2Location: string
): Promise<DiffResponse | undefined> {
  const [schema1, schema2] = await Promise.all(
    [schema1Location, schema2Location].map(schemaLocation =>
      getSchema(schemaLocation)
    )
  );

  if (!schema1 || !schema2) {
    throw new Error('Schemas not defined');
  }

  const [schema1SDL, schema2SDL] = [schema1, schema2].map(
    schema => printSchema(schema) || ''
  );

  if (schema1SDL === schema2SDL) {
    return;
  }

  const diff = disparity.unified(schema1SDL, schema2SDL, {
    paths: [schema1Location, schema2Location]
  });
  const dangerousChanges = findDangerousChanges(schema1, schema2);
  const breakingChanges = findBreakingChanges(schema1, schema2);

  return {
    diff,
    dangerousChanges,
    breakingChanges
  };
}
