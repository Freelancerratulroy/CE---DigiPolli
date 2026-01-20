
import React from 'react';
import { SEOAudit } from '../types';

interface Props {
  leads: SEOAudit[];
}

const LeadsTable: React.FC<Props> = ({ leads }) => {
  if (leads.length === 0) return null;

  const downloadCSV = () => {
    // Exact headers required for one-click import
    const headers = [
      "Website URL",
      "Business Name",
      "Email",
      "Phone",
      "Contact Page URL",
      "On-Page SEO Issues",
      "Technical SEO Issues",
      "Local SEO Issues",
      "Qualification Score"
    ];

    const rows = leads.map(lead => [
      lead.websiteUrl,
      lead.businessName,
      lead.email,
      lead.phone,
      lead.contactPageUrl,
      lead.onPageIssues.join('; '),
      lead.technicalIssues.join('; '),
      `${lead.localSeoIssues.hasIssues ? 'Yes' : 'No'} - ${lead.localSeoIssues.reason}`,
      lead.qualificationScore
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(value => `"${(value || 'Not Found').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Client_Engine_Leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPriorityInfo = (score: number) => {
    if (score >= 80) return { label: 'CRITICAL', color: 'bg-red-600 text-white' };
    if (score >= 60) return { label: 'HIGH', color: 'bg-orange-500 text-white' };
    if (score >= 40) return { label: 'MEDIUM', color: 'bg-amber-100 text-amber-700' };
    return { label: 'LOW', color: 'bg-slate-100 text-slate-600' };
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-slate-800 tracking-tight">Client Engine Intelligence Dashboard</h3>
        <button 
          onClick={downloadCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV (Excel)
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Business / URL</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">On-Page Issues</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Technical Issues</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Local SEO</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Score / Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead, idx) => {
              const priority = getPriorityInfo(lead.qualificationScore);
              return (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 text-sm mb-0.5">{lead.businessName}</div>
                    <div className="text-xs text-blue-600 truncate max-w-[150px]">{lead.websiteUrl}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-600 font-medium">{lead.email}</div>
                    <div className="text-[10px] text-slate-400">{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <ul className="space-y-0.5">
                      {lead.onPageIssues.slice(0, 2).map((issue, i) => (
                        <li key={i} className="text-[10px] text-slate-600 truncate max-w-[120px]">• {issue}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4">
                     <ul className="space-y-0.5">
                      {lead.technicalIssues.slice(0, 2).map((issue, i) => (
                        <li key={i} className="text-[10px] text-slate-600 truncate max-w-[120px]">• {issue}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-[9px] px-1.5 py-0.5 rounded inline-block font-bold uppercase ${lead.localSeoIssues.hasIssues ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {lead.localSeoIssues.hasIssues ? 'Issues' : 'Clean'}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 truncate max-w-[100px]">{lead.localSeoIssues.reason}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs font-black text-slate-900">{lead.qualificationScore}</div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-[4px] tracking-widest ${priority.color}`}>
                        {priority.label}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadsTable;
