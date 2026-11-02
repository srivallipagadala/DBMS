import { useEffect, useState } from 'react';
import { AlertTriangle, Bus, CheckCircle, MapPin, TicketCheck } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

function formatTime(value) {
  return value ? String(value).slice(0, 5) : 'Time not set';
}

export default function StudentPortal() {
  const [profile, setProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [alertError, setAlertError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest('/api/student/me'),
      apiRequest('/api/schedules'),
      apiRequest('/api/routes'),
      apiRequest('/api/student/bookings'),
      apiRequest('/api/student/alerts'),
    ])
      .then(([student, scheduleData, routeData, bookingData, alertData]) => {
        if (!active) return;
        setProfile(student);
        setSchedules(scheduleData);
        setRoutes(routeData);
        setBookings(bookingData);
        setAlerts(alertData);
      })
      .catch(requestError => {
        if (!active) return;
        setIsError(true);
        setMessage(`Could not load student information: ${toErrorMessage(requestError)}`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refreshAlerts = () => {
      apiRequest('/api/student/alerts')
        .then(alertData => {
          setAlerts(alertData);
          setAlertError('');
        })
        .catch(requestError => setAlertError(toErrorMessage(requestError)));
    };
    const intervalId = window.setInterval(refreshAlerts, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleBooking = async (event) => {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setSubmitting(true);
    try {
      const result = await apiRequest('/api/student-access', {
        method: 'POST',
        body: JSON.stringify({
          student_id_number: studentId.trim(),
          schedule_id: selectedSchedule,
        }),
      });
      setMessage(result.message || 'Seat booked successfully.');
      setSchedules(current => current.map(schedule =>
        String(schedule.schedule_id) === String(selectedSchedule)
          ? { ...schedule, available_seats: result.available_seats }
          : schedule
      ));
      setStudentId('');
      setSelectedSchedule('');
      setBookings(await apiRequest('/api/student/bookings'));
      apiRequest('/api/student/alerts')
        .then(setAlerts)
        .catch(requestError => setAlertError(toErrorMessage(requestError)));
    } catch (requestError) {
      setIsError(true);
      setMessage(toErrorMessage(requestError));
      try {
        setSchedules(await apiRequest('/api/schedules'));
      } catch (refreshError) {
        setMessage(`${toErrorMessage(requestError)} Schedule refresh failed: ${toErrorMessage(refreshError)}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async booking => {
    if (!window.confirm(`Cancel your booking for ${booking.bus_number || 'this bus'} on ${booking.route_name || 'this route'}?`)) return;
    setCancellingBooking(booking.access_id);
    setMessage('');
    setIsError(false);
    try {
      const result = await apiRequest(`/api/student/bookings/${booking.access_id}`, { method: 'DELETE' });
      setMessage(result.message);
      const [bookingData, scheduleData, alertData] = await Promise.all([
        apiRequest('/api/student/bookings'),
        apiRequest('/api/schedules'),
        apiRequest('/api/student/alerts'),
      ]);
      setBookings(bookingData);
      setSchedules(scheduleData);
      setAlerts(alertData);
    } catch (requestError) {
      setIsError(true);
      setMessage(toErrorMessage(requestError));
    } finally {
      setCancellingBooking(null);
    }
  };

  const availableSchedules = schedules.filter(schedule =>
    Number(schedule.available_seats) > 0 &&
    schedule.status === 'Scheduled' &&
    schedule.bus_status !== 'Maintenance'
  );

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>My student portal</h1>
          <p>View your account details, published routes, schedules, and your bookings.</p>
        </div>
        <span className="badge success"><CheckCircle size={14} /> Student account</span>
      </div>

      {message && <p className={`message ${isError ? 'error' : ''}`} role={isError ? 'alert' : 'status'}>{message}</p>}
      {alertError && <p className="message error" role="alert">Could not refresh service alerts: {alertError}</p>}

      {alerts.length > 0 && (
        <section className="service-alerts" aria-labelledby="service-alert-heading">
          <div className="service-alert-heading">
            <AlertTriangle size={20} />
            <div>
              <h2 id="service-alert-heading">Bus service update</h2>
              <p>Your confirmed booking needs attention. Review an available replacement below.</p>
            </div>
          </div>
          {alerts.map(alert => (
            <article className="service-alert" key={alert.access_id}>
              <p>
                <strong>{alert.bus_number} · {alert.route_name}</strong> at {formatTime(alert.departure_time)}: {alert.reason}
              </p>
              {alert.alternatives.length > 0 ? (
                <div className="alternative-list">
                  <h3>Recommended alternative{alert.alternatives.length > 1 ? 's' : ''}</h3>
                  {alert.alternatives.map(alternative => (
                    <div className="alternative-card" key={alternative.schedule_id}>
                      <strong>{alternative.bus_number}</strong>
                      <span>{alternative.route_name} · {alternative.start_location} → {alternative.destination}</span>
                      <span>{formatTime(alternative.departure_time)}–{formatTime(alternative.arrival_time)} · {alternative.available_seats} seats available</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="service-alert-no-alternative">
                  No replacement bus is currently scheduled for this route and time. Please contact the administrator.
                </p>
              )}
            </article>
          ))}
        </section>
      )}

      {loading ? <div className="empty-state">Loading your student information…</div> : profile && (
        <section className="panel">
          <div className="panel-heading">
            <div><h2>My account</h2><p>Only you and administrators can access your student account details.</p></div>
          </div>
          <div className="profile-grid">
            <div><span className="stat-label">Full name</span><strong>{profile.full_name}</strong></div>
            <div><span className="stat-label">Email</span><strong>{profile.email}</strong></div>
            <div><span className="stat-label">Account type</span><strong>Student</strong></div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Routes published by the admin</h2><p>Route stops and times are managed by your bus administrator.</p></div>
        </div>
        {!loading && routes.length === 0 && <div className="empty-state">No routes have been published yet.</div>}
        {!loading && routes.length > 0 && (
          <div className="route-grid">
            {routes.map(route => (
              <article className="route-card" key={route.route_id}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}><MapPin size={16} />{route.route_name}</h3>
                <div className="card-meta">{route.start_location} → {route.destination}</div>
                {route.stops?.length > 0 ? (
                  <ol className="route-stops">
                    {route.stops.map(stop => (
                      <li key={stop.stop_id}>{stop.stop_name}<small>Estimated: {formatTime(stop.estimated_time)}</small></li>
                    ))}
                  </ol>
                ) : <p className="card-meta">Stop details will be added by the admin.</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card-box" style={{ maxWidth: 760 }}>
        <div className="panel-heading">
          <div><h2>Book a seat</h2><p>Your reservation is linked to your signed-in student account.</p></div>
        </div>
        {!loading && availableSchedules.length === 0 && (
          <div className="empty-state">No published schedules currently have seats available.</div>
        )}
        {availableSchedules.length > 0 && (
          <form onSubmit={handleBooking} style={{ display: 'grid', gap: 15 }}>
            <label className="field">Student ID number
              <input required value={studentId} placeholder="Enter your student ID"
                onChange={event => setStudentId(event.target.value)} />
            </label>
            <label className="field">Select schedule
              <select required value={selectedSchedule} onChange={event => setSelectedSchedule(event.target.value)}>
                <option value="">Choose an available trip</option>
                {availableSchedules.map(schedule => (
                  <option key={schedule.schedule_id} value={schedule.schedule_id}>
                    {schedule.bus_number} — {schedule.route_name} · {formatTime(schedule.departure_time)} · {schedule.available_seats} seats left
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Bus size={16} /> {submitting ? 'Booking…' : 'Book seat'}
            </button>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>My bookings</h2><p>Your reservation history is private to your student account and administrators.</p></div>
          <span className="badge neutral"><TicketCheck size={14} /> {bookings.length}</span>
        </div>
        {!loading && bookings.length === 0 && <div className="empty-state">You do not have any bookings yet.</div>}
        {!loading && bookings.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bus</th><th>Route</th><th>Departure</th><th>Arrival</th><th>Student ID</th><th>Booking status</th><th>Action</th></tr></thead>
              <tbody>
                {bookings.map(booking => (
                  <tr key={booking.access_id}>
                    <td>{booking.bus_number || 'Unavailable'}</td>
                    <td>{booking.route_name || 'Unavailable'}</td>
                    <td>{formatTime(booking.departure_time)}</td>
                    <td>{formatTime(booking.arrival_time)}</td>
                    <td>{booking.student_id_number}</td>
                    <td><span className={`badge ${booking.booking_status === 'Confirmed' ? 'success' : 'neutral'}`}>{booking.booking_status}</span></td>
                    <td>
                      {booking.booking_status === 'Confirmed' &&
                        ['Scheduled', 'Delayed', 'Cancelled'].includes(booking.schedule_status) && (
                          <button
                            className="btn-secondary"
                            type="button"
                            disabled={cancellingBooking === booking.access_id}
                            onClick={() => handleCancelBooking(booking)}
                          >
                            {cancellingBooking === booking.access_id ? 'Cancelling…' : 'Cancel booking'}
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
