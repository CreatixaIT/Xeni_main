'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Filter, MoreVertical, ShieldAlert } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { UserDetailPanel } from './UserDetailPanel';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function UserManagementPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: userData, isLoading, refetch } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => {
      const res = await api.get('/admin/users', {
        params: { page, search, limit: 15 }
      });
      return res.data;
    }
  });

  const users = userData?.data || [];
  const meta = userData?.meta;

  const handleExport = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/export`, '_blank');
    toast.success('Export started');
  };

  const columns = useMemo(() => [
    {
      header: 'User',
      accessorKey: 'full_name',
      cell: (info: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
            {(info.getValue() || info.row.original.email).charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-medium dark:text-white text-gray-900 truncate">{info.getValue() || 'No Name'}</div>
            <div className="text-xs text-slate-600 dark:text-slate-600 dark:text-dark-700 truncate">{info.row.original.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: (info: any) => (
        <span className={`badge ${info.getValue() === 'user' ? 'bg-white/10 text-slate-600 dark:text-dark-600' : 'bg-primary/20 text-primary'} capitalize text-[10px]`}>
          {info.getValue().replace('_', ' ')}
        </span>
      )
    },
    {
      header: 'Plan',
      accessorKey: 'plan_tier',
      cell: (info: any) => {
        const val = info.getValue()?.toLowerCase() || 'none';
        let colors = 'dark:bg-white/10 bg-black/10 text-slate-600 dark:text-dark-600';
        if (val === 'starter') colors = 'bg-cyan-500/20 text-cyan-400';
        if (val === 'professional') colors = 'bg-violet-500/20 text-violet-400';
        if (val === 'premium') colors = 'bg-emerald-500/20 text-emerald-400';
        return <span className={`badge ${colors} capitalize text-[10px] w-20 justify-center`}>{val}</span>;
      }
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info: any) => (
        <span className={info.getValue() === 'active' ? 'badge-success' : 'badge-danger'}>{info.getValue()}</span>
      )
    },
    {
      header: 'Joined',
      accessorKey: 'created_at',
      cell: (info: any) => new Date(info.getValue()).toLocaleDateString()
    },
    {
      header: 'Spend (Total)',
      accessorKey: 'total_spent',
      cell: (info: any) => <div className="font-mono text-xs dark:text-white text-gray-900">৳{(info.getValue() || 0).toLocaleString()}</div>
    },
    {
      header: '',
      id: 'actions',
      cell: (info: any) => (
        <div className="flex justify-end">
          <button 
            onClick={() => setSelectedUserId(info.row.original.id)}
            className="p-2 hover:dark:bg-white/10 hover:bg-black/10 rounded-lg text-slate-600 dark:text-slate-600 dark:text-dark-700 hover:dark:text-white hover:text-gray-900 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], []);

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto pb-24 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-heading font-bold dark:text-white text-gray-900 mb-2">User Management</h1>
        <p className="text-slate-600 dark:text-slate-600 dark:text-dark-700">Manage platform users, roles, and view detailed agent usage.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-black/20 p-4 rounded-2xl border dark:border-white/5 border-black/5">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-600 dark:text-dark-700" />
          <input 
            type="text" 
            placeholder="Search users by name or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark border dark:border-white/10 border-black/10 rounded-xl pl-10 pr-4 py-2.5 text-sm dark:text-white text-gray-900 placeholder-[var(--text-muted)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button onClick={handleExport} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2 border-primary/30 text-primary-300 hover:text-primary hover:border-primary">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DataTable 
          columns={columns} 
          data={users} 
          pageCount={meta?.total_pages || 1}
          pageSize={15}
          isLoading={isLoading}
        />
      </div>

      <UserDetailPanel 
        userId={selectedUserId} 
        onClose={() => {
          setSelectedUserId(null);
          refetch();
        }} 
      />
    </div>
  );
}

