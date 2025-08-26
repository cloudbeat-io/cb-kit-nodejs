import fs from 'fs';
import path from 'path';
import {
    CaseResult as CbCaseResult,
    StepResult as CbStepResult,
    TestResult as CbTestResult,
    FailureResult,
    ResultStatusEnum,
    StepTypeEnum,
} from '@cloudbeat/types';
import { v4 as uuidv4 } from 'uuid';

const CB_TEST_RESULT_FILE_NAME = '.CB_TEST_RESULTS.json';

export function generateResultFile(result: CbTestResult, filePath: string) {
    console.log('ℹ️ generateResultFile - start');
    const fileContent = JSON.stringify(result, null, 4);
    fs.writeFileSync(filePath, fileContent);
    console.log('ℹ️ generateResultFile - finished');
}

export function getResultFilePath(outputDir?: string) {
    let resultFileDir;
    if (outputDir) {
        if (!path.isAbsolute(outputDir)) {
            outputDir = path.join(process.cwd(), outputDir);
        }
        // Ensure output directory exists
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
            // TODO: handle test case level attachments
            /* else if (attachment.testCaseStartedId === cukeTestCaseId) {
            } */
        }
    }
}

export function addPlaywrightStepsAndScreenshotFromAttachments(cbStepResult: CbStepResult, attachments: any) {
    if (!attachments || !attachments.length) {
        return;
    }
    for (const attachment of attachments) {
        // Playwright event JSON
        if (attachment.mediaType === 'application/json;x-origin=cloudbeat') {
            try {
                const event = JSON.parse(attachment.body as string);
                let stepName;
                const extra = {};
                if (event.type === 'locator_action' || event.type === 'page_action') {
                    stepName = `${event.method} "${event.selector}"`;
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
                // eslint-disable-next-line no-undef-init
                let failure: FailureResult | undefined = undefined;
                if (event.error) {
                    failure = getFailureFromException(event.error, 'PLAYWRIGHT_ERROR');
                    if (event.type === 'assertion' && failure) {
                        failure.type = 'ASSERTION_ERROR';
                    }
                    /* failure = {
                        type: event.type === 'assertion' ? 'ASSERTION_ERROR' : 'PLAYWRIGHT_ERROR',
                        subtype: event.error.type,
                        message: event.error.message,
                        stacktrace: event.error.stack,
                    }; */
                }
                cbStepResult.steps?.push({
                    id: generateId(),
                    name: stepName,
                    type: event.type === 'assertion' ? StepTypeEnum.ASSERTION : StepTypeEnum.GENERAL,
                    startTime: event.start as number,
                    endTime: event.end as number,
                    duration: event.end - event.start,
                    extra: extra,
                    status: event.success ? ResultStatusEnum.PASSED : ResultStatusEnum.FAILED,
                    failure,
                });
            }
            catch {}
        }
        // Screenshot
        else if (attachment.mediaType === 'image/png') {
            cbStepResult.screenShot = attachment.body;
        }
    }
}
