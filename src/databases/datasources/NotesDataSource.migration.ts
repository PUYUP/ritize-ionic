import { DataSource, type DataSourceOptions } from 'typeorm';
import * as entities from '../entities/notes/index.js';
import * as migrations from '../migrations/notes/index.js';

const dataSourceConfig = {
    name: 'notesMigrationConnection',
    type: 'better-sqlite3',
    database: 'migration.sqlite',
    entities: entities,
    migrations: migrations,
    subscribers: [],
    logging: ['error', 'schema'],
    synchronize: false,
    migrationsRun: false
};

export const dataSourceNotesMigration = new DataSource(dataSourceConfig as DataSourceOptions);
