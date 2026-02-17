import AWS3UploadClient from "./clients/aws3UploadClient";
import CloudUploadClient, { CloudUploadOpts } from "./cloudUploadClient";
import CloudUploadClientCollection from "./cloudUploadClientCollection";

export enum CloudUploadClientType {
    AWS3
}

export { 
    CloudUploadClient,
    AWS3UploadClient,
    CloudUploadClientCollection,
    type CloudUploadOpts 
};