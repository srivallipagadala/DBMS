import { useEffect, useState } from 'react';
import { GraduationCap, Mail, TicketCheck } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '—';
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/admin/students')
      .then(data => { if (active) setStudents(data); })
      .catch(requestError => { if (active) setError(toErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Registered students</h1>
          <p>Student accounts and their bus booking records, visible only to administrators.</p>
        </div>
        <span className="badge neutral"><GraduationCap size={14} /> {students.length} students</span>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <section className="panel">
        {loading && <div className="empty-state">Loading registered students…</div>}
        {!loading && !error && students.length === 0 && <div className="empty-state">No student accounts have registered yet.</div>}
        {!loading && students.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Email</th><th>Registered</th><th>Bookings</th></tr></thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.user_id}>
                    <td><strong>{student.full_name}</strong></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} />{student.email}</span></td>
                    <td>{student.created_at ? new Date(student.created_at).toLocaleDateString() : '—'}</td>
                    <td>{student.bookings.length === 0 ? 'No bookings' : (
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <TicketCheck size={14} /> {student.bookings.length} booking(s)
                        </summary>
                        <ul style={{ margin: '8px 0 0', paddingLeft: 18, whiteSpace: 'normal' }}>
                          {student.bookings.map(booking => (
                            <li key={booking.access_id} style={{ marginBottom: 5 }}>
                              {booking.bus_number || 'Bus unavailable'} · {booking.route_name || 'Route unavailable'} · {formatTime(booking.departure_time)} · {booking.booking_status}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}</td>
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
