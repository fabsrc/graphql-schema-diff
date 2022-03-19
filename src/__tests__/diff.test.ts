import { URL } from "url";
import { MockAgent, setGlobalDispatcher } from "undici";
import path from "path";
import { getDiff } from "../diff";
import { getIntrospectionQuery, parse, print } from "graphql";
import introspectionResponse from "./fixtures/introspectionResponse.json";

const agent = new MockAgent({ connections: 1 });
setGlobalDispatcher(agent);
agent.disableNetConnect();

describe("getDiff", () => {
  describe("remote schema fetching", () => {
    const testUrl = new URL("http://example.com/graphql");
    const introspectionQueryBody = JSON.stringify({
      query: print(parse(getIntrospectionQuery({ descriptions: false }))),
    });
    const client = agent.get(testUrl.origin);

    it("fetches remote schema successfully", async () => {
      client
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
        })
        .reply(200, introspectionResponse)
        .times(2);

      const result = await getDiff(testUrl.href, testUrl.href);
      expect(result).toBeUndefined();
    });

    it("fetches remote schemas with headers", async () => {
      client
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
          headers: { test: "test" },
        })
        .reply(200, introspectionResponse)
        .times(2);

      const result = await getDiff(testUrl.href, testUrl.href, {
        headers: {
          Test: "test",
        },
      });
      expect(result).toBeUndefined();
    });

    it("fetches remote schemas with left and right schema headers", async () => {
      const testRightUrl = new URL("http://testRight/graphql");
      const rightClient = agent.get(testRightUrl.origin);
      client
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
          headers: { test: "left" },
        })
        .reply(200, introspectionResponse);
      rightClient
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
          headers: { test: "right" },
        })
        .reply(200, introspectionResponse);

      const result = await getDiff(testUrl.href, testRightUrl.href, {
        leftSchema: {
          headers: {
            Test: "left",
          },
        },
        rightSchema: {
          headers: {
            Test: "right",
          },
        },
      });
      expect(result).toBeUndefined();
    });

    it("fetches remote schemas with merged schema headers", async () => {
      const testRightUrl = new URL("http://testRight/graphql");
      const rightClient = agent.get(testRightUrl.origin);
      client
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
          headers: { test: "left", global: "merged" },
        })
        .reply(200, introspectionResponse);
      rightClient
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
          headers: { test: "right", global: "merged" },
        })
        .reply(200, introspectionResponse);

      const result = await getDiff(testUrl.href, testRightUrl.href, {
        headers: {
          Global: "merged",
        },
        leftSchema: {
          headers: {
            Test: "left",
          },
        },
        rightSchema: {
          headers: {
            Test: "right",
          },
        },
      });
      expect(result).toBeUndefined();
    });

    it("throws error on status codes other than 200", () => {
      client
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
        })
        .reply(404, {});

      return expect(getDiff(testUrl.href, testUrl.href)).rejects.toThrow(
        /Could not obtain introspection result/
      );
    });

    it("throws error on invalid response", () => {
      client
        .intercept({
          path: testUrl.pathname,
          method: "POST",
          body: introspectionQueryBody,
        })
        .reply(404, { invalid: "response" });

      return expect(getDiff(testUrl.href, testUrl.href)).rejects.toThrow(
        /Could not obtain introspection result/
      );
    });
  });

  describe("local schema reading", () => {
    it("works with exact path to file", async () => {
      const localSchemaLocation = path.join(
        __dirname,
        "./fixtures/localSchema.graphql"
      );
      const result = await getDiff(localSchemaLocation, localSchemaLocation);
      expect(result).toBeUndefined();
    });

    it("works with glob pattern", async () => {
      const localSchemaLocation = path.join(
        __dirname,
        "./fixtures/**/localSchema.graphql"
      );
      const result = await getDiff(localSchemaLocation, localSchemaLocation);
      expect(result).toBeUndefined();
    });

    it("throws error on non-existent path", () => {
      return expect(
        getDiff(
          path.join(__dirname, "invalidLocation"),
          path.join(__dirname, "invalidLocation")
        )
      ).rejects.toThrow(
        /Unable to find any GraphQL type definitions for the following pointers/
      );
    });

    it("throws error on non-existent files in glob pattern", () => {
      return expect(
        getDiff(
          path.join(__dirname, "/**/*.invalidgql"),
          path.join(__dirname, "/**/*.invalidgql")
        )
      ).rejects.toThrow(
        /Unable to find any GraphQL type definitions for the following pointer/
      );
    });
  });

  describe("schema diffing", () => {
    it("returns the exact diff between two schemas", async () => {
      const result = await getDiff(
        path.join(__dirname, "fixtures/localSchema.graphql"),
        path.join(__dirname, "fixtures/localSchemaDangerous.graphql")
      );

      expect(result).toBeDefined();

      if (result) {
        expect(result.diff).toMatch(/\+  SECOND_VALUE/);
      }
    });

    it("returns dangerous changes", async () => {
      const result = await getDiff(
        path.join(__dirname, "fixtures/localSchema.graphql"),
        path.join(__dirname, "fixtures/localSchemaDangerous.graphql")
      );

      expect(result).toBeDefined();

      if (result) {
        expect(result.dangerousChanges).toEqual([
          {
            description: "SECOND_VALUE was added to enum type TestEnum.",
            type: "VALUE_ADDED_TO_ENUM",
          },
        ]);
      }
    });

    it("returns breaking changes", async () => {
      const result = await getDiff(
        path.join(__dirname, "fixtures/localSchema.graphql"),
        path.join(__dirname, "fixtures/localSchemaBreaking.graphql")
      );

      expect(result).toBeDefined();

      if (result) {
        expect(result.breakingChanges).toEqual([
          {
            description: "Query.test changed type from String to Int.",
            type: "FIELD_CHANGED_KIND",
          },
        ]);
      }
    });
  });

  describe("schema sorting", () => {
    it("returns diff between two unsorted, but otherwise equal schemas, when sorting not enabled", async () => {
      const result = await getDiff(
        path.join(__dirname, "fixtures/localSchemaSorted.graphql"),
        path.join(__dirname, "fixtures/localSchemaUnsorted.graphql")
      );

      expect(result).toBeDefined();
    });

    it("returns nothing between two unsorted, but otherwise equal schemas, when sorting enabled", async () => {
      const result = await getDiff(
        path.join(__dirname, "fixtures/localSchemaSorted.graphql"),
        path.join(__dirname, "fixtures/localSchemaUnsorted.graphql"),
        { sortSchema: true }
      );

      expect(result).toBeUndefined();
    });
  });
});
