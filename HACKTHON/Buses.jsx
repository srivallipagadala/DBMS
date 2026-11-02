import { useEffect, useMemo, useState } from 'react';
import { Bus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

const initialForm = { bus_number: '', capacity: '', current_status: 'On Time', driver_id: '' };

function statusClass(status) {
  if (status === 'On Time') return 'success';
  if (status === 'Delayed' || status === 'Maintenance') return 'warning';
  if (status === 'Full') return 'danger';
  return 'neutral';
}

export default function Buses() {
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const [busData, driverData] = await Promise.all([
        apiRequest('/api/buses'),
        apiRequest('/api/drivers'),
      ]);
      setBuses(busData);
      setDrivers(driverData);
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest('/api/buses'), apiRequest('/api/drivers')])
      .then(([busData, driverData]) => {
        if (!active) return;
        setBuses(busData);
        setDrivers(driverData);
      })
      .catch(requestError => {
        if (active) setError(toErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const routes = [...new Set(buses.map(bus => bus.route_name).filter(Boolean))];
  const filteredBuses = useMemo(() => buses.filter((bus) => {
    const query = search.toLowerCase();
    const matchesSearch = [bus.bus_number, bus.route_name, bus.driver_name]
      .some(value => String(value || '').toLowerCase().includes(query));
    return matchesSearch &&
      (routeFilter === 'All' || bus.route_name === routeFilter) &&
      (statusFilter === 'All' || (bus.fleet_status || bus.current_status) === statusFilter);
  }), [buses, search, routeFilter, statusFilter]);

  const handleAddBus = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiRequest(editingId ? `/api/buses/${editingId}` : '/api/buses', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          capacity: Number(form.capacity),
          driver_id: form.driver_id || null,
        }),
      });
      setMessage(editingId ? 'Bus updated successfully.' : 'Bus added successfully.');
      setForm(initialForm);
      setEditingId(null);
      await loadData();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const handleEdit = (bus) => {
    setEditingId(bus.bus_id);
    setForm({
      bus_number: bus.bus_number,
      capacity: String(bus.capacity),
      current_status: bus.current_status,
      driver_id: bus.driver_id ? String(bus.driver_id) : '',
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (bus) => {
    if (!window.confirm(`Remove ${bus.bus_number}? If bookings exist, the bus will be retained in maintenance and its trips cancelled to preserve student booking history.`)) return;
    setError('');
    setMessage('');
    try {
      const result = await apiRequest(`/api/buses/${bus.bus_id}`, { method: 'DELETE' });
      setMessage(result.message || 'Bus removed successfully.');
      await loadData();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setMessage('');
  };

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Bus fleet management</h1>
          <p>Add vehicles, review capacity, and monitor their latest status.</p>
        </div>
        <span className="badge neutral"><Bus size={14} /> {buses.length} registered</span>
      </div>

      <section className="card-box">
        <div className="panel-heading">
        <div><h2>{editingId ? 'Update bus' : 'Add a bus'}</h2><p>Bus records are managed by the administrator.</p></div>
        </div>
        <form className="form-grid" onSubmit={handleAddBus}>
          <label className="field">
            Bus number
            <input required value={form.bus_number} placeholder="e.g. CB-205"
              onChange={event => setForm({ ...form, bus_number: event.target.value })} />
          </label>
          <label className="field">
            Seat capacity
            <input required min="1" type="number" value={form.capacity} placeholder="50"
              onChange={event => setForm({ ...form, capacity: event.target.value })} />
          </label>
          <label className="field">
            Assign driver
            <select value={form.driver_id} onChange={event => setForm({ ...form, driver_id: event.target.value })}>
              <option value="">Unassigned</option>
              {drivers.map(driver => <option key={driver.driver_id} value={driver.driver_id}>{driver.name}</option>)}
            </select>
          </label>
          <label className="field">
            Status
            <select value={form.current_status} onChange={event => setForm({ ...form, current_status: event.target.value })}>
              <option>On Time</option><option>In Transit</option><option>Delayed</option><option>Maintenance</option>
            </select>
          </label>
          <button className="btn-primary" type="submit">{editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? 'Save changes' : 'Add bus'}</button>
          {editingId && <button className="btn-secondary" type="button" onClick={cancelEdit}><X size={15} /> Cancel</button>}
        </form>
        {message && <p className="message" role="status">{message}</p>}
        {error && <p className="message error" role="alert">{error}</p>}
      </section>

      <section className="card-box">
        <div className="panel-heading">
          <div><h2>Fleet vehicles</h2><p>Search by bus number, assigned route, or driver.</p></div>
        </div>
        <div className="filter-bar">
          <label className="search-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} />
            <input aria-label="Search buses" value={search} placeholder="Search bus, route, or driver"
              onChange={event => setSearch(event.target.value)}
              style={{ border: 0, outline: 0, flex: 1, minWidth: 0 }} />
          </label>
          <select className="filter-control" value={routeFilter} onChange={event => setRouteFilter(event.target.value)}>
            <option value="All">All routes</option>
            {routes.map(route => <option key={route}>{route}</option>)}
          </select>
          <select className="filter-control" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            {['On Time', 'In Transit', 'Delayed', 'Full', 'Maintenance'].map(status => <option key={status}>{status}</option>)}
          </select>
        </div>
        {loading && <div className="empty-state">Loading buses…</div>}
        {!loading && !error && filteredBuses.length === 0 && <div className="empty-state">No buses match these filters.</div>}
        {!loading && filteredBuses.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bus</th><th>Route</th><th>Driver</th><th>Seats occupied</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredBuses.map(bus => {
                  const capacity = Number(bus.capacity || 0);
                  const occupied = Math.min(Number(bus.occupied_seats || 0), capacity);
                  return (
                    <tr key={bus.bus_id}>
                      <td><strong>{bus.bus_number}</strong></td>
                      <td>{bus.route_name || 'Not assigned'}</td>
                      <td>{bus.driver_name || 'Unassigned'}{bus.driver_phone && <small className="card-meta" style={{ display: 'block' }}>{bus.driver_phone}</small>}</td>
                      <td>{occupied} / {capacity}</td>
                      <td><span className={`badge ${statusClass(bus.fleet_status || bus.current_status)}`}>{bus.fleet_status || bus.current_status || 'Unknown'}</span></td>
                      <td><div className="row-actions">
                        <button className="icon-button" type="button" aria-label={`Edit ${bus.bus_number}`} onClick={() => handleEdit(bus)}><Pencil size={15} /></button>
                        <button className="icon-button danger-action" type="button" aria-label={`Delete ${bus.bus_number}`} onClick={() => handleDelete(bus)}><Trash2 size={15} /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
