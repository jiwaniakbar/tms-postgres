'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardHistoryFilter({
  historyDays
}: {
  historyDays: number
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('historyDays', val);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
      <span>Show last</span>
      <select
        value={historyDays}
        onChange={handleChange}
        style={{
          padding: '2px 8px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          cursor: 'pointer'
        }}
      >
        <option value="1">1 day</option>
        <option value="3">3 days</option>
        <option value="7">7 days</option>
        <option value="15">15 days</option>
        <option value="30">30 days</option>
        <option value="-1">All time</option>
      </select>
    </div>
  );
}
