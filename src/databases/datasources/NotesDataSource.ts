import { DataSource, type DataSourceOptions } from 'typeorm';
import sqliteParams from '../sqliteParams';
import * as entities from '../entities/notes';
import * as migrations from '../migrations/notes';

const dbName = "ritize-notes";

const dataSourceConfig = {
    name: 'notesConnection',
    type: 'capacitor',
    driver: sqliteParams.connection,
    database: dbName,
    mode: 'no-encryption',
    entities: entities,
    migrations: migrations,
    subscribers: [],
    logging: [/*'query',*/ 'error', 'schema'],
    synchronize: process.env.NODE_ENV === 'production',
    migrationsRun: false
};

export const dataSourceNotes = new DataSource(dataSourceConfig as DataSourceOptions);

const notesDataSource = {
    dataSource: dataSourceNotes,
    dbName: dbName
};

export default notesDataSource;