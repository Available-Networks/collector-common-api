import * as fs from 'fs/promises';
import * as path from 'path';
import { CloudUploadClientCollection, CloudUploadOpts } from '../cloud';
import { NodeEnv } from '../config/types';
import { type Logger } from '../logging';
import { formatDate, isValidData } from './util';

export interface FileMeta {
    serviceName: string,
    dataSourceName: string,
    timeToday: string
}

/**
 * Exports data to a JSON file
 *
 * @param rootDir - Directory to write file
 * @param data - Data to serialize
 * @param meta - File metadata
 */
export const exportDataToFile = (rootDir: string, data: any, meta: FileMeta): void => {
    const { serviceName, dataSourceName, timeToday } = meta;

    const filename = `${serviceName}-${dataSourceName}-${timeToday}.json`;
    const filePath = path.join(rootDir, filename);
    const serializedData = JSON.stringify(data, null, 2);

    fs.writeFile(filePath, serializedData);
}


/**
 * Exports multiple data sources to either local files or cloud storage.
 *
 * @param uploaders - Cloud uploader collection
 * @param theData - Object mapping data source names to data
 * @param nodeEnv - Node environment ("production" writes to cloud)
 * @param uploadOpts - Options for cloud upload
 */
export const exportData = async (
    uploaders: CloudUploadClientCollection,
    theData: Record<string, any>,
    nodeEnv: NodeEnv,
    uploadOpts: CloudUploadOpts,
    logger: Logger
) => {
    const timeToday = formatDate(new Date());
    const longestName = Math.max(...Object.keys(theData).map(n => n.length));
    const isProduction = nodeEnv === "production";
``
    await Promise.all(
        Object.entries(theData).map(([dataSourceName, data]) => {
            if (!isValidData(data)) {
                logger.logWithLevel(`Data source '${dataSourceName}' returned no data`, "warn");
                return null;
            }

            const serializedData = JSON.stringify(data, null, 2);
            if (isProduction) {
                const opts: CloudUploadOpts = { ...uploadOpts, dataSourceName };
                uploaders.upload(serializedData, opts);
            } else {
                const filename = `${uploadOpts.serviceName}-${dataSourceName}-${timeToday}.json`;
                const filePath = path.join("data", filename);

                logger.logWithLevel(`Writing data source ${dataSourceName.padEnd(longestName + 1)} to '${filePath}'`, "info");
                exportDataToFile("data", serializedData, {
                    dataSourceName: dataSourceName,
                    serviceName: uploadOpts.serviceName,
                    timeToday: timeToday
                })
            }
        })
    );
};