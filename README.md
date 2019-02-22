# GraphQL Schema Diff

[![Build Status](https://img.shields.io/travis/fabsrc/graphql-schema-diff.svg?style=flat-square)](https://travis-ci.org/fabsrc/graphql-schema-diff)
[![npm](https://img.shields.io/npm/v/graphql-schema-diff.svg?style=flat-square)](https://www.npmjs.com/package/graphql-schema-diff)
[![Dependencies](https://img.shields.io/david/fabsrc/graphql-schema-diff.svg?style=flat-square)](https://david-dm.org/fabsrc/graphql-schema-diff)
[![Development Dependencies](https://img.shields.io/david/dev/fabsrc/graphql-schema-diff.svg?style=flat-square)](https://david-dm.org/fabsrc/graphql-schema-diff?type=dev)

Returns the diff of two GraphQL schemas and detects dangerous and breaking changes.

## Install

```sh
$ npm install -g graphql-schema-diff
```

## Usage

```sh

  Returns the diff of two GraphQL schemas. Detects dangerous and breaking changes.

  Usage
    $ graphql-schema-diff <schema1Location> <schema2Location>

  Options
    --fail-on-dangerous-changes  Exit with error on dangerous changes
    --ignore-breaking-changes  Do not exit with error on breaking changes
    --create-html-output  Creates an HTML file containing the diff
    --html-output-directory  Directory where the HTML file should be stored (Default: './schemaDiff')

  Examples
    $ graphql-schema-diff https://example.com/graphql schema.graphql

```

Schema locations can be:

* An URL to a GraphQL endpoint (e.g. `https://swapi.graph.cool/`)
* A path to a single file (e.g. `schemas/schema.graphql`)
* A glob pattern to merge multiple files (e.g. `'schemas/**/*.graphql'`)


## API

### Example

```js
import { getDiff } from 'graphql-schema-diff';

const currentSchemaLocation = 'https://swapi.graph.cool/';
const newSchemaLocation = './schema.graphql';

getDiff(currentSchemaLocation, newSchemaLocation)
  .then((result) => {
    if (!result) {
      console.log('Schemas are identical!');
      return;
    }

    console.log(result.diff);
    console.log(result.dangerousChanges);
    console.log(result.breakingChanges);
  });
```
