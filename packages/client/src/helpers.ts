// import * as moment from 'moment';
import { default as moment, Moment } from 'moment';

export function convertStringDateToEpoch(stringDate?: string): number | undefined {
    if (!stringDate) {
        return undefined;
    }
    return moment(stringDate).valueOf();
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
