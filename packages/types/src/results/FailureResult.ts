export interface FailureResult {
    type: string;
    subtype?: string;
    message?: string;
    line?: number;
    data?: string;
    isFatal?: boolean;
}
