import { CaseResult, StepResult, SuiteResult, TestResult } from '@cloudbeat/types';
import { CbReporterClient } from './CbReporterClient';

const DEFAULT_SERVER_URL = 'http://localhost:8888';

export class RemoteReporterClient implements CbReporterClient {
    private readonly serverUrl: string;
    constructor(serverUrl?: string) {
        this.serverUrl = serverUrl || DEFAULT_SERVER_URL;
    }

    connect(): void {
        throw new Error('Method not implemented.');
    }

    onRunStart(): void {
        throw new Error('Method not implemented.');
    }
    onRunEnd(result?: TestResult): void {
        throw new Error('Method not implemented.');
    }

    onCaseStart(cbCase: CaseResult): void {

    }
    onCaseEnd(cbCase: CaseResult): void {

    }

    onStepStart(cbStep: StepResult): void {

    }
    onStepEnd(cbStep: StepResult): void {

    }
}
