import { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

const initialForm = { route_name: '', start_location: '', destination: '', stops_text: '' };

function parseStops(text) {
  return text.split('\n').map(line => line.trim()).filter(Boolean).map((line) => {
    const [stopName, estimatedTime] = line.split('|').map(value => value.trim());
    return { stop_name: stopName, estimated_time: estimatedTime };
  });
}

export default function RoutesStops() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRoutes = async () => {
    setError('');
    try {
      setRoutes(await apiRequest('/api/routes'));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiRequest('/api/routes')
      .then(data => { if (active) setRoutes(data); })
      .catch(requestError => { if (active) setError(toErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleAddRoute = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const stops = parseStops(form.stops_text);
    if (stops.some(stop => !stop.stop_name || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(stop.estimated_time || ''))) {
      setError('Enter each stop as “Stop name | HH:MM”.');
      return;
    }

    try {
      await apiRequest(editingId ? `/api/routes/${editingId}` : '/api/routes', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          route_name: form.route_name,
          start_location: form.start_location,
          destination: form.destination,
          stops,
        }),
      });
      setMessage(editingId ? 'Route and stops updated successfully.' : 'Route and stops added successfully.');
      setForm(initialForm);
      setEditingId(null);
      await loadRoutes();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const handleEdit = (route) => {
    setEditingId(route.route_id);
    setForm({
      route_name: route.route_name,
      start_location: route.start_location,
      destination: route.destination,
      stops_text: (route.stops || [])
        .map(stop => `${stop.stop_name} | ${String(stop.estimated_time || '').slice(0, 5)}`)
        .join('\n'),
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (route) => {
    if (!window.confirm(`Remove route "${route.route_name}"? If bookings exist, the route will be retained and its trips cancelled to preserve student booking history.`)) return;
    setError('');
    setMessage('');
    try {
      const result = await apiRequest(`/api/routes/${route.route_id}`, { method: 'DELETE' });
      setMessage(result.message || 'Route removed successfully.');
      await loadRoutes();
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
          <h1>Routes and stops</h1>
          <p>Set up campus routes and their ordered boarding points.</p>
        </div>
        <span className="badge neutral"><MapPin size={14} /> {routes.length} routes</span>
      </div>

      <section className="card-box">
        <div className="panel-heading">
          <div><h2>{editingId ? 'Update route' : 'Create a route'}</h2><p>Route details and stops are managed by the administrator.</p></div>
        </div>
        <form onSubmit={handleAddRoute} className="form-grid">
          <label className="field">Route name
            <input required value={form.route_name} placeholder="North Campus Shuttle"
              onChange={event => setForm({ ...form, route_name: event.target.value })} />
          </label>
          <label className="field">Start location
            <input required value={form.start_location} placeholder="Central Station"
              onChange={event => setForm({ ...form, start_location: event.target.value })} />
          </label>
          <label className="field">Destination
            <input required value={form.destination} placeholder="Main Campus"
              onChange={event => setForm({ ...form, destination: event.target.value })} />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            Stops and estimated times
            <textarea required value={form.stops_text} placeholder={'Central Station | 07:30\nGreenwood Plaza | 07:45\nMain Campus Gate | 08:15'}
              onChange={event => setForm({ ...form, stops_text: event.target.value })} />
          </label>
          <p className="card-meta" style={{ gridColumn: '1 / -1', margin: 0 }}>One stop per line; use the format Stop name | HH:MM (24-hour time).</p>
          <button type="submit" className="btn-primary">{editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? 'Save changes' : 'Add route'}</button>
          {editingId && <button type="button" className="btn-secondary" onClick={cancelEdit}><X size={15} /> Cancel</button>}
        </form>
        {message && <p className="message" role="status">{message}</p>}
        {error && <p className="message error" role="alert">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Route directory</h2><p>Stops are displayed in their saved travel order.</p></div>
        </div>
        {loading && <div className="empty-state">Loading routes…</div>}
        {!loading && !error && routes.length === 0 && <div className="empty-state">No routes have been added yet.</div>}
        {!loading && routes.length > 0 && (
          <div className="route-grid">
            {routes.map(route => (
              <article className="route-card" key={route.route_id}>
                <div className="bus-card-top">
                  <div>
                    <h3>{route.route_name}</h3>
                    <div className="card-meta">{route.start_location} <span aria-hidden="true">→</span> {route.destination}</div>
                  </div>
                  <span className="badge neutral">{(route.stops || []).length} stops</span>
                </div>
                {route.stops?.length > 0 ? (
                  <ol className="route-stops">
                    {route.stops.map(stop => (
                      <li key={stop.stop_id}>
                        {stop.stop_name}
                        <small>Estimated: {String(stop.estimated_time || '').slice(0, 5) || 'Time not set'}</small>
                      </li>
                    ))}
                  </ol>
                ) : <p className="card-meta">No stops have been added.</p>}
                <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="icon-button" type="button" aria-label={`Edit ${route.route_name}`} onClick={() => handleEdit(route)}><Pencil size={15} /></button>
                  <button className="icon-button danger-action" type="button" aria-label={`Delete ${route.route_name}`} onClick={() => handleDelete(route)}><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
