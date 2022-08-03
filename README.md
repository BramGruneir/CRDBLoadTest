# CRDBLoadTest

Simple Test to load data into CockroachDB using TypeORM.

It runs 5 different tests to show the difference between different methods of loading data.
It can be run against a local cockroach instance or against Cockroach Cloud.

See `src/datasource.ts` for the details on how to connect to cockroach.  And you can turn on
logging to see the SQL statements themselves.

At the top of `src/index.ts`, you can adjust the parameters for the tests in the consts.
At the bottom of the file, you can comment out any test you don't want to run.

This tests the following:

1. Serial loading of data
    1. in a single upsert statement
    1. in a query runner
    1. in a transaction
2. Parallel loading of data
    1. in a single upsert statement
    2. in a query runner
    3. in a transaction
3. Serial Bulk loading of data
    1. in a single upsert statement
    2. in a query runner
    3. in a transaction
4. Parallel Bulk loading of data
    1. in a single upsert statement
    2. in a query runner
    3. in a transaction
5. Retry logic
    1. Where it fails after too many retries
    2. Where it succeeds on the final retry

To run, use `npm start` from the root directory.

Feel free to ping me if you have any questions or corrections.
