import fs from 'fs';
import path from 'path';
import {
    Attachment,
    AttachmentSubTypeEnum,
    AttachmentTypeEnum,
    CaseResult as CbCaseResult,
    StepResult as CbStepResult,
    TestResult as CbTestResult,
    FailureResult,
    ResultStatusEnum,
    StepTypeEnum,
} from '@cloudbeat/types';
import { v4 as uuidv4 } from 'uuid';

const CB_TEST_RESULT_FILE_NAME = '.CB_TEST_RESULTS.json';

interface CbHelperEvent {
    type: string;
    data: Record<string, unknown>;
}

interface PwEvent {
    type: string;
    method: string;
    selector?: string;
    actual?: unknown;
    expected?: unknown;
    error?: unknown;
    start: number;
    end: number;
    success: boolean;
}

export function generateResultFile(result: CbTestResult, filePath: string) {
    const fileContent = JSON.stringify(result, null, 4);
    fs.writeFileSync(filePath, fileContent);
}

export function getResultFilePath(outputDir?: string) {
    let resultFileDir;
    if (outputDir) {
        if (!path.isAbsolute(outputDir)) {
            outputDir = path.join(process.cwd(), outputDir);
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        resultFileDir = outputDir;
    }
    else {
        resultFileDir = process.cwd();
    }
    return path.join(resultFileDir, CB_TEST_RESULT_FILE_NAME);
}

export function generateId() {
    return uuidv4();
}

export function determineTestCaseStatus(result: CbCaseResult): ResultStatusEnum {
    if (!result.steps) {
        return ResultStatusEnum.PASSED;
    }
    const hasFailedSteps = result.steps?.some(step => step.status === ResultStatusEnum.FAILED);
    return hasFailedSteps ? ResultStatusEnum.FAILED : ResultStatusEnum.PASSED;
}

export function getFailureFromException(exception: any, defaultErrorType?: string | undefined): FailureResult | undefined {
    if (!exception) {
        return undefined;
    }
    const failure: FailureResult = {
        type: defaultErrorType || 'CUCUMBER_ERROR',
    };
    if (exception.type === 'TimeoutError') {
        failure.type = 'TIMEOUT_ERROR';
    }
    failure.subtype = exception.type;
    failure.message = exception.message;
    failure.stacktrace = exception.stackTrace || exception.stack;
    return failure;
}

export function getFailureFromMessage(message: string): FailureResult | undefined {
    if (!message) {
        return undefined;
    }
    const failure: FailureResult = {
        type: 'CUCUMBER_ERROR',
        message,
    };
    return failure;
}

export function getGherkinStepExtraType(type: string): any {
    switch (type) {
        case 'Action':
            return 'WHEN';
        case 'Context':
            return 'GIVEN';
        case 'Outcome':
            return 'THEN';
    }
    return undefined;
}

export function addAttachmentsOnTestCaseFinished(
    cukeTestCaseId: string,
    cbCaseResult: CbCaseResult,
    startedCbStepMap: Map<string, CbStepResult>,
    attachments: any,
) {
    if (!attachments || !attachments.length) {
        return;
    }
    for (const attachment of attachments) {
        if (attachment.mediaType === 'image/png') {
            if (attachment.testStepId) {
                const cbStepResult = startedCbStepMap.get(attachment.testStepId as string);
                if (cbStepResult) {
                    cbStepResult.screenShot = attachment.body;
                }
            }
        }
        else if (attachment.mediaType === 'application/json;x-origin=cloudbeat') {
            try {
                const event = JSON.parse(attachment.body as string) as CbHelperEvent;
                applyCbEvent(event, cbCaseResult);
            }
            catch {}
        }
    }
}

function applyCbEvent(event: CbHelperEvent, cbCaseResult: CbCaseResult): void {
    switch (event.type) {
        case 'setFailureReason': {
            (cbCaseResult as any).failureReasonId = event.data.reason;
            break;
        }
        case 'addTestAttribute': {
            if (!(cbCaseResult as any).testAttributes) {
                (cbCaseResult as any).testAttributes = {};
            }
            (cbCaseResult as any).testAttributes[event.data.name as string] = event.data.value;
            break;
        }
        case 'addOutputData': {
            if (!(cbCaseResult as any).context) {
                (cbCaseResult as any).context = {};
            }
            if (!(cbCaseResult as any).context.resultData) {
                (cbCaseResult as any).context.resultData = [];
            }
            (cbCaseResult as any).context.resultData.push({ Name: event.data.name, Data: event.data.data });
            break;
        }
        case 'addConsoleLog': {
            if (!(cbCaseResult as any).logs) {
                (cbCaseResult as any).logs = [];
            }
            (cbCaseResult as any).logs.push({
                time: new Date().getTime(),
                level: event.data.type || 'unknown',
                msg: event.data.message,
                src: 'browser',
            });
            break;
        }
        case 'addAttachment': {
            if (!cbCaseResult.attachments) {
                cbCaseResult.attachments = [];
            }
            const isVideo = event.data.name === 'video';
            const filePath = event.data.filePath as string;
            const cbAttachment: Attachment = {
                id: uuidv4(),
                type: isVideo ? AttachmentTypeEnum.Video : AttachmentTypeEnum.Other,
                subType: isVideo ? AttachmentSubTypeEnum.Screencast : AttachmentSubTypeEnum.PlaywrightTrace,
                fileName: path.basename(filePath),
                filePath,
            };
            cbCaseResult.attachments.push(cbAttachment);
            break;
        }
    }
}

export function addPlaywrightStepsAndScreenshotFromAttachments(cbStepResult: CbStepResult, attachments: any) {
    if (!attachments || !attachments.length) {
        return;
    }
    for (const attachment of attachments) {
        if (attachment.mediaType === 'application/json;x-origin=cloudbeat') {
            try {
                const event = JSON.parse(attachment.body as string) as PwEvent;
                let stepName;
                const extra = {};
                if (event.type === 'locator_action' || event.type === 'page_action') {
                    stepName = `${event.method} "${event.selector ?? ''}"`;
                }
                else if (event.type === 'assertion') {
                    stepName = `${event.method.replace('expect.', '')}`;
                    (extra as any).assert = {
                        actual: event.actual,
                        expected: event.expected,
                    };
                }
                else {
                    continue;
                }
                let failure: FailureResult | undefined;
                if (event.error) {
                    failure = getFailureFromException(event.error, 'PLAYWRIGHT_ERROR');
                    if (event.type === 'assertion' && failure) {
                        failure.type = 'ASSERTION_ERROR';
                    }
                }
                cbStepResult.steps?.push({
                    id: generateId(),
                    name: stepName,
                    type: event.type === 'assertion' ? StepTypeEnum.ASSERTION : StepTypeEnum.GENERAL,
                    startTime: event.start,
                    endTime: event.end,
                    duration: event.end - event.start,
                    extra: extra,
                    status: event.success ? ResultStatusEnum.PASSED : ResultStatusEnum.FAILED,
                    failure,
                });
            }
            catch {}
        }
        else if (attachment.mediaType === 'image/png') {
            cbStepResult.screenShot = attachment.body;
        }
    }
}
