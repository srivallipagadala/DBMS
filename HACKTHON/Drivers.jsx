import { useEffect, useState } from 'react';
import { Bus, Pencil, Phone, Plus, Shield, Trash2, X } from 'lucide-react';
import { apiRequest, toErrorMessage } from '../api';

const initialForm = { name: '', phone: '', license_number: '', status: 'Available', password: '' };

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [mustSetPassword, setMustSetPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDrivers = async () => {
    setError('');
    try {
      setDrivers(await apiRequest('/api/drivers'));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiRequest('/api/drivers')
      .then(data => { if (active) setDrivers(data); })
      .catch(requestError => { if (active) setError(toErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleAddDriver = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiRequest(editingId ? `/api/drivers/${editingId}` : '/api/drivers', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setForm(initialForm);
      setEditingId(null);
      setMustSetPassword(false);
      setMessage(editingId ? 'Driver updated successfully.' : 'Driver registered successfully.');
      await loadDrivers();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const handleEdit = (driver) => {
    setEditingId(driver.driver_id);
    setMustSetPassword(!driver.has_login);
    setForm({
      name: driver.name,
      phone: driver.phone,
      license_number: driver.license_number,
      status: driver.status || 'Available',
      password: '',
    });
    setError('');
    setMessage('');
  };

  const handleDelete = async (driver) => {
    if (!window.confirm(`Delete driver ${driver.name}? Any assigned bus will become unassigned.`)) return;
    setError('');
    setMessage('');
    try {
      await apiRequest(`/api/drivers/${driver.driver_id}`, { method: 'DELETE' });
      setMessage('Driver deleted successfully.');
      await loadDrivers();
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMustSetPassword(false);
    setForm(initialForm);
  };

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Driver directory</h1>
          <p>Contact details, license records, and current vehicle assignments.</p>
        </div>
        <span className="badge neutral">{drivers.length} registered</span>
      </div>

      <section className="card-box">
        <div className="panel-heading">
          <div><h2>{editingId ? 'Update driver' : 'Register a driver'}</h2><p>Set an initial password or reset it here. Share the numeric Driver ID shown below with the driver.</p></div>
        </div>
        <form className="form-grid" onSubmit={handleAddDriver}>
          <label className="field">Full name
            <input required value={form.name} placeholder="Driver name"
              onChange={event => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">Phone number
            <input required type="tel" value={form.phone} placeholder="Phone number"
              onChange={event => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label className="field">License number
            <input required value={form.license_number} placeholder="License number"
              onChange={event => setForm({ ...form, license_number: event.target.value })} />
          </label>
          <label className="field">Status
            <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
              <option>Available</option><option>On Duty</option><option>Off Duty</option>
            </select>
          </label>
          <label className="field">{editingId ? 'New driver password (optional)' : 'Driver login password'}
            <input type="password" autoComplete="new-password" value={form.password}
              placeholder={editingId && !mustSetPassword ? 'Leave blank to keep current password' : 'At least 8 characters'}
              minLength={form.password ? 8 : undefined}
              required={!editingId || mustSetPassword}
              onChange={event => setForm({ ...form, password: event.target.value })} />
          </label>
          <button type="submit" className="btn-primary">{editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? 'Save changes' : 'Register driver'}</button>
          {editingId && <button type="button" className="btn-secondary" onClick={cancelEdit}><X size={15} /> Cancel</button>}
        </form>
        {message && <p className="message" role="status">{message}</p>}
        {error && <p className="message error" role="alert">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Drivers</h2><p>Assignments are shown when a bus is linked to a driver.</p></div>
        </div>
        {loading && <div className="empty-state">Loading drivers…</div>}
        {!loading && !error && drivers.length === 0 && <div className="empty-state">No drivers have been registered.</div>}
        {!loading && drivers.length > 0 && (
          <div className="driver-grid">
            {drivers.map(driver => (
              <article className="driver-card" key={driver.driver_id}>
                <div className="driver-card-top">
                  <div>
                    <h3>{driver.name}</h3>
                    <div className="card-meta">Driver ID: {driver.driver_id}</div>
                  </div>
                  <span className={`badge ${driver.status === 'Available' || driver.status === 'Active' ? 'success' : 'warning'}`}>
                    {driver.status || 'Status unknown'}
                  </span>
                </div>
                <div className="card-meta" style={{ marginTop: 10 }}>
                  Driver login: <strong>{driver.has_login ? 'Enabled' : 'Password not set'}</strong>
                </div>
                <div className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16 }}>
                  <Phone size={14} /> {driver.phone}
                </div>
                <div className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                  <Shield size={14} /> License: {driver.license_number}
                </div>
                <div className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                  <Bus size={14} /> Bus: {driver.bus_number || 'Unassigned'}
                </div>
                <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
                  <button className="icon-button" type="button" aria-label={`Edit ${driver.name}`} onClick={() => handleEdit(driver)}><Pencil size={15} /></button>
                  <button className="icon-button danger-action" type="button" aria-label={`Delete ${driver.name}`} onClick={() => handleDelete(driver)}><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
