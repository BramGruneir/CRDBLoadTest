import "reflect-metadata";
import { Item } from "./entity/item";
import { AppDataSource } from "./datasource";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";

const count = 100000;
const bucket = 1000;
const feedbackCount = 1000;

const createTable = `
DROP TABLE IF EXISTS items;
CREATE TABLE items (
  id UUID PRIMARY KEY
 ,a string
 ,b string
 ,c string
);
`;

const truncateTable = `
TRUNCATE TABLE items;
`;

const valuesDetails = {
  a: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  b: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  c: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
}

const values: Array<Item> = new Array<Item>;
const buckets: Array<Array<Item>> = new Array<Array<Item>>;

async function initTable() {
  console.log(`generating ${count} items`);
  console.time("generating items");
  for (let i = 0; i < count; i++) {
    let item = new Item()
    item.id = randomUUID();
    item.a = valuesDetails.a;
    item.b = valuesDetails.b;
    item.c = valuesDetails.c;
    values.push(item);
  }

  for (let i = 0; i < count; i+=bucket) {
    if (i + bucket < count) {
      buckets.push(values.slice(i,i+bucket));
    } else {
      buckets.push(values.slice(i,count));
    }
  }
  console.timeEnd("generating items");

  console.log("Creating Table");
  console.time("create table");
  await AppDataSource.manager.query(createTable);
  console.timeEnd("create table");
}

async function wipeTable() {
  console.time("Truncate Table");
  await AppDataSource.manager.query(truncateTable);
  console.timeEnd("Truncate Table");
}

async function insertSerialized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${count} items - serialized`);
  await wipeTable();

  console.time("serialized");
  for (let i = 0; i < count; i++) {
    await rep.upsert([values[i]],["id"]);
    if (i % feedbackCount === 0) {
      console.log(`${i}/${count} inserted`);
    }
  }
  console.timeEnd("serialized");
}

async function insertParallelized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${count} items - parallelized`);
  await wipeTable();

  console.time("parallelized");
  await Promise.all(values.map(async (item, i) => {
    await rep.upsert([item],["id"]);
    if (i % feedbackCount === 0) {
      console.log(`${i}/${count} inserted`);
    }
  }));
  console.timeEnd("parallelized");
}

async function insertBulkSerialized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${count} items - in buckets of ${bucket} serialized`);
  await wipeTable();

  console.time("bulk serialized");
  for (let i = 0; i < buckets.length; i++) {
    await rep.upsert(buckets[i],["id"]);
    console.log(`${i*bucket}/${count} inserted`);
  }
  console.timeEnd("bulk serialized");
}

async function insertBulkParallelized(rep: Repository<Item>) {
  console.log(`*** TEST *** INSERT ${count} items - in buckets of ${bucket} parallelized`);
  await wipeTable();

  console.time("bulk parallelized");
  await Promise.all(buckets.map(async (b, i) => {
    await rep.upsert(b,["id"]);
    console.log(`${i*bucket}/${count} inserted`);
  }));
  console.timeEnd("bulk parallelized");
}


AppDataSource.initialize().then(async () => {
  await initTable();

  const rep = await AppDataSource.getRepository(Item);

  // await insertSerialized(rep);
  await insertParallelized(rep);
  await insertBulkSerialized(rep);
  await insertBulkParallelized(rep);

}).catch((error) => console.log(error));
