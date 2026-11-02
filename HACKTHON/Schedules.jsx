import { useEffect, useState } from 'react';
import { CalendarClock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

const initialForm = { bus_id: '', route_id: '', departure_time: '', arrival_time: '', status: 'Scheduled' };

function formatTime(value) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}

function shiftLabel(value) {
  const hour = Number(String(value || '').slice(0, 2));
  if (!Number.isFinite(hour)) return 'Scheduled trip';
  return hour < 12 ? 'Morning Pickup' : 'Evening Drop';
}

export default function Schedules({ isAdmin }) {
  const [schedules, setSchedules] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest('/api/schedules'),
      apiRequest('/api/buses'),
      apiRequest('/api/routes'),
    ])
      .then(([scheduleData, busData, routeData]) => {
        if (!active) return;
        setSchedules(scheduleData);
        setBuses(busData);
        setRoutes(routeData);
      })
      .catch(requestError => { if (active) setError(toErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleAddSchedule = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiRequest(editingId ? `/api/schedules/${editingId}` : '/api/schedules', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setForm(initialForm);
      setEditingId(null);
      setMessage(editingId ? 'Schedule updated successfully.' : 'Schedule added and bus assigned to route.');
      setSchedules(await apiRequest('/api/schedules'));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule.schedule_id);
    setForm({
      bus_id: String(schedule.bus_id),
      route_id: String(schedule.route_id),
      departure_time: formatTime(schedule.departure_time),
      arrival_time: formatTime(schedule.arrival_time),
      status: schedule.status || 'Scheduled',
    });
    setError('');
    setMessage('');
  };

  const handleDelete = async (schedule) => {
    if (!window.confirm(`Remove the ${schedule.bus_number} schedule for ${schedule.route_name}? If any bookings exist, the trip will be cancelled and booking history preserved.`)) return;
    setError('');
    setMessage('');
    try {
      const result = await apiRequest(`/api/schedules/${schedule.schedule_id}`, { method: 'DELETE' });
      setMessage(result.message || 'Schedule removed successfully.');
      setSchedules(await apiRequest('/api/schedules'));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Pickup and drop schedules</h1>
          <p>Set bus routes and review departure, arrival, and available seats.</p>
        </div>
        <span className="badge neutral"><CalendarClock size={14} /> {schedules.length} trips</span>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}

      {isAdmin && (
        <section className="card-box">
          <div className="panel-heading">
            <div><h2>{editingId ? 'Update schedule' : 'Assign a bus to a route'}</h2><p>A new schedule starts with the bus's full seat capacity.</p></div>
          </div>
          <form className="form-grid" onSubmit={handleAddSchedule}>
            <label className="field">Bus
              <select required value={form.bus_id} onChange={event => setForm({ ...form, bus_id: event.target.value })}>
                <option value="">Select a bus</option>
                {buses.map(bus => <option key={bus.bus_id} value={bus.bus_id}>{bus.bus_number} · {bus.capacity} seats</option>)}
              </select>
            </label>
            <label className="field">Route
              <select required value={form.route_id} onChange={event => setForm({ ...form, route_id: event.target.value })}>
                <option value="">Select a route</option>
                {routes.map(route => <option key={route.route_id} value={route.route_id}>{route.route_name}</option>)}
              </select>
            </label>
            <label className="field">Departure time
              <input required type="time" value={form.departure_time}
                onChange={event => setForm({ ...form, departure_time: event.target.value })} />
            </label>
            <label className="field">Expected arrival
              <input required type="time" value={form.arrival_time}
                onChange={event => setForm({ ...form, arrival_time: event.target.value })} />
            </label>
            {editingId && <label className="field">Status
              <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
                <option>Scheduled</option><option>Departed</option><option>Delayed</option><option>Completed</option><option>Cancelled</option>
              </select>
            </label>}
            <button type="submit" className="btn-primary">{editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? 'Save changes' : 'Add schedule'}</button>
            {editingId && <button type="button" className="btn-secondary" onClick={cancelEdit}><X size={15} /> Cancel</button>}
          </form>
          {message && <p className="message" role="status">{message}</p>}
        </section>
      )}

      <section className="card-box">
        {loading && <div className="empty-state">Loading schedules…</div>}
        {!loading && !error && schedules.length === 0 && <div className="empty-state">No bus schedules are available.</div>}
        {!loading && schedules.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Shift</th><th>Bus</th><th>Route</th><th>Departure</th><th>Expected arrival</th><th>Seats available</th><th>Status</th>{isAdmin && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {schedules.map(schedule => {
                  const available = Number(schedule.available_seats || 0);
                  const capacity = Number(schedule.capacity || 0);
                  const status = schedule.status === 'Cancelled'
                    ? 'Cancelled'
                    : schedule.status === 'Delayed'
                      ? 'Delayed'
                      : ['Departed', 'Completed'].includes(schedule.status)
                        ? schedule.status
                    : schedule.bus_status === 'Maintenance'
                      ? 'Maintenance'
                      : available === 0
                        ? 'Full'
                        : (schedule.status || 'Available');
                  const statusClass = status === 'Full'
                    ? 'danger'
                    : ['Cancelled', 'Maintenance', 'Delayed'].includes(status)
                      ? 'warning'
                      : 'success';
                  return (
                    <tr key={schedule.schedule_id}>
                      <td><span className={`badge ${shiftLabel(schedule.departure_time) === 'Morning Pickup' ? 'warning' : 'neutral'}`}>{shiftLabel(schedule.departure_time)}</span></td>
                      <td><strong>{schedule.bus_number}</strong></td>
                      <td>{schedule.route_name}</td>
                      <td>{formatTime(schedule.departure_time)}</td>
                      <td>{formatTime(schedule.arrival_time)}</td>
                      <td>{available} / {capacity}</td>
                      <td><span className={`badge ${statusClass}`}>{status}</span></td>
                      {isAdmin && <td><div className="row-actions">
                        <button className="icon-button" type="button" aria-label="Edit schedule" onClick={() => handleEdit(schedule)}><Pencil size={15} /></button>
                        <button className="icon-button danger-action" type="button" aria-label="Delete schedule" onClick={() => handleDelete(schedule)}><Trash2 size={15} /></button>
                      </div></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!error && <p className="card-meta" style={{ marginTop: 13 }}>Operating days are not stored in the current database schema.</p>}
      </section>
    </main>
  );
}
