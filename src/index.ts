import "reflect-metadata";
import { Item } from "./entity/item";
import { AppDataSource } from "./datasource";
import { Repository, QueryFailedError, EntityManager } from "typeorm";
import { randomUUID } from "crypto";

// Test Settings
const totalItems = 10000;
const bucket = 100;
const feedbackCount = 1000;


// Retry Settings
const retryMaxCount = 10;
const retryBackoffInterval = 1; // milliseconds
const retryMaxBackoff = 10000; // milliseconds

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let retryCount = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if ((error instanceof QueryFailedError) && (
        (error.driverError.code == 'CR000') || (error.driverError.code == '40001'))
      ) {
        retryCount++;
        if (retryCount < retryMaxCount) {
          let backoff = Math.min(retryMaxBackoff, retryBackoffInterval * Math.pow(2, retryCount-1));
          console.log(`retrying query - retry count of ${retryCount} after a delay of ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue
        }
        console.log(`retry total count of ${retryCount} has been exceeded, not retrying`);
        throw error
      }
      throw error
    }
  }
}


const valuesDetails = {
  a: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  b: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  c: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
}

const values: Array<Item> = new Array<Item>;
const buckets: Array<Array<Item>> = new Array<Array<Item>>;

function generateItems() {
  console.log(`generating ${totalItems} items`);
  console.time("generating items");
  for (let i = 0; i < totalItems; i++) {
    let item = new Item()
    item.id = randomUUID();
    item.a = valuesDetails.a;
    item.b = valuesDetails.b;
    item.c = valuesDetails.c;
    values.push(item);
  }

  for (let i = 0; i < totalItems; i+=bucket) {
    if (i + bucket < totalItems) {
      buckets.push(values.slice(i,i+bucket));
    } else {
      buckets.push(values.slice(i,totalItems));
    }
  }
  console.timeEnd("generating items");
}

function queryBuilder(rep: Repository<Item>, items: Array<Item>) {
  return rep.createQueryBuilder()
    .insert()
    .into(Item)
    .values(items)
    .orUpdate(["id", "a", "b", "c"], ["id"])
}

function transactionBuilder(rep: Repository<Item>, items: Array<Item>) {
  return async () => {
    const queryRunner = rep.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.upsert(rep.target, items, ["id"]);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

async function insertSerialized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${totalItems} items - serialized`);
  await rep.clear();

  console.time("serialized");
  for (let i = 0; i < totalItems; i++) {
    if ((i+1) % feedbackCount === 0) {
      console.log(`${i+1}/${totalItems} inserted`);
    }
    await retry(() => rep.upsert([values[i]],["id"]));
  }
  console.timeEnd("serialized");

  await rep.clear();
  console.time("serialized - query builder");
  for (let i = 0; i < totalItems; i++) {
    if ((i+1) % feedbackCount === 0) {
      console.log(`${i+1}/${totalItems} inserted`);
    }
    await retry(() => queryBuilder(rep, [values[i]]).execute());
  }
  console.timeEnd("serialized - query builder");

  await rep.clear();
  console.time("serialized - transaction");
  for (let i = 0; i < totalItems; i++) {
    if ((i+1) % feedbackCount === 0) {
      console.log(`${i+1}/${totalItems} inserted`);
    }
    await retry(()=> transactionBuilder(rep, [values[i]])());
  }
  console.timeEnd("serialized - transaction");
}

async function insertParallelized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${totalItems} items - parallelized`);
  await rep.clear();

  console.time("parallelized");
  await Promise.all(values.map(async (item, i) => {
    if ((i+1) % feedbackCount === 0) {
      console.log(`${i+1}/${totalItems} inserted`);
    }
    return retry(() => rep.upsert([item],["id"]));
  }));
  console.timeEnd("parallelized");

  console.time("parallelized - query builder");
  await Promise.all(values.map(async (item, i) => {
    if ((i+1) % feedbackCount === 0) {
      console.log(`${i+1}/${totalItems} inserted`);
    }
    return retry(() => queryBuilder(rep, [item]).execute());
  }));
  console.timeEnd("parallelized - query builder");

  console.time("parallelized - transaction");
  await Promise.all(values.map(async (item, i) => {
    if ((i+1) % feedbackCount === 0) {
      console.log(`${i+1}/${totalItems} inserted`);
    }
    return retry(() => transactionBuilder(rep, [item])());
  }));
  console.timeEnd("parallelized - transaction");
}

async function insertBulkSerialized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${totalItems} items - in buckets of ${bucket} serialized`);
  await rep.clear();

  console.time("bulk serialized");
  for (let i = 0; i < buckets.length; i++) {
    if (((i+1)*bucket) % feedbackCount == 0) {
      console.log(`${(i+1)*bucket}/${totalItems} inserted`);
    }
    await retry(() => rep.upsert(buckets[i],["id"]));
  }
  console.timeEnd("bulk serialized");

  console.time("bulk serialized - query builder");
  for (let i = 0; i < buckets.length; i++) {
    if (((i+1)*bucket) % feedbackCount == 0) {
      console.log(`${(i+1)*bucket}/${totalItems} inserted`);
    }
    await retry(() => queryBuilder(rep, buckets[i]).execute());
  }
  console.timeEnd("bulk serialized - query builder");

  console.time("bulk serialized - transaction");
  for (let i = 0; i < buckets.length; i++) {
    if (((i+1)*bucket) % feedbackCount == 0) {
      console.log(`${(i+1)*bucket}/${totalItems} inserted`);
    }
    await retry(() => transactionBuilder(rep, buckets[i])());
  }
  console.timeEnd("bulk serialized - transaction");
}

async function insertBulkParallelized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${totalItems} items - in buckets of ${bucket} parallelized`);
  await rep.clear();

  console.time("bulk parallelized");
  await Promise.all(buckets.map(async (b, i) => {
    if (((i+1)*bucket) % feedbackCount == 0) {
      console.log(`${(i+1)*bucket}/${totalItems} inserted`);
    }
    retry(() => rep.upsert(b,["id"]));
  }));
  console.timeEnd("bulk parallelized");

  console.time("bulk parallelized - query builder");
  await Promise.all(buckets.map(async (b, i) => {
    if (((i+1)*bucket) % feedbackCount == 0) {
      console.log(`${(i+1)*bucket}/${totalItems} inserted`);
    }
    retry(() => queryBuilder(rep, b).execute());
  }));
  console.timeEnd("bulk parallelized - query builder");

  console.time("bulk parallelized - transaction");
  await Promise.all(buckets.map(async (b, i) => {
    if (((i+1)*bucket) % feedbackCount == 0) {
      console.log(`${(i+1)*bucket}/${totalItems} inserted`);
    }
    retry(() => transactionBuilder(rep, b)());
  }));
  console.timeEnd("bulk parallelized - transaction");
}

async function testRetryableError() {
  console.log(`*** TEST *** Testing Retry Logic - should fail after ${retryMaxCount} tries`);
  let retried = 0;
  try {
    await retry(async () => {
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      // This only worked when inside a transaction.
      try {
        await queryRunner.startTransaction();
        await queryRunner.manager.query(`SET inject_retry_errors_enabled = 'true'`);
        await queryRunner.manager.query(`SELECT now()`);
      } catch (err) {
        retried++;
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        if (!queryRunner.isReleased) {
          await queryRunner.release();
        }
      }
    })
  } catch (err) {
    // do nothing
  }

  if (retried != retryMaxCount) {
    throw new Error(`transaction was not retried ${retryMaxCount} times, got ${retried}`);
  }

  console.log(`*** TEST *** Testing Retry Logic - pass after ${retryMaxCount-1} tries`);
  retried = 0;
  try {
    await retry(async () => {
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      // This only worked when inside a transaction.
      try {
        await queryRunner.startTransaction();
        let shouldRetry = (retried < retryMaxCount-1);
         // This setting seems to stick around, only works to explicitly remove it.
        await queryRunner.manager.query(`SET inject_retry_errors_enabled = '${shouldRetry}'`);
        await queryRunner.manager.query(`SELECT now()`);
        await queryRunner.commitTransaction();
      } catch (err) {
        retried++;
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        if (!queryRunner.isReleased) {
          await queryRunner.release();
        }
      }
    })
  } catch (err) {
    // do nothing
  }

  if (retried != retryMaxCount-1) {
    throw new Error(`transaction was not retried ${retryMaxCount-1} times, got ${retried}`);
  }
}

AppDataSource.initialize().then(async () => {
  generateItems();

  const rep = await AppDataSource.getRepository(Item);
  await insertSerialized(rep);
  await insertParallelized(rep);
  await insertBulkSerialized(rep);
  await insertBulkParallelized(rep);

  await testRetryableError();

}).catch((error) => console.log(error));
