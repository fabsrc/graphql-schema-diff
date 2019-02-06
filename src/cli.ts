#!/usr/bin/env node

import meow from 'meow';
import chalk from 'chalk';
import { getDiff } from '.';

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

getDiff(cli.input[0], cli.input[1]).then(result => {
  if (result === undefined) {
    console.log(chalk.green('✔ No changes'));
    return;
  }

  const hasBreakingChanges = () => result.breakingChanges.length !== 0;
  const hasDangerousChanges = () => result.dangerousChanges.length !== 0;

  console.log(result.diff);

  if (hasDangerousChanges) {
    console.log(chalk.yellow.bold.underline('Dangerous changes:'));

    for (const change of result.dangerousChanges) {
      console.log(chalk.yellow('  ⚠ ' + change.description));
    }
  }

  if (hasDangerousChanges && hasBreakingChanges) {
    console.log(); // Add additional line break
  }

  if (hasBreakingChanges) {
    console.log(chalk.red.bold.underline('BREAKING CHANGES:'));

    for (const change of result.breakingChanges) {
      console.log(chalk.red('  ✖ ' + change.description));
    }
  }

  if (
    (hasDangerousChanges && cli.flags.failOnDangerousChanges) ||
    (hasBreakingChanges && !cli.flags.ignoreBreakingChanges)
  ) {
    process.exit(1);
    return;
  }
});
