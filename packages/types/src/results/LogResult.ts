import { LogLevelEnum } from './LogLevelEnum';

export interface LogResult {
    time: number;
    level: LogLevelEnum;
    msg: string;
    src: string;
}
