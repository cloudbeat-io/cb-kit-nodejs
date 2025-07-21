import { Attachment } from './Attachment';
import { FailureResult } from './FailureResult';
import { ResultStatusEnum } from './ResultStatusEnum';
import { StepTypeEnum } from './StepTypeEnum';

export interface HttpStepExtra {
    request: any;
    response: any;
}

export interface AssertStepExtra {
    actual: any;
    expected: any;
}

export interface GherkinStepExtra {
    type: 'GIVEN' | 'WHEN' | 'THEN';
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
    attachments?: Attachment[];
    extra?: {
        http?: HttpStepExtra;
        gherkin?: GherkinStepExtra;
        assert?: AssertStepExtra;
    };
}
