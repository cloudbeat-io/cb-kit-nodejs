import { EntityTypeEnum, RunInstanceCaseStatus, RunInstanceStatus, RunStatus, RunStatusEnum } from '@cloudbeat/types';
import { AxiosResponse } from 'axios';

import { convertStringDateToEpoch } from '../../../helpers';

export class GetSyncStatusResponse {
    private readonly dto: ProjectSyncStatus;

    constructor(
        private response: AxiosResponse<any, any>,
    ) {
        if (!response || !response.data) {
            throw new Error('Invalid response, no data recieved.');
        }
        this.dto = new ProjectSyncStatus(response.data);
    }
    public toModel(): ProjectSyncStatus {
        return this.dto;
    }
}

export class ProjectSyncStatus {
    commitHash?: string;
    syncDate?: string;
    syncStatus?: string;
    message?: string;

    constructor(data: any) {
        Object.assign<ProjectSyncStatus, any>(this, data);
    }
}
