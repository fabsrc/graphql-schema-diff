import {
  findBreakingChanges,
  findDangerousChanges,
  DangerousChange,
  BreakingChange,
} from "graphql";
import { lexicographicSortSchema } from "graphql/utilities";
import disparity from "disparity";
import { loadSchema } from "@graphql-tools/load";
import { UrlLoader } from "@graphql-tools/url-loader";
import { JsonFileLoader } from "@graphql-tools/json-file-loader";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import fetch from "node-fetch";

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
  options: DiffOptions = {},
): Promise<DiffResponse | undefined> {
  const getSchemaOptions = (customHeaders?: Headers) => ({
    headers: { ...options.headers, ...customHeaders },
    skipGraphQLImport: false,
    descriptions: false,
    customFetch: fetch,
  });
  const leftSchemaOptions = getSchemaOptions(options.leftSchema?.headers);
  const rightSchemaOptions = getSchemaOptions(options.rightSchema?.headers);

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
    printSchemaWithDirectives(leftSchema),
    printSchemaWithDirectives(rightSchema),
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
