import { DataSource } from "typeorm";
import notesDataSource from './datasources/NotesDataSource';
import sqliteParams from './sqliteParams';

export const initializeDataSources = (async () => {
    //check sqlite connections consistency
    await sqliteParams.connection.checkConnectionsConsistency()
        .catch((e) => {
            console.log(e);
            return {};
        });

    // Loop through the DataSources
    for (const mDataSource of [notesDataSource]) {
        // initialize
        await mDataSource.dataSource.initialize();
        if (mDataSource.dataSource.isInitialized) {
            // run the migrations
            await mDataSource.dataSource.runMigrations();
        }
        if (sqliteParams.platform === 'web') {
            await sqliteParams.connection.saveToStore(mDataSource.dbName);
        }
    }
});

export const getCountOfElements = (async (connection: DataSource, entity: any): Promise<number> => {
    // Get the repository for your entity
    const repository = connection.getRepository(entity);
    // Use the count() method to query the count of elements in the table
    const count = await repository.count();

    return count;
});