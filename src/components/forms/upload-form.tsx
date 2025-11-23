'use client';

import { uploadCsvAction } from '@/app/actions/import-transactions';
import { type ActionResponse } from '@/lib/error-handling';
import { useActionState } from 'react';

const initialState: ActionResponse = { success: false, error: { code: 'INITIAL', message: '' } };

export function UploadForm({ householdId }: { householdId: string }) {
    const [state, formAction, isPending] = useActionState(async (prevState: ActionResponse, formData: FormData) => {
        // Append householdId to formData
        formData.append('householdId', householdId);
        const result = await uploadCsvAction(formData);
        return result;
    }, initialState);

    return (
        <form action={formAction} className="space-y-4 p-4 border rounded-lg bg-white shadow-sm">
            <div>
                <label htmlFor="file" className="block text-sm font-medium text-gray-700">
                    Bank Export (CSV/PDF)
                </label>
                <input
                    type="file"
                    name="file"
                    id="file"
                    accept=".csv,.pdf"
                    className="mt-1 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
                />
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
                {isPending ? 'Bezig met verwerken...' : 'Upload Transacties'}
            </button>

            {/* Success Message */}
            {state.success && state.message && (
                <div className="p-2 rounded bg-green-50 text-green-800">
                    <p>{state.message}</p>
                    {state.data?.errors && state.data.errors.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs font-semibold">Waarschuwingen:</p>
                            <ul className="list-disc list-inside text-xs mt-1">
                                {state.data.errors.slice(0, 5).map((e: string, i: number) => (
                                    <li key={i}>{e}</li>
                                ))}
                                {state.data.errors.length > 5 && <li>...en nog {state.data.errors.length - 5} waarschuwingen</li>}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {!state.success && state.error && state.error.message && (
                <div className="p-2 rounded bg-red-50 text-red-800">
                    <p className="font-medium">{state.error.message}</p>
                    {state.error.details?.errors && (
                        <ul className="list-disc list-inside text-xs mt-1">
                            {state.error.details.errors.slice(0, 5).map((e: string, i: number) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </form>
    );
}
