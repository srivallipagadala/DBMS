import { useEffect, useState } from 'react';
import { AlertTriangle, Bus, CheckCircle, Clock3, MapPin, Send, Users } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

function formatTime(value) {
  return value ? String(value).slice(0, 5) : 'Time not set';
}

function statusClass(status) {
  if (status === 'Completed') return 'success';
  if (status === 'Delayed' || status === 'Cancelled') return 'warning';
  if (status === 'Departed') return 'neutral';
  return 'success';
}

function nextStatuses(status) {
  if (status === 'Scheduled') return ['Departed', 'Delayed'];
  if (status === 'Delayed') return ['Departed'];
  if (status === 'Departed') return ['Completed'];
  return [];
}

export default function DriverPortal() {
  const [buses, setBuses] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportForm, setReportForm] = useState({
    bus_id: '',
    category: 'Bus damage',
    severity: 'Medium',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [updatingSchedule, setUpdatingSchedule] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPortal = async () => {
    setError('');
    try {
      const [assignedBuses, driverReports] = await Promise.all([
        apiRequest('/api/driver/portal'),
        apiRequest('/api/driver/reports'),
      ]);
      setBuses(assignedBuses);
      setReports(driverReports);
      setReportForm(current => ({
        ...current,
        bus_id: assignedBuses.some(bus => String(bus.bus_id) === current.bus_id)
          ? current.bus_id
          : String(assignedBuses[0]?.bus_id || ''),
      }));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest('/api/driver/portal'),
      apiRequest('/api/driver/reports'),
    ])
      .then(([assignedBuses, driverReports]) => {
        if (!active) return;
        setBuses(assignedBuses);
        setReports(driverReports);
        setReportForm(current => ({
          ...current,
          bus_id: String(assignedBuses[0]?.bus_id || ''),
        }));
      })
      .catch(requestError => { if (active) setError(toErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshReports = async () => {
      try {
        const driverReports = await apiRequest('/api/driver/reports');
        if (active) {
          setReports(driverReports);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(`Could not refresh report updates: ${toErrorMessage(requestError)}`);
      }
    };
    const intervalId = window.setInterval(refreshReports, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const updateStatus = async (schedule, status) => {
    setUpdatingSchedule(schedule.schedule_id);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest(`/api/driver/schedules/${schedule.schedule_id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setMessage(result.message);
      await loadPortal();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setUpdatingSchedule(null);
    }
  };

  const submitReport = async event => {
    event.preventDefault();
    setSubmittingReport(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/api/driver/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...reportForm,
          bus_id: Number(reportForm.bus_id),
        }),
      });
      setMessage(result.message);
      setReportForm(current => ({ ...current, description: '' }));
      await loadPortal();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setSubmittingReport(false);
    }
  };

  const tripCount = buses.reduce((count, bus) => count + bus.schedules.length, 0);

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Driver portal</h1>
          <p>View only your assigned buses, trips, route stops, and confirmed passengers.</p>
        </div>
        <span className="badge neutral"><Bus size={14} /> {buses.length} assigned buses</span>
      </div>

      {message && <p className="message" role="status">{message}</p>}
      {error && <p className="message error" role="alert"><AlertTriangle size={14} /> {error}</p>}
      {loading && <div className="empty-state">Loading your assignments…</div>}
      {!loading && !error && buses.length === 0 && (
        <div className="empty-state">No buses are assigned to your driver account. Please contact the administrator.</div>
      )}
      {!loading && buses.length > 0 && (
        <section className="card-box">
          <div className="panel-heading">
            <div>
              <h2><AlertTriangle size={18} /> Report a bus issue</h2>
              <p>Report damage, mechanical faults, or safety concerns to the administrator.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={submitReport}>
            <label className="field">Assigned bus
              <select required value={reportForm.bus_id}
                onChange={event => setReportForm({ ...reportForm, bus_id: event.target.value })}>
                {buses.map(bus => <option key={bus.bus_id} value={bus.bus_id}>{bus.bus_number}</option>)}
              </select>
            </label>
            <label className="field">Issue type
              <select value={reportForm.category}
                onChange={event => setReportForm({ ...reportForm, category: event.target.value })}>
                <option>Bus damage</option>
                <option>Mechanical issue</option>
                <option>Safety concern</option>
                <option>Other</option>
              </select>
            </label>
            <label className="field">Severity
              <select value={reportForm.severity}
                onChange={event => setReportForm({ ...reportForm, severity: event.target.value })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>Issue details
              <textarea required maxLength={2000} value={reportForm.description}
                placeholder="Describe the damage or issue and where it occurred."
                onChange={event => setReportForm({ ...reportForm, description: event.target.value })} />
            </label>
            <button type="submit" className="btn-primary" disabled={submittingReport || !reportForm.bus_id}>
              <Send size={15} /> {submittingReport ? 'Submitting…' : 'Submit report'}
            </button>
          </form>
        </section>
      )}

      {!loading && reports.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div><h2>My bus reports</h2><p>Updates to your submitted reports are visible here.</p></div>
            <span className="badge neutral">{reports.length} reports</span>
          </div>
          <div className="driver-report-list">
            {reports.map(report => (
              <article className="driver-report-card" key={report.report_id}>
                <div className="driver-report-heading">
                  <div>
                    <strong>{report.bus_number} · {report.category}</strong>
                    <p>{new Date(report.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`badge ${report.status === 'Completed' ? 'success' : report.severity === 'High' ? 'danger' : 'warning'}`}>
                    {report.severity} · {report.status}
                  </span>
                </div>
                <p>{report.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && buses.length > 0 && tripCount === 0 && (
        <div className="empty-state">Your assigned bus has no schedules yet. Please contact the administrator.</div>
      )}

      {!loading && buses.map(bus => (
        <section className="panel driver-bus-panel" key={bus.bus_id}>
          <div className="panel-heading">
            <div>
              <h2><Bus size={19} /> {bus.bus_number}</h2>
              <p>{bus.capacity} seats · Bus status: {bus.current_status}</p>
            </div>
            <span className="badge neutral">{bus.schedules.length} {bus.schedules.length === 1 ? 'trip' : 'trips'}</span>
          </div>

          {bus.schedules.map(schedule => (
            <article className="driver-trip" key={schedule.schedule_id}>
              <div className="driver-trip-heading">
                <div>
                  <h3>{schedule.route_name}</h3>
                  <p>{schedule.start_location} → {schedule.destination}</p>
                  <p className="driver-trip-time"><Clock3 size={14} /> {formatTime(schedule.departure_time)}–{formatTime(schedule.arrival_time)}</p>
                </div>
                <span className={`badge ${statusClass(schedule.status)}`}>{schedule.status}</span>
              </div>

              <div className="driver-trip-columns">
                <div>
                  <h4><MapPin size={15} /> Route stops</h4>
                  {schedule.stops.length > 0 ? (
                    <ol className="route-stops">
                      {schedule.stops.map(stop => (
                        <li key={stop.stop_id}>{stop.stop_name}<small>Estimated: {formatTime(stop.estimated_time)}</small></li>
                      ))}
                    </ol>
                  ) : <p className="card-meta">No stops have been added to this route.</p>}
                </div>
                <div>
                  <h4><Users size={15} /> Confirmed passengers <span className="badge neutral">{schedule.passengers.length}</span></h4>
                  {schedule.passengers.length > 0 ? (
                    <ul className="passenger-list">
                      {schedule.passengers.map((passenger, index) => (
                        <li key={`${schedule.schedule_id}-${index}`}>{passenger.student_name}</li>
                      ))}
                    </ul>
                  ) : <p className="card-meta">No confirmed passengers for this trip.</p>}
                </div>
              </div>

              {nextStatuses(schedule.status).length > 0 && (
                <div className="driver-status-actions" aria-label="Update trip status">
                  {nextStatuses(schedule.status).map(status => (
                    <button
                      className={status === 'Delayed' ? 'btn-secondary' : 'btn-primary'}
                      disabled={updatingSchedule === schedule.schedule_id}
                      key={status}
                      onClick={() => updateStatus(schedule, status)}
                      type="button"
                    >
                      {status === 'Completed' ? <CheckCircle size={15} /> : status === 'Delayed' ? <AlertTriangle size={15} /> : <Bus size={15} />}
                      {updatingSchedule === schedule.schedule_id ? 'Updating…' : `Mark ${status.toLowerCase()}`}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
