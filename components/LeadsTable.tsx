
import React from 'react';
import { SEOAudit, OpportunityLevel } from '../types';

interface Props {
  leads: SEOAudit[];
  groundingSources?: any[];
}

const LeadsTable: React.FC<Props> = ({ leads, groundingSources }) => {
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
      "Opportunity Level"
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
      lead.opportunityLevel
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
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Opp.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead, idx) => (
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
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                    lead.opportunityLevel === OpportunityLevel.HIGH ? 'bg-orange-600 text-white' :
                    lead.opportunityLevel === OpportunityLevel.MEDIUM ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {lead.opportunityLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {groundingSources && groundingSources.length > 0 && (
        <div className="px-6 py-6 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Verification Sources (Google Search)</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {groundingSources.map((source, i) => (
              source.web && (
                <a 
                  key={i} 
                  href={source.web.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 transition-all hover:shadow-md active:scale-95"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {source.web.title || source.web.uri}
                </a>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsTable;
