import { FailureReasonEnum } from '@cloudbeat/types';
import { ConsoleMessage } from '@playwright/test';

export class cb {
    public static setFailureReason(reason: FailureReasonEnum) {
        sendToReporter('setFailureReason', { reason });
    }

    public static addTestAttribute(name: string, value: any) {
        sendToReporter('addTestAttribute', { name, value });
    }

    public static addOutputData(name: string, data: any) {
        sendToReporter('addOutputData', { name, data });
    }

    public static onConsole(message: ConsoleMessage) {
        sendToReporter('addConsoleLog', { type: message.type(), message: message.text() });
    }
}

const sendToReporter = (type: string, data: any ): void => {
    // the reporter consumes these messages only when the test is executed by CloudBeat,
    // otherwise they would just pollute the output of local and CI runs
    if (!process.env.CB_RUN_ID) {
        return;
    }
    process.stdout.write(JSON.stringify({ type, data }));
};
