import {
  printSchema,
  findBreakingChanges,
  findDangerousChanges,
  DangerousChange,
  BreakingChange,
} from "graphql";
import { lexicographicSortSchema } from "graphql/utilities";
import disparity from "disparity";
import { loadSchema } from "@graphql-toolkit/core";
import { UrlLoader } from "@graphql-toolkit/url-loader";
import { JsonFileLoader } from "@graphql-toolkit/json-file-loader";
import { GraphQLFileLoader } from "@graphql-toolkit/graphql-file-loader";

export type Headers = Record<string, string>;

export interface DiffResponse {
  diff: string;
  diffNoColor: string;
  dangerousChanges: DangerousChange[];
  breakingChanges: BreakingChange[];
}

export interface DiffOptions {
  leftSchema?: {
    headers?: Headers;
  };
  rightSchema?: {
    headers?: Headers;
  };
  headers?: Headers;
  sortSchema?: boolean;
}

export async function getDiff(
  leftSchemaLocation: string,
  rightSchemaLocation: string,
  options: DiffOptions = {}
): Promise<DiffResponse | undefined> {
  const leftSchemaOptions = {
    headers: {
      ...options.headers,
      ...(options.leftSchema && options.leftSchema.headers),
    },
    skipGraphQLImport: false,
    descriptions: false,
  };
  const rightSchemaOptions = {
    headers: {
      ...options.headers,
      ...(options.rightSchema && options.rightSchema.headers),
    },
    skipGraphQLImport: false,
    descriptions: false,
  };
  let [leftSchema, rightSchema] = await Promise.all([
    loadSchema(leftSchemaLocation, {
      loaders: [new UrlLoader(), new JsonFileLoader(), new GraphQLFileLoader()],
      ...leftSchemaOptions,
    }),
    loadSchema(rightSchemaLocation, {
      loaders: [new UrlLoader(), new JsonFileLoader(), new GraphQLFileLoader()],
      ...rightSchemaOptions,
    }),
  ]);

  if (!leftSchema || !rightSchema) {
    throw new Error("Schemas not defined");
  }

  if (options.sortSchema) {
    [leftSchema, rightSchema] = [
      lexicographicSortSchema(leftSchema),
      lexicographicSortSchema(rightSchema),
    ];
  }

  const [leftSchemaSDL, rightSchemaSDL] = [
    printSchema(leftSchema),
    printSchema(rightSchema),
  ];

  if (leftSchemaSDL === rightSchemaSDL) {
    return;
  }

  const diff = disparity.unified(leftSchemaSDL, rightSchemaSDL, {
    paths: [leftSchemaLocation, rightSchemaLocation],
  });
  const diffNoColor = disparity.unifiedNoColor(leftSchemaSDL, rightSchemaSDL, {
    paths: [leftSchemaLocation, rightSchemaLocation],
  });
  const dangerousChanges = findDangerousChanges(leftSchema, rightSchema);
  const breakingChanges = findBreakingChanges(leftSchema, rightSchema);

  return {
    diff,
    diffNoColor,
    dangerousChanges,
    breakingChanges,
  };
}
