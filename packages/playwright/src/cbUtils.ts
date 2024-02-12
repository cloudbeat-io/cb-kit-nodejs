import { FailureReasonEnum } from '@cloudbeat/types';

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
}

const sendToReporter = (type: string, data: any ): void => {
    process.stdout.write(JSON.stringify({ type, data }));
};
