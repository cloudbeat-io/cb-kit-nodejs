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
    runId: string;
    entityId: number;
    entityType: string;
    runName: string;
    resultId: number | null;
    startTime: string;
    endTime: string | null;
    duration: number | null;
    status: string;
    progress: number;
    statusLastUpdate: string;
    executingUserName: string;
    executingUserId: number;
    projectName: string;
    projectId: number | null;
    instances: GetRunInstanceDto[];

    constructor(data: any) {
        Object.assign<GetRunDto, any>(this, data);
        this.instances = this.instances.map(i => new GetRunInstanceDto(i));
    }

    public toModel(): RunStatus {
        const newRun: RunStatus = {
            runId: this.runId,
            entityId: this.entityId,
            entityType: EntityTypeEnum[this.entityType],
            runName: this.runName,
            resultId: this.resultId,
            startTime: convertStringDateToEpoch(this.startTime),
            endTime: this.endTime ? convertStringDateToEpoch(this.endTime) : undefined,
            duration: this.duration,
            status: RunStatusEnum[this.status],
            progress: this.progress,
            statusLastUpdate: convertStringDateToEpoch(this.statusLastUpdate),
            executingUserName: this.executingUserName,
            executingUserId: this.executingUserId,
            projectName: this.projectName,
            projectId: this.projectId,
            instances: this.instances ? this.instances.map((i: GetRunInstanceDto) => i.toModel()) : undefined,
        };
        return newRun;
    }
}

export class GetRunInstanceDto {
    id: string;
    runId: string;
    startTime: string;
    endTime: string | null;
    pendingDuration: number;
    initializingStartTime: string | null;
    initializingDuration: number | null;
    runningStartTime: string | null;
    runningDuration: number | null;
    status: string;
    statusLastUpdate: string;
    progress: number;
    capabilitiesJson: { [key: string]: any };
    browserName?: string;
    browserVersion?: string;
    deviceName?: string;
    locationName: string;
    outputLog: string;
    casesStatus: GetRunCasesStatusJsonDto[];

    constructor(data: any) {
        Object.assign<GetRunInstanceDto, any>(this, data);
        this.casesStatus = this.casesStatus.map(cs => new GetRunCasesStatusJsonDto(cs));
    }

    public toModel(): RunInstanceStatus {
        const newInstance: RunInstanceStatus = {
            id: this.id,
            runId: this.runId,
            startTime: convertStringDateToEpoch(this.startTime),
            endTime: this.endTime ? convertStringDateToEpoch(this.endTime) : undefined,
            pendingDuration: this.pendingDuration,
            initializingStartTime: this.initializingStartTime ? convertStringDateToEpoch(this.initializingStartTime) : undefined,
            initializingDuration: this.initializingDuration,
            runningStartTime: this.runningStartTime ? convertStringDateToEpoch(this.runningStartTime) : undefined,
            runningDuration: this.runningDuration,
            status: RunStatusEnum[this.status],
            statusLastUpdate: convertStringDateToEpoch(this.statusLastUpdate),
            progress: this.progress,
            capabilities: this.capabilitiesJson,
            browserName: this.browserName,
            browserVersion: this.browserVersion,
            deviceName: this.deviceName,
            locationName: this.locationName,
            outputLog: this.outputLog,
            casesStatus: this.casesStatus.map(cs => cs.toMap()),
        };
        return newInstance;
    }
}

export class GetRunCasesStatusJsonDto {
    id: number;
    name: string;
    order: number;
    progress: number;
    iterationsFailed: number;
    iterationsPassed: number;

    constructor(data: any) {
        Object.assign<GetRunCasesStatusJsonDto, any>(this, data);
    }

    public toMap(): RunInstanceCaseStatus {
        const newCaseStatus: RunInstanceCaseStatus = {
            id: this.id,
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
