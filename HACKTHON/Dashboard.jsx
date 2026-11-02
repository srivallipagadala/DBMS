import { useEffect, useState } from 'react';
import { AlertTriangle, Bus, CheckCircle, MapPin, Navigation, Users } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

const initialData = { buses: [], routes: [], stats: { available_drivers: 0, total_drivers: 0 } };

function statusClass(status) {
  if (status === 'On Time' || status === 'Available' || status === 'Active') return 'success';
  if (status === 'Delayed' || status === 'Maintenance' || status === 'On Leave') return 'warning';
  if (status === 'Full') return 'danger';
  return 'neutral';
}

export default function Dashboard() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest('/api/buses'),
      apiRequest('/api/routes'),
      apiRequest('/api/dashboard/stats'),
    ])
      .then(([buses, routes, stats]) => {
        if (active) setData({ buses, routes, stats });
      })
      .catch((requestError) => {
        if (active) setError(toErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const capacity = data.buses.reduce((sum, bus) => sum + Number(bus.capacity || 0), 0);
  const occupied = data.buses.reduce((sum, bus) => sum + Number(bus.occupied_seats || 0), 0);
  const occupancy = capacity ? Math.round((occupied / capacity) * 100) : 0;
  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Campus transit overview</h1>
          <p>Fleet status, route coverage, and seat availability at a glance.</p>
        </div>
        <span className={`badge ${error ? 'danger' : 'success'}`}>
          {error ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
          {error ? 'Data unavailable' : 'Connected to fleet data'}
        </span>
      </div>

      {error && <p className="message error" role="alert">Could not load dashboard data: {error}</p>}

      <section className="stats-grid" aria-label="Fleet statistics">
        <article className="stat-card">
          <div><h3>Fleet buses</h3><div className="stat-value">{loading ? '—' : data.buses.length} Buses</div></div>
          <span className="stat-icon"><Bus size={21} /></span>
        </article>
        <article className="stat-card">
          <div><h3>Published routes</h3><div className="stat-value">{loading ? '—' : data.routes.length} Routes</div></div>
          <span className="stat-icon"><Navigation size={21} /></span>
        </article>
        <article className="stat-card">
          <div>
            <h3>Drivers Available</h3>
            <div className="stat-value">{loading ? '—' : data.stats.available_drivers}</div>
            {!loading && <p className="card-meta">{data.stats.total_drivers} registered</p>}
          </div>
          <span className="stat-icon"><Users size={21} /></span>
        </article>
        <article className="stat-card">
          <div><h3>Seat Occupancy</h3><div className="stat-value">{loading ? '—' : `${occupancy}%`}</div></div>
          <span className="stat-icon"><CheckCircle size={21} /></span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Live bus fleet</h2>
            <p>Current status and occupancy from your MySQL records. GPS location is not configured.</p>
          </div>
          <span className="badge neutral"><MapPin size={13} /> Location unavailable</span>
        </div>

        {loading && <div className="empty-state">Loading fleet information…</div>}
        {!loading && !error && data.buses.length === 0 && (
          <div className="empty-state">No buses have been added to the fleet yet.</div>
        )}
        {!loading && data.buses.length > 0 && (
          <div className="bus-grid">
            {data.buses.map((bus) => {
              const busCapacity = Number(bus.capacity || 0);
              const seats = Math.min(Number(bus.occupied_seats || 0), busCapacity);
              const percent = busCapacity ? Math.round((seats / busCapacity) * 100) : 0;
              const status = bus.fleet_status || bus.current_status;
              return (
                <article className="bus-card" key={bus.bus_id}>
                  <div className="bus-card-top">
                    <div>
                      <div className="bus-number">{bus.bus_number}</div>
                      <div className="card-meta">{bus.route_name || 'Route not assigned'}</div>
                    </div>
                    <span className={`badge ${statusClass(status)}`}>
                      {status || 'Status unknown'}
                    </span>
                  </div>
                  <div className="card-meta">
                    Driver: <strong>{bus.driver_name || 'Unassigned'}</strong>
                  </div>
                  <div className="progress-label" style={{ marginTop: 16 }}>
                    <span>Seat occupancy</span><strong>{seats} / {busCapacity} ({percent}%)</strong>
                  </div>
                  <div className="progress-track" aria-label={`${percent}% occupied`}>
                    <div className={`progress-fill ${percent >= 90 ? 'full' : ''}`} style={{ width: `${percent}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Fleet operations</h2><p>Summary based on the latest status saved for each bus.</p></div>
          <span className={`badge ${error ? 'warning' : 'success'}`}>
            {error ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
            {error ? 'Data needs attention' : 'Operational'}
          </span>
        </div>
      </section>
    </main>
  );
}