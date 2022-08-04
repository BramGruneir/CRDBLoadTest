"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const item_1 = require("./entity/item");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "cockroachdb",
    // Cockroach Cloud
    /*
    url: "postgresql://username:password@wilted-chimera-72q.aws-us-west-2.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&sslrootcert=/Users/username/Library/CockroachCloud/certs/wilted-chimera-ca.crt",
    ssl: {
        ca: fs.readFileSync('/Users/username/Library/CockroachCloud/certs/wilted-chimera-ca.crt').toString(),
    },
    extra: {
        //connectionLimit: 10000, // mysql only, not cockroach
        max: 1000,  // Adjust this to optimize the ingestion
    },
    */
    // Cockroach Demo -- Insecure
    url: "postgresql://root@127.0.0.1:26257/movr?sslmode=disable",
    ssl: false,
    extra: {
        //connectionLimit: 10000, // mysql only, not cockroach
        max: 250, // Adjust this to optimize the ingestion, 250 worked locally with demo
    },
    synchronize: true,
    logging: false,
    entities: [item_1.Item],
    migrations: [],
    subscribers: [],
});
