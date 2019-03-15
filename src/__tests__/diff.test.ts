import nock from 'nock';
import path from 'path';
import { getDiff } from '../diff';
import { introspectionQuery } from 'graphql';
import introspectionResponse from './fixtures/introspectionResponse.json';

describe('getDiff', () => {
  describe('remote schema fetching', () => {
    const testRemoteSchemaLocation = 'http://test/graphql';

    it('fetches remote schema successfully', async () => {
      nock(testRemoteSchemaLocation)
        .post('', JSON.stringify({ query: introspectionQuery }))
        .twice()
        .reply(200, introspectionResponse);

      const result = await getDiff(
        testRemoteSchemaLocation,
        testRemoteSchemaLocation
      );
      expect(result).toBeUndefined();
    });

    it('fetches remote schemas with headers', async () => {
      nock(testRemoteSchemaLocation)
        .matchHeader('test', 'test')
        .post('', JSON.stringify({ query: introspectionQuery }))
        .twice()
        .reply(200, introspectionResponse);

      const result = await getDiff(
        testRemoteSchemaLocation,
        testRemoteSchemaLocation,
        {
          headers: {
            Test: 'test'
          }
        }
      );
      expect(result).toBeUndefined();
    });

    it('fetches remote schemas with left and right schema headers', async () => {
      const testRemoteRightSchemaLocation = 'http://testRight/graphql';
      nock(testRemoteSchemaLocation)
        .matchHeader('test', 'left')
        .post('', JSON.stringify({ query: introspectionQuery }))
        .reply(200, introspectionResponse);
      nock(testRemoteRightSchemaLocation)
        .matchHeader('test', 'right')
        .post('', JSON.stringify({ query: introspectionQuery }))
        .reply(200, introspectionResponse);

      const result = await getDiff(
        testRemoteSchemaLocation,
        testRemoteRightSchemaLocation,
        {
          leftSchema: {
            headers: {
              Test: 'left'
            }
          },
          rightSchema: {
            headers: {
              Test: 'right'
            }
          }
        }
      );
      expect(result).toBeUndefined();
    });

    it('fetches remote schemas with merged schema headers', async () => {
      const testRemoteRightSchemaLocation = 'http://testRight/graphql';
      nock(testRemoteSchemaLocation)
        .matchHeader('global', 'merged')
        .matchHeader('test', 'left')
        .post('', JSON.stringify({ query: introspectionQuery }))
        .reply(200, introspectionResponse);
      nock(testRemoteRightSchemaLocation)
        .matchHeader('global', 'merged')
        .matchHeader('test', 'right')
        .post('', JSON.stringify({ query: introspectionQuery }))
        .reply(200, introspectionResponse);

      const result = await getDiff(
        testRemoteSchemaLocation,
        testRemoteRightSchemaLocation,
        {
          headers: {
            Global: 'merged',
          },
          leftSchema: {
            headers: {
              Test: 'left'
            }
          },
          rightSchema: {
            headers: {
              Test: 'right'
            }
          }
        }
      );
      expect(result).toBeUndefined();
    });

    it('throws error on status codes other than 200', () => {
      nock(testRemoteSchemaLocation)
        .post('', JSON.stringify({ query: introspectionQuery }))
        .twice()
        .reply(404);

      return expect(
        getDiff(testRemoteSchemaLocation, testRemoteSchemaLocation)
      ).rejects.toThrow(`404 - Not Found (${testRemoteSchemaLocation})`);
    });

    it('throws error on invalid response', () => {
      nock(testRemoteSchemaLocation)
        .post('', JSON.stringify({ query: introspectionQuery }))
        .twice()
        .reply(200, { invalid: 'response' });

      return expect(
        getDiff(testRemoteSchemaLocation, testRemoteSchemaLocation)
      ).rejects.toThrow(`Invalid response from GraphQL endpoint: ${testRemoteSchemaLocation}`);
    });

    afterEach(() => {
      nock.cleanAll();
    });
  });

  describe('local schema reading', () => {
    it('works with exact path to file', async () => {
      const localSchemaLocation = path.join(
        __dirname,
        './fixtures/localSchema.graphql'
      );
      const result = await getDiff(localSchemaLocation, localSchemaLocation);
      expect(result).toBeUndefined();
    });

    it('works with glob pattern', async () => {
      const localSchemaLocation = path.join(
        __dirname,
        './fixtures/**/localSchema.graphql'
      );
      const result = await getDiff(localSchemaLocation, localSchemaLocation);
      expect(result).toBeUndefined();
    });

    it('throws error on non-existent path', () => {
      return expect(
        getDiff(
          path.join(__dirname, 'invalidLocation'),
          path.join(__dirname, 'invalidLocation')
        )
      ).rejects.toThrow(/ENOENT/);
    });

    it('throws error on non-existent files in glob pattern', () => {
      return expect(
        getDiff(
          path.join(__dirname, '/**/*.invalidgql'),
          path.join(__dirname, '/**/*.invalidgql')
        )
      ).rejects.toThrow(/No types found with glob pattern '.*'/);
    });
  });

  describe('schema diffing', () => {
    it('returns the exact diff between two schemas', async () => {
      const result = await getDiff(
        path.join(__dirname, 'fixtures/localSchema.graphql'),
        path.join(__dirname, 'fixtures/localSchemaDangerous.graphql')
      );

      expect(result).toBeDefined();

      if (result) {
        expect(result.diff).toMatch(/\+  SECOND_VALUE/);
      }
    });

    it('returns dangerous changes', async () => {
      const result = await getDiff(
        path.join(__dirname, 'fixtures/localSchema.graphql'),
        path.join(__dirname, 'fixtures/localSchemaDangerous.graphql')
      );

      expect(result).toBeDefined();

      if (result) {
        expect(result.dangerousChanges).toEqual([
          {
            description: 'SECOND_VALUE was added to enum type TestEnum.',
            type: 'VALUE_ADDED_TO_ENUM'
          }
        ]);
      }
    });

    it('returns breaking changes', async () => {
      const result = await getDiff(
        path.join(__dirname, 'fixtures/localSchema.graphql'),
        path.join(__dirname, 'fixtures/localSchemaBreaking.graphql')
      );

      expect(result).toBeDefined();

      if (result) {
        expect(result.breakingChanges).toEqual([
          {
            description: 'Query.test changed type from String to Int.',
            type: 'FIELD_CHANGED_KIND'
          }
        ]);
      }
    });
  });
});
