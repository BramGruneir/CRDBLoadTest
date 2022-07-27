"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const item_1 = require("./entity/item");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "cockroachdb",
    url: process.env.DATABASE_URL,
    /*ssl: { rejectUnauthorized: false }, // For insecure connections only */
    ssl: false,
    extra: {
        options: "--cluster=<routing-id>",
        connectionLimit: 10000,
        max: 500,
    },
    synchronize: true,
    logging: false,
    entities: [item_1.Item],
    migrations: [],
    subscribers: [],
});
