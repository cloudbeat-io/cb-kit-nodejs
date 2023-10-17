import { FailureResult } from './FailureResult';
import { ResultStatusEnum } from './ResultStatusEnum';
import { StepTypeEnum } from './StepTypeEnum';

export interface HttpStepExtra {
    request: any;
    response: any;
}

export interface StepResult {
    id: string;
    startTime?: number;
    endTime?: number;
    duration?: number;
    fqn?: string;
    name: string;
    location?: string;
    type?: StepTypeEnum;
    transaction?: string;
    status?: ResultStatusEnum;
    screenShot?: string;
    loadEvent?: number;
    domContentLoadedEvent?: number;
    failure?: FailureResult;
    stats?: {[key: string]: string | number};
    steps?: StepResult[];
    extra?: {
        http?: HttpStepExtra;
    };
}
