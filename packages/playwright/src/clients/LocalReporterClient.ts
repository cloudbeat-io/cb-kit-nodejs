import fs from 'fs';
import { v2 } from '@cloudbeat/client';
import { CaseResult, RunStatusEnum, StepResult, SuiteResult, TestResult } from '@cloudbeat/types';
import { io, Socket } from 'socket.io-client';
import { FRAMEWORK_NAME, LANGUAGE_NAME } from '../const';
import { CbReporterClient } from './CbReporterClient';

// how long to wait for a single ack from the agent wrapper before re-sending the event
const ACK_TIMEOUT_MS = 5000;
const RUN_START_TIMEOUT_MS = 10000;
// the run result is the most important message - give it enough time to be delivered, even across reconnects
const RUN_END_TIMEOUT_MS = 30000;

export class LocalReporterClient implements CbReporterClient {
    private socket?: Socket;
    private runStartDelivery?: Promise<boolean>;
    private runEndDelivery?: Promise<boolean>;
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
        if (this.socket) {
            return;
        }
        this.socket = io(
            `ws://localhost:${  process.env.CB_REPORT_SERVER_PORT || 3000}`,
            {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 500,
                reconnectionDelayMax: 5000,
                // never give up: the wrapper is a local process which lives as long as we do
                reconnectionAttempts: Infinity,
                auth: {
                    runId: process.env.CB_RUN_ID,
                },
            },
        );
        this.socket.io.on('error', (err) => {
            console.error('socket.io error', err);
        });
    }

    onRunStart(): void {
        this.runStartDelivery = this.emitReliably('run:start', {}, RUN_START_TIMEOUT_MS);
    }

    onRunEnd(result?: TestResult): void {
        // safety net: persist the result on disk, so the wrapper can pick it up even if the socket delivery fails
        this.writeFallbackResultFile(result);
        this.runEndDelivery = this.emitReliably('run:end', result, RUN_END_TIMEOUT_MS);
    }

    async flush(): Promise<void> {
        await Promise.all([this.runStartDelivery, this.runEndDelivery]);
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

    onCasePending(cbCase: CaseResult, cbParentSuite: SuiteResult): void {
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
            runStatus: RunStatusEnum.Pending,
            framework: FRAMEWORK_NAME,
            language: LANGUAGE_NAME,
        });
    }

    onCaseStart(cbCase: CaseResult, cbParentSuite: SuiteResult): void {
        if (!this.cbApiClient) {
            return;
        }
        let caps;
        if (cbCase.context && cbCase.context.browserName) {
            caps = {
                browserName: cbCase.context.browserName,
            };
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
            capabilities: caps,
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

    private writeFallbackResultFile(result?: TestResult): void {
        const filePath = process.env.CB_RESULT_FALLBACK_FILE;
        if (!filePath || !result) {
            return;
        }
        try {
            fs.writeFileSync(filePath, JSON.stringify(result));
        }
        catch (e) {
            console.error('[CloudBeat] Failed to write the fallback result file:', e);
        }
    }

    /**
     * Emits the event and waits for the ack. If the socket is down or the ack doesn't arrive in time -
     * waits for reconnect and re-sends, until the overall timeout expires.
     * Resolves to true if the event was acknowledged.
     */
    private async emitReliably(eventName: string, payload: any, timeoutMs: number): Promise<boolean> {
        const socket = this.socket;
        if (!socket) {
            return false;
        }
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (!socket.connected) {
                await this.waitForConnect(socket, deadline - Date.now());
                continue;
            }
            try {
                await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(eventName, payload);
                return true;
            }
            catch (e: any) {
                // ack timeout (or disconnect in the middle) - try again.
                // anything else (e.g. non-serializable payload) is not recoverable
                if (!e || e.message !== 'operation has timed out') {
                    console.error(`[CloudBeat] Failed to send '${eventName}' event:`, e);
                    return false;
                }
            }
        }
        console.error(`[CloudBeat] Timed out sending '${eventName}' event to the agent`);
        return false;
    }

    private waitForConnect(socket: Socket, timeoutMs: number): Promise<void> {
        return new Promise((resolve) => {
            if (timeoutMs <= 0 || socket.connected) {
                resolve();
                return;
            }
            const done = () => {
                clearTimeout(timer);
                socket.off('connect', done);
                resolve();
            };
            const timer = setTimeout(done, Math.min(timeoutMs, 1000));
            socket.once('connect', done);
        });
    }
}
