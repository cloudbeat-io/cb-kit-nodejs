import { CaseResult, StepResult, SuiteResult, TestResult } from '@cloudbeat/types';
import { io, Socket } from 'socket.io-client';
import { CbReporterClient } from './CbReporterClient';
const Queue = require('js-queue');

export class LocalReporterClient implements CbReporterClient {
    private socket?: Socket;
    private queue?: any;

    constructor() {
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

    onCaseStart(cbCase: CaseResult): void {
        // this.queue.add(this.getEventPayload('case:start', cbCase));
    }
    onCaseEnd(cbCase: CaseResult): void {
        // this.queue.add(this.getEventPayload('case:end', cbCase));
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
