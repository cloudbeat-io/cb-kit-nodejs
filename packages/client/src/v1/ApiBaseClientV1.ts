import { AuthenticationType, CbRestApiClient } from '../base/CbRestApiClient';

const DEFAULT_API_BASE_URL = 'https://api.cloudbeat.io';

export class ApiBaseClientV1 extends CbRestApiClient {
    constructor(
        protected apiToken: string,
        protected apiHostUrl?: string,
    ) {
        super(apiHostUrl || DEFAULT_API_BASE_URL, apiToken, AuthenticationType.ApiKey);
    }
}
