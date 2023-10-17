import { AuthenticationType, CbRestApiClient } from '../base/CbRestApiClient';

export class ApiBaseClientV2 extends CbRestApiClient {
    constructor(
        protected apiHostUrl: string,
        protected apiToken: string,
    ) {
        super(apiHostUrl, apiToken, AuthenticationType.Bearer);
    }
}
