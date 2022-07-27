"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const item_1 = require("./entity/item");
const datasource_1 = require("./datasource");
const crypto_1 = require("crypto");
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
};
const values = new Array;
const buckets = new Array;
function initTable() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`generating ${count} items`);
        console.time("generating items");
        for (let i = 0; i < count; i++) {
            let item = new item_1.Item();
            item.id = (0, crypto_1.randomUUID)();
            item.a = valuesDetails.a;
            item.b = valuesDetails.b;
            item.c = valuesDetails.c;
            values.push(item);
        }
        for (let i = 0; i < count; i += bucket) {
            if (i + bucket < count) {
                buckets.push(values.slice(i, i + bucket));
            }
            else {
                buckets.push(values.slice(i, count));
            }
        }
        console.timeEnd("generating items");
        console.log("Creating Table");
        console.time("create table");
        yield datasource_1.AppDataSource.manager.query(createTable);
        console.timeEnd("create table");
    });
}
function wipeTable() {
    return __awaiter(this, void 0, void 0, function* () {
        console.time("Truncate Table");
        yield datasource_1.AppDataSource.manager.query(truncateTable);
        console.timeEnd("Truncate Table");
    });
}
function insertSerialized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${count} items - serialized`);
        yield wipeTable();
        console.time("serialized");
        for (let i = 0; i < count; i++) {
            yield rep.upsert([values[i]], ["id"]);
            if (i % feedbackCount === 0) {
                console.log(`${i}/${count} inserted`);
            }
        }
        console.timeEnd("serialized");
    });
}
function insertParallelized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${count} items - parallelized`);
        yield wipeTable();
        console.time("parallelized");
        yield Promise.all(values.map((item, i) => __awaiter(this, void 0, void 0, function* () {
            yield rep.upsert([item], ["id"]);
            if (i % feedbackCount === 0) {
                console.log(`${i}/${count} inserted`);
            }
        })));
        console.timeEnd("parallelized");
    });
}
function insertBulkSerialized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${count} items - in buckets of ${bucket} serialized`);
        yield wipeTable();
        console.time("bulk serialized");
        for (let i = 0; i < buckets.length; i++) {
            yield rep.upsert(buckets[i], ["id"]);
            console.log(`${i * bucket}/${count} inserted`);
        }
        console.timeEnd("bulk serialized");
    });
}
function insertBulkParallelized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${count} items - in buckets of ${bucket} parallelized`);
        yield wipeTable();
        console.time("bulk parallelized");
        yield Promise.all(buckets.map((b, i) => __awaiter(this, void 0, void 0, function* () {
            yield rep.upsert(b, ["id"]);
            console.log(`${i * bucket}/${count} inserted`);
        })));
        console.timeEnd("bulk parallelized");
    });
}
datasource_1.AppDataSource.initialize().then(() => __awaiter(void 0, void 0, void 0, function* () {
    yield initTable();
    const rep = yield datasource_1.AppDataSource.getRepository(item_1.Item);
    // await insertSerialized(rep);
    yield insertParallelized(rep);
    yield insertBulkSerialized(rep);
    yield insertBulkParallelized(rep);
})).catch((error) => console.log(error));
