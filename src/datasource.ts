import "reflect-metadata"
import { DataSource } from "typeorm"
import { Item } from "./entity/item"

export const AppDataSource = new DataSource({
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
    entities: [Item],
    migrations: [],
    subscribers: [],
})