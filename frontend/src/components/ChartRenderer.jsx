import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ChartRenderer({ spec, data, compact = false }) {
  if (!data || data.length === 0) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      No data available
    </div>
  );

  const renderChart = () => {
    const type = spec.chart_type?.toLowerCase();
    
    if (type === 'bar') {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={spec.x_key} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
            itemStyle={{ color: '#fff' }}
          />
          <Bar dataKey={spec.y_key} fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }

    if (type === 'line') {
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={spec.x_key} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
          />
          <Line type="monotone" dataKey={spec.y_key} stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent)' }} activeDot={{ r: 8 }} />
        </LineChart>
      );
    }

    if (type === 'pie') {
      return (
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={compact ? 40 : 60}
            outerRadius={compact ? 70 : 100}
            paddingAngle={5}
            dataKey={spec.y_key}
            nameKey={spec.x_key}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
          {!compact && <Legend />}
        </PieChart>
      );
    }

    if (type === 'scatter') {
      return (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={spec.x_key} stroke="var(--text-muted)" fontSize={12} name={spec.x_key} />
          <YAxis dataKey={spec.y_key} stroke="var(--text-muted)" fontSize={12} name={spec.y_key} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name={spec.title} data={data} fill="var(--accent)" />
        </ScatterChart>
      );
    }

    return <div>Unsupported chart type: {type}</div>;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderChart()}
    </ResponsiveContainer>
  );
}
