#!/usr/bin/env node

import meow from 'meow';
import chalk from 'chalk';
import { createHtmlOutput } from './html';
import { getDiff, Headers } from './diff';

const cli = meow(
  `
  Usage
    $ graphql-schema-diff <leftSchemaLocation> <rightSchemaLocation>

  Options
    --fail-on-dangerous-changes  Exit with error on dangerous changes
    --fail-on-breaking-changes  Exit with error on breaking changes
    --fail-on-all-changes  Exit with error on all changes
    --use-colors Use colors for diff terminal output
    --create-html-output  Creates an HTML file containing the diff
    --html-output-directory  Directory where the HTML file should be stored (Default: './schemaDiff')
    --header, -H  Header to send to all remote schema sources
    --left-schema-header  Header to send to left remote schema source
    --right-schema-header Header to send to right remote schema source
    --sort-schema, -s Sort schemas prior to diffing

  Examples
    $ graphql-schema-diff https://example.com/graphql schema.graphql
    $ graphql-schema-diff https://example.com/graphql schema.graphql -H 'Authorization: Bearer 123'
`,
  {
    flags: {
      'fail-on-dangerous-changes': {
        type: 'boolean'
      },
      'fail-on-breaking-changes': {
        type: 'boolean'
      },
      'fail-on-all-changes': {
        type: 'boolean'
      },
      'use-colors': {
        type: 'boolean'
      },
      'create-html-output': {
        type: 'boolean'
      },
      'html-output-directory': {
        type: 'string',
        default: 'schemaDiff'
      },
      header: {
        type: 'string',
        alias: 'H'
      },
      'left-schema-header': {
        type: 'string'
      },
      'right-schema-header': {
        type: 'string'
      },
      'sort-schema': {
        type: 'boolean',
        alias: 's'
      }
    }
  }
);

function parseHeaders(headerInput?: string | string[]): Headers | undefined {
  let headers: string[][];
  const parseHeader = (header: string): string[] =>
    header.split(':').map((val: string) => val.trim());

  if (!headerInput) return;

  if (Array.isArray(headerInput)) {
    headers = headerInput.map(parseHeader);
  } else {
    headers = [parseHeader(headerInput)];
  }

  return headers.reduce(
    (result, [key, value]) => ({
      ...result,
      ...(key && value && { [key]: value })
    }),
    {}
  );
}

const [leftSchemaLocation, rightSchemaLocation]: string[] = cli.input;
const {
  header,
  leftSchemaHeader,
  rightSchemaHeader
}: {
  header?: string | string[];
  leftSchemaHeader?: string | string[];
  rightSchemaHeader?: string | string[];
} = cli.flags;

if (!leftSchemaLocation || !rightSchemaLocation) {
  console.error(
    chalk.red('ERROR: Schema locations missing!\n\n'),
    chalk.gray(
      'Usage\n' +
        '  $ graphql-schema-diff <leftSchemaLocation> <rightSchemaLocation>'
    )
  );
  process.exit(1);
}

getDiff(leftSchemaLocation, rightSchemaLocation, {
  headers: parseHeaders(header),
  leftSchema: {
    headers: parseHeaders(leftSchemaHeader)
  },
  rightSchema: {
    headers: parseHeaders(rightSchemaHeader)
  },
  sortSchema: cli.flags.sortSchema as boolean
})
  .then(async result => {
    if (result === undefined) {
      console.warn(chalk.green('✔ No changes'));
      return;
    }

    const hasBreakingChanges = result.breakingChanges.length !== 0;
    const hasDangerousChanges = result.dangerousChanges.length !== 0;

    if (cli.flags.useColors) {
      console.log(result.diff);
    } else {
      console.log(result.diffNoColor);
    }

    if (hasDangerousChanges) {
      console.warn(chalk.yellow.bold.underline('Dangerous changes'));

      for (const change of result.dangerousChanges) {
        console.warn(chalk.yellow('  ⚠ ' + change.description));
      }
    }

    if (hasDangerousChanges && hasBreakingChanges) {
      console.warn(); // Add additional line break
    }

    if (hasBreakingChanges) {
      console.warn(chalk.red.bold.underline('BREAKING CHANGES'));

      for (const change of result.breakingChanges) {
        console.warn(chalk.red('  ✖ ' + change.description));
      }
    }

    if (cli.flags.createHtmlOutput) {
      await createHtmlOutput(result.diffNoColor, {
        outputDirectory: cli.flags.htmlOutputDirectory as string | undefined
      });
    }

    if (
      (hasDangerousChanges && cli.flags.failOnDangerousChanges) ||
      (hasBreakingChanges && cli.flags.failOnBreakingChanges) ||
      cli.flags.failOnAllChanges
    ) {
      process.exit(1);
      return;
    }
  })
  .catch(err => {
    console.error(chalk.red(`\nERROR: ${err.message}`));
    process.exit(1);
  });
