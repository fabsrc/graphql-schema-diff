# GraphQL Schema Diff

> Generates diffs of two GraphQL schemas and detects breaking changes.

## Install

```sh
$ npm install -g graphql-schema-diff
```

## Usage

```sh
$ graphql-schema-diff <schema1Location> <schema2Location> 
```

Schema locations can be:

* An URL to a GraphQL endpoint (e.g. `https://swapi.graph.cool/`)
* A path to a single file (e.g. `schemas/schema.graphql`)
* A glob pattern to merge multiple files (e.g. `schemas/**/*.graphql`)

### Options

For additional options see:

```sh
$ graphql-schema-diff --help
```

