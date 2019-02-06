#!/usr/bin/env node

import meow from 'meow';
import chalk from 'chalk';
import { GraphQLSchemaDiff } from '.';

const cli = meow(
  `
	Usage
	  $ graphql-schema-diff <schema1> <schema2>

  Options
    --fail-on-dangerous-changes  Exit with error on dangerous changes
    --ignore-breaking-changes  Do not exit with error on breaking changes

	Examples
	  $ graphql-schema-diff https://example.com/graphql schema.graphql
`,
  {
    flags: {
      'fail-on-dangerous-changes': {
        type: 'boolean'
      },
      'ignore-breaking-changes': {
        type: 'boolean'
      }
    }
  }
);

if (!cli.input[0] || !cli.input[1]) {
  throw new Error('Schema locations missing!');
}

const graphQLSchemaDiff = new GraphQLSchemaDiff(cli.input[0], cli.input[1]);
graphQLSchemaDiff.getDiff().then(result => {
  if (result === undefined) {
    console.log(chalk.green('✔ No changes'));
    return;
  }

  console.log(result.diff);

  if (result.dangerousChanges.length !== 0) {
    console.log(chalk.yellow.bold.underline('Dangerous changes:'));

    for (const change of result.dangerousChanges) {
      console.log(chalk.yellow('  ⚠ ' + change.description));
    }
  }

  if (
    result.dangerousChanges.length !== 0 &&
    result.breakingChanges.length !== 0
  ) {
    console.log(); // Add additional line break
  }

  if (result.breakingChanges.length !== 0) {
    console.log(chalk.red.bold.underline('BREAKING CHANGES:'));

    for (const change of result.breakingChanges) {
      console.log(chalk.red('  ✖ ' + change.description));
    }
  }

  if (
    (result.dangerousChanges.length !== 0 &&
      cli.flags.failOnDangerousChanges) ||
    (result.breakingChanges.length !== 0 && !cli.flags.ignoreBreakingChanges)
  ) {
    process.exit(1);
    return;
  }
});
