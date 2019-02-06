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
import path from 'path';
import { fileLoader, mergeTypes } from 'merge-graphql-schemas';
import isGlob from 'is-glob';

interface DiffResponse {
  diff: string;
  dangerousChanges: DangerousChange[];
  breakingChanges: BreakingChange[];
}

export class GraphQLSchemaDiff {
  private schema1: GraphQLSchema | undefined;
  private schema2: GraphQLSchema | undefined;
  private schema1SDL: string = '';
  private schema2SDL: string = '';

  constructor(
    private schema1Location: string,
    private schema2Location: string
  ) {}

  private async fetchRemoteSchema(endpoint: string): Promise<GraphQLSchema> {
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ query: introspectionQuery })
    })
      .then(res => res.json())
      .then(({ data }: { data: IntrospectionQuery }) =>
        buildClientSchema(data)
      );
  }

  private async readLocalSchema(schemaPath: string): Promise<GraphQLSchema> {
    if (isGlob(schemaPath)) {
      const typesArray = fileLoader(path.join(__dirname, schemaPath));
      const mergedSchema = mergeTypes(typesArray, { all: true });
      return Promise.resolve(buildSchema(mergedSchema));
    } else {
      const schemaString = fs.readFileSync(schemaPath, 'utf8');
      return Promise.resolve(buildSchema(schemaString));
    }
  }

  private async getSchema(schemaLocation: string): Promise<GraphQLSchema> {
    if (schemaLocation.match(/^https?/)) {
      return this.fetchRemoteSchema(schemaLocation);
    } else {
      return this.readLocalSchema(schemaLocation);
    }
  }

  private async loadSchemas(): Promise<void> {
    [this.schema1, this.schema2] = await Promise.all(
      [this.schema1Location, this.schema2Location].map(schemaLocation =>
        this.getSchema(schemaLocation)
      )
    );
    [this.schema1SDL, this.schema2SDL] = [this.schema1, this.schema2].map(
      schema => printSchema(schema) || ''
    );
  }

  public async getDiff(): Promise<DiffResponse | undefined> {
    await this.loadSchemas();

    if (!this.schema1 || !this.schema2) {
      throw new Error('Schemas not defined');
    }

    if (this.schema1SDL === this.schema2SDL) {
      return;
    }

    const diff = disparity.unified(this.schema1SDL, this.schema2SDL, {
      paths: [this.schema1Location, this.schema2Location]
    });
    const dangerousChanges = findDangerousChanges(this.schema1, this.schema2);
    const breakingChanges = findBreakingChanges(this.schema1, this.schema2);

    return {
      diff,
      dangerousChanges,
      breakingChanges
    };
  }
}
