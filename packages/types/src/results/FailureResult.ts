export interface FailureResult {
    type: string;
    subtype?: string;
    message?: string;
    line?: number;
    data?: string;
    stacktrace?: string;
    location?: string;
    snippet?: string;
    isFatal?: boolean;
}
