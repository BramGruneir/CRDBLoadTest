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
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
// Test Settings
const totalItems = 10000;
const bucket = 100;
const feedbackCount = 1000;
// Retry Settings
const retryMaxCount = 10;
const retryBackoffInterval = 1; // milliseconds
const retryMaxBackoff = 10000; // milliseconds
function retry(fn) {
    return __awaiter(this, void 0, void 0, function* () {
        let retryCount = 0;
        while (true) {
            try {
                return yield fn();
            }
            catch (error) {
                if ((error instanceof typeorm_1.QueryFailedError) && ((error.driverError.code == 'CR000') || (error.driverError.code == '40001'))) {
                    retryCount++;
                    if (retryCount < retryMaxCount) {
                        let backoff = Math.min(retryMaxBackoff, retryBackoffInterval * Math.pow(2, retryCount - 1));
                        console.log(`retrying query - retry count of ${retryCount} after a delay of ${backoff}ms`);
                        yield new Promise((r) => setTimeout(r, backoff));
                        continue;
                    }
                    console.log(`retry total count of ${retryCount} has been exceeded, not retrying`);
                    throw error;
                }
                throw error;
            }
        }
    });
}
const valuesDetails = {
    a: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    b: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    c: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
};
const values = new Array;
const buckets = new Array;
function generateItems() {
    console.log(`generating ${totalItems} items`);
    console.time("generating items");
    for (let i = 0; i < totalItems; i++) {
        let item = new item_1.Item();
        item.id = (0, crypto_1.randomUUID)();
        item.a = valuesDetails.a;
        item.b = valuesDetails.b;
        item.c = valuesDetails.c;
        values.push(item);
    }
    for (let i = 0; i < totalItems; i += bucket) {
        if (i + bucket < totalItems) {
            buckets.push(values.slice(i, i + bucket));
        }
        else {
            buckets.push(values.slice(i, totalItems));
        }
    }
    console.timeEnd("generating items");
}
function queryBuilder(rep, items) {
    return rep.createQueryBuilder()
        .insert()
        .into(item_1.Item)
        .values(items)
        .orUpdate(["id", "a", "b", "c"], ["id"]);
}
function transactionBuilder(rep, items) {
    return () => __awaiter(this, void 0, void 0, function* () {
        const queryRunner = rep.manager.connection.createQueryRunner();
        yield queryRunner.connect();
        yield queryRunner.startTransaction();
        try {
            yield queryRunner.manager.upsert(rep.target, items, ["id"]);
            yield queryRunner.commitTransaction();
        }
        catch (err) {
            yield queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            yield queryRunner.release();
        }
    });
}
function insertSerialized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${totalItems} items - serialized`);
        yield rep.clear();
        console.time("serialized");
        for (let i = 0; i < totalItems; i++) {
            if ((i + 1) % feedbackCount === 0) {
                console.log(`${i + 1}/${totalItems} inserted`);
            }
            yield retry(() => rep.upsert([values[i]], ["id"]));
        }
        console.timeEnd("serialized");
        yield rep.clear();
        console.time("serialized - query builder");
        for (let i = 0; i < totalItems; i++) {
            if ((i + 1) % feedbackCount === 0) {
                console.log(`${i + 1}/${totalItems} inserted`);
            }
            yield retry(() => queryBuilder(rep, [values[i]]).execute());
        }
        console.timeEnd("serialized - query builder");
        yield rep.clear();
        console.time("serialized - transaction");
        for (let i = 0; i < totalItems; i++) {
            if ((i + 1) % feedbackCount === 0) {
                console.log(`${i + 1}/${totalItems} inserted`);
            }
            yield retry(() => transactionBuilder(rep, [values[i]])());
        }
        console.timeEnd("serialized - transaction");
    });
}
function insertParallelized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${totalItems} items - parallelized`);
        yield rep.clear();
        console.time("parallelized");
        yield Promise.all(values.map((item, i) => __awaiter(this, void 0, void 0, function* () {
            if ((i + 1) % feedbackCount === 0) {
                console.log(`${i + 1}/${totalItems} inserted`);
            }
            return retry(() => rep.upsert([item], ["id"]));
        })));
        console.timeEnd("parallelized");
        console.time("parallelized - query builder");
        yield Promise.all(values.map((item, i) => __awaiter(this, void 0, void 0, function* () {
            if ((i + 1) % feedbackCount === 0) {
                console.log(`${i + 1}/${totalItems} inserted`);
            }
            return retry(() => queryBuilder(rep, [item]).execute());
        })));
        console.timeEnd("parallelized - query builder");
        console.time("parallelized - transaction");
        yield Promise.all(values.map((item, i) => __awaiter(this, void 0, void 0, function* () {
            if ((i + 1) % feedbackCount === 0) {
                console.log(`${i + 1}/${totalItems} inserted`);
            }
            return retry(() => transactionBuilder(rep, [item])());
        })));
        console.timeEnd("parallelized - transaction");
    });
}
function insertBulkSerialized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${totalItems} items - in buckets of ${bucket} serialized`);
        yield rep.clear();
        console.time("bulk serialized");
        for (let i = 0; i < buckets.length; i++) {
            if (((i + 1) * bucket) % feedbackCount == 0) {
                console.log(`${(i + 1) * bucket}/${totalItems} inserted`);
            }
            yield retry(() => rep.upsert(buckets[i], ["id"]));
        }
        console.timeEnd("bulk serialized");
        console.time("bulk serialized - query builder");
        for (let i = 0; i < buckets.length; i++) {
            if (((i + 1) * bucket) % feedbackCount == 0) {
                console.log(`${(i + 1) * bucket}/${totalItems} inserted`);
            }
            yield retry(() => queryBuilder(rep, buckets[i]).execute());
        }
        console.timeEnd("bulk serialized - query builder");
        console.time("bulk serialized - transaction");
        for (let i = 0; i < buckets.length; i++) {
            if (((i + 1) * bucket) % feedbackCount == 0) {
                console.log(`${(i + 1) * bucket}/${totalItems} inserted`);
            }
            yield retry(() => transactionBuilder(rep, buckets[i])());
        }
        console.timeEnd("bulk serialized - transaction");
    });
}
function insertBulkParallelized(rep) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** INSERT ${totalItems} items - in buckets of ${bucket} parallelized`);
        yield rep.clear();
        console.time("bulk parallelized");
        yield Promise.all(buckets.map((b, i) => __awaiter(this, void 0, void 0, function* () {
            if (((i + 1) * bucket) % feedbackCount == 0) {
                console.log(`${(i + 1) * bucket}/${totalItems} inserted`);
            }
            retry(() => rep.upsert(b, ["id"]));
        })));
        console.timeEnd("bulk parallelized");
        console.time("bulk parallelized - query builder");
        yield Promise.all(buckets.map((b, i) => __awaiter(this, void 0, void 0, function* () {
            if (((i + 1) * bucket) % feedbackCount == 0) {
                console.log(`${(i + 1) * bucket}/${totalItems} inserted`);
            }
            retry(() => queryBuilder(rep, b).execute());
        })));
        console.timeEnd("bulk parallelized - query builder");
        console.time("bulk parallelized - transaction");
        yield Promise.all(buckets.map((b, i) => __awaiter(this, void 0, void 0, function* () {
            if (((i + 1) * bucket) % feedbackCount == 0) {
                console.log(`${(i + 1) * bucket}/${totalItems} inserted`);
            }
            retry(() => transactionBuilder(rep, b)());
        })));
        console.timeEnd("bulk parallelized - transaction");
    });
}
function testRetryableError() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** TEST *** Testing Retry Logic - should fail after ${retryMaxCount} tries`);
        let retried = 0;
        try {
            yield retry(() => __awaiter(this, void 0, void 0, function* () {
                const queryRunner = datasource_1.AppDataSource.createQueryRunner();
                yield queryRunner.connect();
                // This only worked when inside a transaction.
                try {
                    yield queryRunner.startTransaction();
                    yield queryRunner.manager.query(`SET inject_retry_errors_enabled = 'true'`);
                    yield queryRunner.manager.query(`SELECT now()`);
                }
                catch (err) {
                    retried++;
                    yield queryRunner.rollbackTransaction();
                    throw err;
                }
                finally {
                    if (!queryRunner.isReleased) {
                        yield queryRunner.release();
                    }
                }
            }));
        }
        catch (err) {
            // do nothing
        }
        if (retried != retryMaxCount) {
            throw new Error(`transaction was not retried ${retryMaxCount} times, got ${retried}`);
        }
        console.log(`*** TEST *** Testing Retry Logic - pass after ${retryMaxCount - 1} tries`);
        retried = 0;
        try {
            yield retry(() => __awaiter(this, void 0, void 0, function* () {
                const queryRunner = datasource_1.AppDataSource.createQueryRunner();
                yield queryRunner.connect();
                // This only worked when inside a transaction.
                try {
                    yield queryRunner.startTransaction();
                    let shouldRetry = (retried < retryMaxCount - 1);
                    // This setting seems to stick around, only works to explicitly remove it.
                    yield queryRunner.manager.query(`SET inject_retry_errors_enabled = '${shouldRetry}'`);
                    yield queryRunner.manager.query(`SELECT now()`);
                    yield queryRunner.commitTransaction();
                }
                catch (err) {
                    retried++;
                    yield queryRunner.rollbackTransaction();
                    throw err;
                }
                finally {
                    if (!queryRunner.isReleased) {
                        yield queryRunner.release();
                    }
                }
            }));
        }
        catch (err) {
            // do nothing
        }
        if (retried != retryMaxCount - 1) {
            throw new Error(`transaction was not retried ${retryMaxCount - 1} times, got ${retried}`);
        }
    });
}
datasource_1.AppDataSource.initialize().then(() => __awaiter(void 0, void 0, void 0, function* () {
    generateItems();
    const rep = yield datasource_1.AppDataSource.getRepository(item_1.Item);
    yield insertSerialized(rep);
    yield insertParallelized(rep);
    yield insertBulkSerialized(rep);
    yield insertBulkParallelized(rep);
    yield testRetryableError();
})).catch((error) => console.log(error));
