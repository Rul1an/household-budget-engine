export type ActionError = {
    code: string;
    message: string;
    details?: any;
};

export type ActionResponse<T = any> =
    | { success: true; data: T; message?: string }
    | { success: false; error: ActionError };

export function successResponse<T>(data: T, message?: string): ActionResponse<T> {
    return { success: true, data, message };
}

export function errorResponse(code: string, message: string, details?: any): ActionResponse {
    return {
        success: false,
        error: { code, message, details }
    };
}
