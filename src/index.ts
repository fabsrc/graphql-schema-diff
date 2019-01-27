#!/usr/bin/env node

import fs from 'fs';
import chalk from 'chalk';
import {
  printSchema,
  findBreakingChanges,
  findDangerousChanges,
  GraphQLSchema,
  introspectionQuery,
  buildClientSchema,
  buildSchema,
  IntrospectionQuery
} from 'graphql';
import fetch from 'node-fetch';
import disparity from 'disparity';
import path from 'path';
import { fileLoader, mergeTypes } from 'merge-graphql-schemas';
import isGlob from 'is-glob';

function getRemoteSchema(endpoint: string): Promise<GraphQLSchema> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ query: introspectionQuery })
  })
    .then(res => res.json())
    .then(({ data }: { data: IntrospectionQuery }) => buildClientSchema(data));
}

function getLocalSchema(schemaPath: string): Promise<GraphQLSchema> {
  if (isGlob(schemaPath)) {
    const typesArray = fileLoader(path.join(__dirname, schemaPath));
    const mergedSchema = mergeTypes(typesArray, { all: true });
    return Promise.resolve(buildSchema(mergedSchema));
  } else {
    const schemaString = fs.readFileSync(schemaPath, 'utf8');
    return Promise.resolve(buildSchema(schemaString));
  }
}

function getSchema(schemaLocation: string): Promise<GraphQLSchema> {
  if (schemaLocation.match(/^https?/)) {
    return getRemoteSchema(schemaLocation);
  } else {
    return getLocalSchema(schemaLocation);
  }
}

const [, , schema1Location, schema2Location] = process.argv;
const schemaInputs = [schema1Location, schema2Location].map(getSchema);

Promise.all(schemaInputs).then(([schema1, schema2]) => {
  const schema1SDL = printSchema(schema1);
  const schema2SDL = printSchema(schema2);
  if (schema1SDL === schema2SDL) {
    console.log(chalk.green('✔ No changes'));
    return;
  }

  const diff = disparity.unified(schema1SDL, schema2SDL, {
    paths: [schema1Location, schema2Location]
  });
  console.log(diff);

  const dangerousChanges = findDangerousChanges(schema1, schema2);
  if (dangerousChanges.length !== 0) {
    console.log(chalk.yellow.bold.underline('Dangerous changes:'));
    for (const change of dangerousChanges) {
      console.log(chalk.yellow('  ⚠ ' + change.description));
    }
  }

  const breakingChanges = findBreakingChanges(schema1, schema2);
  if (breakingChanges.length !== 0) {
    console.log(chalk.red.bold.underline('BREAKING CHANGES:'));
    for (const change of breakingChanges) {
      console.log(chalk.red('  ✖ ' + change.description));
    }
    process.exit(1);
  }
});
