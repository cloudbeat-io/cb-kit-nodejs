import { FailureResult } from '../results/FailureResult';

export interface RunInstanceCaseStatus {
    id: number;
    name: string;
    order: number;
    iterationsPassed: number;
    iterationsFailed: number;
    progress: number;
    failures: FailureResult[];
}
