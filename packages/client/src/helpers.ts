import * as moment from 'moment';

export function convertStringDateToEpoch(stringDate?: string): number | undefined {
    if (!stringDate) {
        return undefined;
    }
    return moment(stringDate).valueOf();
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
