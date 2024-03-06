import { EntityTypeEnum, RunInstanceCaseStatus, RunInstanceStatus, RunStatus, RunStatusEnum } from '@cloudbeat/types';
import { AxiosResponse } from 'axios';

import { convertStringDateToEpoch } from '../../../helpers';

export class GetRunResponse {
    private readonly dto: GetRunDto;

    constructor(
        private response: AxiosResponse<any, any>,
    ) {
        if (!response || !response.data) {
            throw new Error('Invalid response, no data recieved.');
        }
        this.dto = new GetRunDto(response.data);
    }

    public toModel(): RunStatus {
        return this.dto.toModel();
    }
}

export class GetRunDto {
    runId?: string;
    entityId?: number;
    entityType?: string;
    runName?: string;
    resultId?: number;
    startTime?: string;
    endTime?: string;
    duration?: number;
    status?: string;
    progress?: number;
    statusLastUpdate?: string;
    executingUserName?: string;
    executingUserId?: number;
    projectName?: string;
    projectId?: number;
    instances?: GetRunInstanceDto[];

    constructor(data: any) {
        Object.assign<GetRunDto, any>(this, data);
        this.instances = this.instances ? this.instances.map(i => new GetRunInstanceDto(i)) : [];
    }

    public toModel(): RunStatus {
        if (!this.runId) {
            throw new Error('runId is required');
        }
        if (!this.entityId) {
            throw new Error('entityId is required');
        }
        if (!this.runName) {
            throw new Error('runName is required');
        }
        if (!this.startTime) {
            throw new Error('startTime is required');
        }
        if (!this.executingUserName) {
            throw new Error('executingUserName is required');
        }
        if (!this.executingUserId) {
            throw new Error('executingUserId is required');
        }
        if (!this.projectId) {
            throw new Error('projectId is required');
        }
        if (!this.status) {
            throw new Error('status is required');
        }
        if (!this.entityType) {
            throw new Error('entityType is required');
        }
        const newRun: RunStatus = {
            runId: this.runId,
            entityId: this.entityId,
            entityType: EntityTypeEnum[this.entityType as keyof typeof EntityTypeEnum],
            runName: this.runName,
            resultId: this.resultId,
            startTime: convertStringDateToEpoch(this.startTime) || 0,
            endTime: this.endTime ? convertStringDateToEpoch(this.endTime) : undefined,
            duration: this.duration,
            status: RunStatusEnum[this.status as keyof typeof RunStatusEnum],
            progress: this.progress,
            statusLastUpdate: convertStringDateToEpoch(this.statusLastUpdate) || 0,
            executingUserName: this.executingUserName,
            executingUserId: this.executingUserId,
            projectName: this.projectName,
            projectId: this.projectId,
            instances: this.instances ? this.instances.map((i: GetRunInstanceDto) => i.toModel()) : [],
        };
        return newRun;
    }
}

export class GetRunInstanceDto {
    public id?: string;
    public runId?: string;
    public startTime?: string;
    public endTime?: string | null;
    public pendingDuration?: number;
    public initializingStartTime?: string | null;
    public initializingDuration?: number | null;
    public runningStartTime?: string | null;
    public runningDuration?: number | null;
    public status?: RunStatusEnum;
    public statusLastUpdate?: string;
    public progress?: number;
    public capabilitiesJson?: { [key: string]: any };
    public browserName?: string;
    public browserVersion?: string;
    public deviceName?: string;
    public locationName?: string;
    public outputLog?: string;
    public casesStatus?: GetRunCasesStatusJsonDto[];

    constructor(data: any) {
        Object.assign<GetRunInstanceDto, any>(this, data);
        this.casesStatus = this.casesStatus ? this.casesStatus.map(cs => new GetRunCasesStatusJsonDto(cs)) : [];
    }

    public toModel(): RunInstanceStatus {
        /*if (!this.id) {
            throw new Error('id is required');
        }*/
        if (!this.runId) {
            throw new Error('runId is required');
        }
        if (!this.locationName) {
            throw new Error('locationName is required');
        }
        const newInstance: RunInstanceStatus = {
            id: this.id!,
            runId: this.runId,
            startTime: convertStringDateToEpoch(this.startTime) || 0,
            endTime: this.endTime ? convertStringDateToEpoch(this.endTime) : undefined,
            pendingDuration: this.pendingDuration || 0,
            initializingStartTime: this.initializingStartTime ? convertStringDateToEpoch(this.initializingStartTime) || 0 : 0,
            initializingDuration: this.initializingDuration || 0,
            runningStartTime: this.runningStartTime ? convertStringDateToEpoch(this.runningStartTime) : undefined,
            runningDuration: this.runningDuration || 0,
            status: this.status || RunStatusEnum.Finished,
            statusLastUpdate: convertStringDateToEpoch(this.statusLastUpdate) || 0,
            progress: this.progress || 0,
            capabilities: this.capabilitiesJson || {},
            browserName: this.browserName,
            browserVersion: this.browserVersion,
            deviceName: this.deviceName,
            locationName: this.locationName,
            outputLog: this.outputLog,
            casesStatus: this.casesStatus ? this.casesStatus.map(cs => cs.toMap()) : [],
        };
        return newInstance;
    }
}

export class GetRunCasesStatusJsonDto {
    id?: number;
    name?: string;
    order = 0;
    progress = 0;
    iterationsFailed = 0;
    iterationsPassed = 0;

    constructor(data: any) {
        Object.assign<GetRunCasesStatusJsonDto, any>(this, data);
    }

    public toMap(): RunInstanceCaseStatus {
        /*if (!this.id) {
            throw new Error('id is required');
        }*/
        if (!this.name) {
            throw new Error('name is required');
        }
        const newCaseStatus: RunInstanceCaseStatus = {
            id: this.id!,
            name: this.name,
            order: this.order,
            progress: this.progress,
            iterationsFailed: this.iterationsFailed,
            iterationsPassed: this.iterationsPassed,
            failures: [],
        };
        return newCaseStatus;
    }
}
