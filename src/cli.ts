#!/usr/bin/env node

import meow from 'meow';
import chalk from 'chalk';
import { createHtmlOutput } from './html';
import { getDiff } from '.';

const cli = meow(
  `
  Usage
    $ graphql-schema-diff <schema1Location> <schema2Location>

  Options
    --fail-on-dangerous-changes  Exit with error on dangerous changes
    --ignore-breaking-changes  Do not exit with error on breaking changes
    --create-html-output  Creates an HTML file containing the diff
    --html-output-directory  Directory where the HTML file should be stored (Default: './schemaDiff')

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
      },
      'create-html-output': {
        type: 'boolean'
      },
      'html-output-directory': {
        type: 'string',
        default: 'schemaDiff'
      }
    }
  }
);

const [schema1Location, schema2Location] = cli.input;

if (!schema1Location || !schema2Location) {
  throw new Error('Schema locations missing!');
}

getDiff(schema1Location, schema2Location)
  .then(async (result) => {
    if (result === undefined) {
      console.log(chalk.green('✔ No changes'));
      return;
    }

    const hasBreakingChanges = result.breakingChanges.length !== 0;
    const hasDangerousChanges = result.dangerousChanges.length !== 0;

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

    if (cli.flags.createHtmlOutput) {
      await createHtmlOutput(result.diffNoColor, {
        outputDirectory: cli.flags.htmlOutputDirectory
      });
    }

    if (
      (hasDangerousChanges && cli.flags.failOnDangerousChanges) ||
      (hasBreakingChanges && !cli.flags.ignoreBreakingChanges)
    ) {
      process.exit(1);
      return;
    }
  })
  .catch(err => {
    console.error(chalk.red(`\nERROR: ${err.message}`));
    process.exit(1);
  });
