import { v2 } from '@cloudbeat/client';
import { CaseResult, ResultStatusEnum, RunStatusEnum, StepResult, SuiteResult, TestResult } from '@cloudbeat/types';
import { io, Socket } from 'socket.io-client';
import { CbReporterClient } from './CbReporterClient';
import { FRAMEWORK_NAME, LANGUAGE_NAME } from '../const';
const Queue = require('js-queue');

export class LocalReporterClient implements CbReporterClient {
    private socket?: Socket;
    private queue?: any;
    private cbApiClient?: v2.RuntimeApi;
    private runId?: string;
    private instanceId?: string;

    constructor() {
        const apiUrl = process.env.CB_TEST_MONITOR_URL;
        const apiToken = process.env.CB_TEST_MONITOR_TOKEN;
        this.runId = process.env.CB_RUN_ID;
        this.instanceId = process.env.CB_INSTANCE_ID;
        if (apiUrl && apiToken && this.runId && this.instanceId) {
            this.cbApiClient = new v2.RuntimeApi(apiUrl, apiToken);
        }
    }

    connect(): void {
        this.queue = new Queue();
        this.queue.stop = true;
        this.queue.autoRun = true;

        this.socket = io(
            `ws://localhost:${  process.env.CB_REPORT_SERVER_PORT || 3000}`,
            {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 500,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 10,
                auth: {
                    runId: process.env.CB_RUN_ID,
                },
            },
        );
        this.handleSocketEvents();
    }

    onRunStart(): void {
        this.queue.add(this.getEventEmitter('run:start', {}));
    }
    onRunEnd(result?: TestResult): void {
        this.queue.add(this.getEventEmitter('run:end', result));
    }

    onSuiteStart(cbSuite: SuiteResult): void {
        if (!this.cbApiClient) {
            return;
        }
        this.cbApiClient.updateSuiteStatus({
            timestamp: new Date().getTime(),
            runId: this.runId!,
            instanceId: this.instanceId!,
            id: cbSuite.id,
            fqn: cbSuite.fqn!,
            name: cbSuite.name,
            startTime: cbSuite.startTime,
            runStatus: RunStatusEnum.Running,
            framework: FRAMEWORK_NAME,
            language: LANGUAGE_NAME,
        });
    }

    onSuiteEnd(cbSuite: SuiteResult): void {
        if (!this.cbApiClient) {
            return;
        }
        this.cbApiClient.updateSuiteStatus({
            timestamp: new Date().getTime(),
            runId: this.runId!,
            instanceId: this.instanceId!,
            id: cbSuite.id,
            fqn: cbSuite.fqn!,
            name: cbSuite.name,
            startTime: cbSuite.startTime,
            endTime: cbSuite.endTime,
            runStatus: RunStatusEnum.Finished,
            testStatus: cbSuite.status!,
            framework: FRAMEWORK_NAME,
            language: LANGUAGE_NAME,
        });
    }

    onCaseStart(cbCase: CaseResult, cbParentSuite: SuiteResult): void {
        if (!this.cbApiClient) {
            return;
        }
        this.cbApiClient.updateCaseStatus({
            timestamp: new Date().getTime(),
            runId: this.runId!,
            instanceId: this.instanceId!,
            id: cbCase.id,
            fqn: cbCase.fqn,
            parentFqn: cbParentSuite.fqn!,
            parentId: cbParentSuite.id,
            name: cbCase.name,
            startTime: cbCase.startTime,
            runStatus: RunStatusEnum.Running,
            framework: FRAMEWORK_NAME,
            language: LANGUAGE_NAME,
        });
    }
    onCaseEnd(cbCase: CaseResult, cbParentSuite: SuiteResult): void {
        if (!this.cbApiClient) {
            return;
        }
        this.cbApiClient.updateCaseStatus({
            timestamp: new Date().getTime(),
            runId: this.runId!,
            instanceId: this.instanceId!,
            id: cbCase.id,
            fqn: cbCase.fqn,
            parentFqn: cbParentSuite.fqn!,
            parentId: cbParentSuite.id,
            name: cbCase.name,
            startTime: cbCase.startTime,
            endTime: cbCase.endTime,
            runStatus: RunStatusEnum.Finished,
            testStatus: cbCase.status!,
            framework: FRAMEWORK_NAME,
            language: LANGUAGE_NAME,
        });
    }

    onStepStart(cbStep: StepResult): void {
        // this.queue.add(this.getEventPayload('step:start', cbStep));
    }
    onStepEnd(cbStep: StepResult): void {
        // this.queue.add(this.getEventPayload('step:end', cbStep));
    }

    private handleSocketEvents() {
        if (!this.socket) {
            return;
        }

        this.socket.io.on('error', (err) => {
			console.error('socket.io error', err);
            this.queue.stop = true;
        });

        this.socket.on('connect', () => {
            this.queue.stop = false;
            this.queue.next();
        });

        this.socket.on('disconnect', () => {
            this.queue.stop = true;
        });
    }

    private getEventEmitter(eventName: string, payload: any): any {
        return () => {
            try {
                this.socket?.emit(eventName, payload, () => this.queue.next());
            }
            catch (e) {
                console.log('LocalReporterClient error:', e);
            }
        };
    }
}
