'use client';

import { centsToEuro } from '@/modules/import/utils';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface DataPoint {
    name: string;
    value: number;
    [key: string]: any;
}

export function BudgetChart({ data }: { data: DataPoint[] }) {
    // Filter out zero values
    const chartData = data.filter(d => d.value > 0);

    if (chartData.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-400">Geen data om weer te geven</div>;
    }

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => centsToEuro(value)} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
