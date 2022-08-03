import "reflect-metadata"
import * as fs from 'fs'
import { DataSource } from "typeorm"
import { Item } from "./entity/item"

export const AppDataSource = new DataSource({
    type: "cockroachdb",

    // Cockroach Cloud
    /*
    url: "postgresql://bram:Ttt5p5vBQ2PhdglkM1d5lQ@wilted-chimera-72q.aws-us-west-2.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&sslrootcert=/Users/bram/Library/CockroachCloud/certs/wilted-chimera-ca.crt",
    ssl: {
        ca: fs.readFileSync('/Users/bram/Library/CockroachCloud/certs/wilted-chimera-ca.crt').toString(),
    },
    extra: {
        //connectionLimit: 10000, // mysql only
        max: 1000,  // Adjust this to optimize the ingestion
    },
    */

    // Cockroach Demo -- Insecure
    url: "postgresql://root@127.0.0.1:26257/movr?sslmode=disable",
    ssl: false,
    extra: {
        //connectionLimit: 10000, // mysql only
        max: 250,   // Adjust this to optimize the ingestion, 250 worked locally with demo
    },

    synchronize: true,
    logging: false,
    entities: [Item],
    migrations: [],
    subscribers: [],
})