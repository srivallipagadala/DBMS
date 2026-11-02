import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

function statusClass(status) {
  return status === 'Completed' ? 'success' : 'warning';
}

export default function BusReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadReports = async () => {
    setError('');
    try {
      setReports(await apiRequest('/api/admin/bus-reports'));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await apiRequest('/api/admin/bus-reports');
        if (active) {
          setReports(data);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(toErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };
    refresh();
    const intervalId = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const updateStatus = async (report, status) => {
    setUpdatingId(report.report_id);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest(`/api/admin/bus-reports/${report.report_id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setMessage(result.message);
      await loadReports();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setUpdatingId(null);
    }
  };

  const openCount = reports.filter(report => report.status === 'Still Due').length;

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Bus issue reports</h1>
          <p>Review and track damage, mechanical, and safety reports submitted by drivers.</p>
        </div>
        <span className={`badge ${openCount ? 'warning' : 'success'}`}>
          <ClipboardList size={14} /> {openCount} still due
        </span>
      </div>

      {message && <p className="message" role="status">{message}</p>}
      {error && <p className="message error" role="alert"><AlertTriangle size={14} /> {error}</p>}
      {loading && <div className="empty-state">Loading bus reports…</div>}
      {!loading && !error && reports.length === 0 && (
        <div className="empty-state">No bus issue reports have been submitted.</div>
      )}
      {!loading && reports.length > 0 && (
        <section className="bus-report-list">
          {reports.map(report => (
            <article className="panel bus-report-card" key={report.report_id}>
              <div className="driver-report-heading">
                <div>
                  <h2>{report.bus_number} · {report.category}</h2>
                  <p>Reported by {report.driver_name} · {new Date(report.created_at).toLocaleString()}</p>
                </div>
                <div className="bus-report-badges">
                  <span className={`badge ${report.severity === 'High' ? 'danger' : 'warning'}`}>{report.severity} severity</span>
                  <span className={`badge ${statusClass(report.status)}`}>{report.status}</span>
                </div>
              </div>
              <p className="bus-report-description">{report.description}</p>
              <div className="driver-status-actions">
                <button className={report.status === 'Still Due' ? 'btn-primary' : 'btn-secondary'}
                  type="button" disabled={updatingId === report.report_id || report.status === 'Still Due'}
                  onClick={() => updateStatus(report, 'Still Due')}>
                  {updatingId === report.report_id ? 'Updating…' : report.status === 'Still Due' ? 'Still due' : 'Mark still due'}
                </button>
                <button className={report.status === 'Completed' ? 'btn-primary' : 'btn-secondary'}
                  type="button" disabled={updatingId === report.report_id || report.status === 'Completed'}
                  onClick={() => updateStatus(report, 'Completed')}>
                  <CheckCircle size={15} />
                  {updatingId === report.report_id ? 'Updating…' : report.status === 'Completed' ? 'Completed' : 'Mark completed'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
