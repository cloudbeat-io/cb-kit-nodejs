import { FailureReasonEnum } from '@cloudbeat/types';
import { IWorld } from '@cucumber/cucumber';
import { ConsoleMessage } from 'playwright';

const CB_MEDIA_TYPE = 'application/json;x-origin=cloudbeat';

/**
 * usage example:
 *
 *   import { cb } from '@cloudbeat/cucumber';
 *
 *   Before(function(this: CbWorld) { cb.setWorld(this); });
 *
 *   cb.setFailureReason(FailureReasonEnum.RealDefect);
 *   cb.addTestAttribute('attributeName', 'attributeVal');
 *   cb.addOutputData('foo', 'bar');
 *   page.on('console', cb.onConsole);
 */
export class cb {
    private static world: IWorld | null = null;

    public static setWorld(w: IWorld): void {
        cb.world = w;
    }

    public static setFailureReason(reason: FailureReasonEnum): void {
        cb.send('setFailureReason', { reason });
    }

    public static addTestAttribute(name: string, value: any): void {
        cb.send('addTestAttribute', { name, value });
    }

    public static addOutputData(name: string, data: any): void {
        cb.send('addOutputData', { name, data });
    }

    public static onConsole(message: ConsoleMessage): void {
        cb.send('addConsoleLog', { type: message.type(), message: message.text() });
    }

    public static addAttachment(name: 'video' | 'trace', filePath: string): void {
        cb.send('addAttachment', { name, filePath });
    }

    private static send(type: string, data: object): void {
        if (!cb.world) {
            console.warn(`[CB] cb.${type} called before cb.setWorld() — call cb.setWorld(this) in a Before hook`);
            return;
        }
        cb.world.attach(JSON.stringify({ type, data }), CB_MEDIA_TYPE);
    }
}
