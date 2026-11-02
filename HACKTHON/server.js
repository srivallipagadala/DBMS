const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { promisify } = require('util');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin 123';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    return `scrypt$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
    if (!storedPassword) return false;
    if (!storedPassword.startsWith('scrypt$')) return storedPassword === password;

    const [, salt, storedHash] = storedPassword.split('$');
    if (!salt || !storedHash) return false;
    const hash = await scrypt(password, salt, 64);
    const expected = Buffer.from(storedHash, 'hex');
    return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        user,
        expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return token;
}

function requireAuth(req, res, next) {
    const token = req.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
        if (token) sessions.delete(token);
        return res.status(401).json({ error: 'Please sign in to continue.' });
    }
    req.auth = { token, user: session.user };
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.auth?.user.role !== role) {
            return res.status(403).json({ error: 'You do not have permission to perform this action.' });
        }
        next();
    };
}

app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();
    return requireAuth(req, res, next);
});

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const [[driverStats]] = await db.query(`
            SELECT COUNT(*) AS total_drivers,
                   SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) AS available_drivers
            FROM drivers
        `);
        res.json({
            total_drivers: Number(driverStats.total_drivers || 0),
            available_drivers: Number(driverStats.available_drivers || 0),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/driver/portal', requireRole('driver'), async (req, res) => {
    try {
        const [buses] = await db.query(`
            SELECT bus_id, bus_number, capacity, current_status
            FROM buses
            WHERE driver_id = ?
            ORDER BY bus_number
        `, [req.auth.user.id]);
        const assignedBuses = await Promise.all(buses.map(async bus => {
            const [schedules] = await db.query(`
                SELECT s.schedule_id, s.route_id, s.departure_time, s.arrival_time,
                       s.status, r.route_name, r.start_location, r.destination
                FROM schedules s
                JOIN routes r ON r.route_id = s.route_id
                WHERE s.bus_id = ?
                ORDER BY s.departure_time
            `, [bus.bus_id]);
            const tripDetails = await Promise.all(schedules.map(async schedule => {
                const [stops] = await db.query(
                    'SELECT stop_id, stop_name, stop_order, estimated_time FROM stops WHERE route_id = ? ORDER BY stop_order',
                    [schedule.route_id]
                );
                const [passengers] = await db.query(`
                    SELECT student_name
                    FROM student_access
                    WHERE schedule_id = ? AND booking_status = 'Confirmed'
                    ORDER BY student_name
                `, [schedule.schedule_id]);
                return { ...schedule, stops, passengers };
            }));
            return { ...bus, schedules: tripDetails };
        }));
        res.json(assignedBuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/driver/reports', requireRole('driver'), async (req, res) => {
    try {
        const [reports] = await db.query(`
            SELECT report_id, bus_number, category, severity, description, status, created_at, updated_at
            FROM bus_reports
            WHERE driver_id = ?
            ORDER BY created_at DESC
        `, [req.auth.user.id]);
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/driver/reports', requireRole('driver'), async (req, res) => {
    const { bus_id, category, severity, description } = req.body;
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    if (!Number.isInteger(Number(bus_id)) || Number(bus_id) < 1 ||
        !['Bus damage', 'Mechanical issue', 'Safety concern', 'Other'].includes(category) ||
        !['Low', 'Medium', 'High'].includes(severity) ||
        !normalizedDescription || normalizedDescription.length > 2000) {
        return res.status(400).json({ error: 'Select an assigned bus, report type, severity, and provide details (up to 2000 characters).' });
    }

    try {
        const [buses] = await db.query(
            'SELECT bus_number FROM buses WHERE bus_id = ? AND driver_id = ?',
            [bus_id, req.auth.user.id]
        );
        if (buses.length === 0) {
            return res.status(403).json({ error: 'You can only report an issue for a bus assigned to you.' });
        }

        const [result] = await db.query(`
            INSERT INTO bus_reports (driver_id, driver_name, bus_id, bus_number, category, severity, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            req.auth.user.id,
            req.auth.user.full_name,
            Number(bus_id),
            buses[0].bus_number,
            category,
            severity,
            normalizedDescription,
        ]);
        res.status(201).json({ message: 'Bus report submitted to the administrator.', report_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/bus-reports', requireRole('admin'), async (req, res) => {
    try {
        const [reports] = await db.query(`
            SELECT report_id, driver_name, bus_number, category, severity,
                   description, status, created_at, updated_at
            FROM bus_reports
            ORDER BY FIELD(status, 'Still Due', 'Completed'),
                     FIELD(severity, 'High', 'Medium', 'Low'),
                     created_at DESC
        `);
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/bus-reports/:reportId/status', requireRole('admin'), async (req, res) => {
    const reportId = Number(req.params.reportId);
    const { status } = req.body;
    if (!Number.isInteger(reportId) || reportId < 1 ||
        !['Still Due', 'Completed'].includes(status)) {
        return res.status(400).json({ error: 'Choose a valid bus report status.' });
    }
    try {
        const [result] = await db.query(
            'UPDATE bus_reports SET status = ? WHERE report_id = ?',
            [status, reportId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Bus report not found.' });
        res.json({ message: `Bus report marked ${status.toLowerCase()}.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/driver/schedules/:scheduleId/status', requireRole('driver'), async (req, res) => {
    const scheduleId = Number(req.params.scheduleId);
    const { status } = req.body;
    if (!Number.isInteger(scheduleId) || scheduleId < 1 ||
        !['Departed', 'Delayed', 'Completed'].includes(status)) {
        return res.status(400).json({ error: 'Choose a valid trip status.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [schedules] = await connection.query(`
            SELECT s.status
            FROM schedules s
            JOIN buses b ON b.bus_id = s.bus_id
            WHERE s.schedule_id = ? AND b.driver_id = ?
            FOR UPDATE
        `, [scheduleId, req.auth.user.id]);
        if (schedules.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Assigned trip not found.' });
        }

        const currentStatus = schedules[0].status;
        const allowedNextStatuses = {
            Scheduled: ['Departed', 'Delayed'],
            Delayed: ['Departed'],
            Departed: ['Completed'],
        };
        if (!allowedNextStatuses[currentStatus]?.includes(status)) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(409).json({ error: `Trip status cannot change from ${currentStatus} to ${status}.` });
        }

        await connection.query('UPDATE schedules SET status = ? WHERE schedule_id = ?', [status, scheduleId]);
        await connection.commit();
        transactionStarted = false;
        res.json({ message: `Trip marked ${status.toLowerCase()}.` });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==================== 1. BUSES API ====================
// Get all buses with their assigned driver info
app.get('/api/buses', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT b.*, d.name AS driver_name,
                   CASE WHEN ? = 'admin' THEN d.phone ELSE NULL END AS driver_phone,
                   r.route_name,
                   s.available_seats,
                   GREATEST(b.capacity - COALESCE(s.available_seats, b.capacity), 0) AS occupied_seats,
                   CASE
                       WHEN s.schedule_id IS NOT NULL AND s.available_seats <= 0
                            AND b.current_status NOT IN ('Maintenance', 'Delayed') THEN 'Full'
                       ELSE b.current_status
                   END AS fleet_status
            FROM buses b 
            LEFT JOIN drivers d ON b.driver_id = d.driver_id
            LEFT JOIN schedules s ON s.schedule_id = (
                SELECT s2.schedule_id
                FROM schedules s2
                WHERE s2.bus_id = b.bus_id
                ORDER BY s2.schedule_id DESC
                LIMIT 1
            )
            LEFT JOIN routes r ON s.route_id = r.route_id
            WHERE (? <> 'driver' OR b.driver_id = ?)
        `, [req.auth.user.role, req.auth.user.role, req.auth.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new bus
app.post('/api/buses', requireRole('admin'), async (req, res) => {
    const { bus_number, capacity, current_status, driver_id } = req.body;
    if (typeof bus_number !== 'string' || !bus_number.trim() ||
        !Number.isInteger(Number(capacity)) || Number(capacity) < 1 ||
        (current_status && !['On Time', 'In Transit', 'Delayed', 'Maintenance'].includes(current_status))) {
        return res.status(400).json({ error: 'Provide a bus number, positive seat capacity, and valid bus status.' });
    }
    try {
        if (driver_id) {
            const [drivers] = await db.query('SELECT driver_id FROM drivers WHERE driver_id = ?', [driver_id]);
            if (drivers.length === 0) return res.status(404).json({ error: 'Driver not found.' });
        }
        const [result] = await db.query(
            'INSERT INTO buses (bus_number, capacity, current_status, driver_id) VALUES (?, ?, ?, ?)',
            [bus_number.trim(), Number(capacity), current_status || 'On Time', driver_id || null]
        );
        res.json({ message: 'Bus added successfully', bus_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/buses/:busId', requireRole('admin'), async (req, res) => {
    const { bus_number, capacity, current_status, driver_id } = req.body;
    const busId = Number(req.params.busId);
    if (!Number.isInteger(busId) || busId < 1 || typeof bus_number !== 'string' || !bus_number.trim() ||
        !Number.isInteger(Number(capacity)) || Number(capacity) < 1 ||
        !['On Time', 'In Transit', 'Delayed', 'Maintenance'].includes(current_status)) {
        return res.status(400).json({ error: 'Provide a bus number, positive seat capacity, and valid bus status.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [result] = await connection.query(
            'UPDATE buses SET bus_number = ?, capacity = ?, current_status = ?, driver_id = ? WHERE bus_id = ?',
            [bus_number.trim(), Number(capacity), current_status, driver_id || null, busId]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Bus not found.' });
        }

        await connection.query(`
            UPDATE schedules s
            SET s.available_seats = GREATEST(0, (
                SELECT GREATEST(0, ? - COUNT(*))
                FROM student_access a
                WHERE a.schedule_id = s.schedule_id AND a.booking_status = 'Confirmed'
            ))
            WHERE s.bus_id = ?
        `, [Number(capacity), busId]);
        await connection.commit();
        transactionStarted = false;
        res.json({ message: 'Bus updated successfully.' });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/buses/:busId', requireRole('admin'), async (req, res) => {
    const busId = Number(req.params.busId);
    if (!Number.isInteger(busId) || busId < 1) {
        return res.status(400).json({ error: 'Provide a valid bus ID.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        await connection.query('SELECT schedule_id FROM schedules WHERE bus_id = ? FOR UPDATE', [busId]);
        const [buses] = await connection.query('SELECT bus_id FROM buses WHERE bus_id = ? FOR UPDATE', [busId]);
        if (buses.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Bus not found.' });
        }

        const [bookings] = await connection.query(`
            SELECT a.access_id
            FROM student_access a
            JOIN schedules s ON s.schedule_id = a.schedule_id
            WHERE s.bus_id = ?
            LIMIT 1
            FOR UPDATE
        `, [busId]);
        if (bookings.length > 0) {
            await connection.query(
                "UPDATE schedules SET status = 'Cancelled' WHERE bus_id = ?",
                [busId]
            );
            await connection.query(
                "UPDATE buses SET current_status = 'Maintenance' WHERE bus_id = ?",
                [busId]
            );
            await connection.commit();
            transactionStarted = false;
            return res.json({
                message: 'Bus retained in maintenance and its trips cancelled to preserve booking history. Students with confirmed bookings will see a service alert.',
                retained: true,
            });
        }

        await connection.query('DELETE FROM buses WHERE bus_id = ?', [busId]);
        await connection.commit();
        transactionStarted = false;
        res.json({ message: 'Bus and its schedules deleted successfully.', retained: false });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==================== 2. DRIVERS API ====================
// Get all drivers
app.get('/api/drivers', requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT d.driver_id, d.name, d.phone, d.license_number, d.status,
                   d.password_hash IS NOT NULL AS has_login,
                   (SELECT b.bus_number FROM buses b WHERE b.driver_id = d.driver_id LIMIT 1) AS bus_number
            FROM drivers d
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a driver
app.post('/api/drivers', requireRole('admin'), async (req, res) => {
    const { name, phone, license_number, status, password } = req.body;
    if (typeof name !== 'string' || !name.trim() ||
        typeof phone !== 'string' || !phone.trim() ||
        typeof license_number !== 'string' || !license_number.trim() ||
        typeof password !== 'string' || password.length < 8 ||
        (status && !['Available', 'On Duty', 'Off Duty'].includes(status))) {
        return res.status(400).json({ error: 'Provide a name, phone, license number, driver password of at least 8 characters, and valid driver status.' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO drivers (name, phone, license_number, status, password_hash) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), phone.trim(), license_number.trim(), status || 'Available', await hashPassword(password)]
        );
        res.json({ message: 'Driver added successfully. Share the driver ID and password with the driver.', driver_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/drivers/:driverId', requireRole('admin'), async (req, res) => {
    const { name, phone, license_number, status, password } = req.body;
    if (!Number.isInteger(Number(req.params.driverId)) ||
        typeof name !== 'string' || !name.trim() ||
        typeof phone !== 'string' || !phone.trim() ||
        typeof license_number !== 'string' || !license_number.trim() ||
        (password !== undefined && (typeof password !== 'string' || (password.length > 0 && password.length < 8))) ||
        !['Available', 'On Duty', 'Off Duty'].includes(status)) {
        return res.status(400).json({ error: 'Provide valid driver details and, if resetting the password, at least 8 characters.' });
    }

    try {
        const values = [name.trim(), phone.trim(), license_number.trim(), status];
        let query = 'UPDATE drivers SET name = ?, phone = ?, license_number = ?, status = ?';
        if (password) {
            query += ', password_hash = ?';
            values.push(await hashPassword(password));
        }
        query += ' WHERE driver_id = ?';
        values.push(req.params.driverId);
        const [result] = await db.query(query, values);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Driver not found.' });
        if (password) {
            for (const [token, session] of sessions) {
                if (session.user.role === 'driver' && session.user.id === Number(req.params.driverId)) {
                    sessions.delete(token);
                }
            }
        }
        res.json({ message: 'Driver updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/drivers/:driverId', requireRole('admin'), async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM drivers WHERE driver_id = ?', [req.params.driverId]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Driver not found.' });
        res.json({ message: 'Driver deleted successfully. Assigned buses are now unassigned.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== 3. ROUTES & STOPS API ====================
// Get all routes
app.get('/api/routes', async (req, res) => {
    try {
        const [routes] = await db.query(`
            SELECT r.*
            FROM routes r
            WHERE (? <> 'driver' OR EXISTS (
                SELECT 1
                FROM schedules s
                JOIN buses b ON b.bus_id = s.bus_id
                WHERE s.route_id = r.route_id AND b.driver_id = ?
            ))
        `, [req.auth.user.role, req.auth.user.id]);
        // Fetch stops for each route
        for (let route of routes) {
            const [stops] = await db.query('SELECT * FROM stops WHERE route_id = ? ORDER BY stop_order ASC', [route.route_id]);
            route.stops = stops;
        }
        res.json(routes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a route and its ordered stops
app.post('/api/routes', requireRole('admin'), async (req, res) => {
    const { route_name, start_location, destination, stops = [] } = req.body;
    if (typeof route_name !== 'string' || !route_name.trim() ||
        typeof start_location !== 'string' || !start_location.trim() ||
        typeof destination !== 'string' || !destination.trim() || !Array.isArray(stops)) {
        return res.status(400).json({ error: 'Route name, start location, destination, and a stops array are required.' });
    }

    const invalidStop = stops.some(stop =>
        !stop || typeof stop.stop_name !== 'string' || !stop.stop_name.trim() ||
        typeof stop.estimated_time !== 'string' ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(stop.estimated_time)
    );
    if (invalidStop) {
        return res.status(400).json({ error: 'Each stop must include a name and estimated time.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [result] = await connection.query(
            'INSERT INTO routes (route_name, start_location, destination) VALUES (?, ?, ?)',
            [route_name.trim(), start_location.trim(), destination.trim()]
        );

        for (const [index, stop] of stops.entries()) {
            await connection.query(
                'INSERT INTO stops (route_id, stop_name, stop_order, estimated_time) VALUES (?, ?, ?, ?)',
                [result.insertId, stop.stop_name.trim(), index + 1, stop.estimated_time.trim()]
            );
        }

        await connection.commit();
        transactionStarted = false;
        res.status(201).json({ message: 'Route added successfully', route_id: result.insertId });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/routes/:routeId', requireRole('admin'), async (req, res) => {
    const { route_name, start_location, destination, stops } = req.body;
    const routeId = Number(req.params.routeId);
    if (!Number.isInteger(routeId) || routeId < 1 ||
        typeof route_name !== 'string' || !route_name.trim() ||
        typeof start_location !== 'string' || !start_location.trim() ||
        typeof destination !== 'string' || !destination.trim() || !Array.isArray(stops)) {
        return res.status(400).json({ error: 'Route name, start location, destination, and stops are required.' });
    }

    const invalidStop = stops.some(stop =>
        !stop || typeof stop.stop_name !== 'string' || !stop.stop_name.trim() ||
        typeof stop.estimated_time !== 'string' ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(stop.estimated_time)
    );
    if (invalidStop) return res.status(400).json({ error: 'Each stop must include a name and a valid HH:MM time.' });

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        await connection.query('SELECT schedule_id FROM schedules WHERE route_id = ? FOR UPDATE', [routeId]);
        const [existingRoutes] = await connection.query(
            'SELECT route_id FROM routes WHERE route_id = ? FOR UPDATE',
            [routeId]
        );
        if (existingRoutes.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Route not found.' });
        }
        const [existingBookings] = await connection.query(`
            SELECT a.access_id
            FROM student_access a
            JOIN schedules s ON s.schedule_id = a.schedule_id
            WHERE s.route_id = ?
            LIMIT 1
            FOR UPDATE
        `, [routeId]);
        if (existingBookings.length > 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(409).json({
                error: 'This route has booking history and cannot be changed without affecting saved student trips.',
            });
        }
        const [result] = await connection.query(
            'UPDATE routes SET route_name = ?, start_location = ?, destination = ? WHERE route_id = ?',
            [route_name.trim(), start_location.trim(), destination.trim(), routeId]
        );
        if (result.affectedRows === 0) {
            const [existing] = await connection.query('SELECT route_id FROM routes WHERE route_id = ?', [routeId]);
            if (existing.length === 0) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(404).json({ error: 'Route not found.' });
            }
        }

        await connection.query('DELETE FROM stops WHERE route_id = ?', [routeId]);
        for (const [index, stop] of stops.entries()) {
            await connection.query(
                'INSERT INTO stops (route_id, stop_name, stop_order, estimated_time) VALUES (?, ?, ?, ?)',
                [routeId, stop.stop_name.trim(), index + 1, stop.estimated_time]
            );
        }
        await connection.commit();
        transactionStarted = false;
        res.json({ message: 'Route and stops updated successfully.' });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/routes/:routeId', requireRole('admin'), async (req, res) => {
    const routeId = Number(req.params.routeId);
    if (!Number.isInteger(routeId) || routeId < 1) {
        return res.status(400).json({ error: 'Provide a valid route ID.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        await connection.query('SELECT schedule_id FROM schedules WHERE route_id = ? FOR UPDATE', [routeId]);
        const [routes] = await connection.query('SELECT route_id FROM routes WHERE route_id = ? FOR UPDATE', [routeId]);
        if (routes.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Route not found.' });
        }

        const [bookings] = await connection.query(`
            SELECT a.access_id
            FROM student_access a
            JOIN schedules s ON s.schedule_id = a.schedule_id
            WHERE s.route_id = ?
            LIMIT 1
            FOR UPDATE
        `, [routeId]);
        if (bookings.length > 0) {
            await connection.query(
                "UPDATE schedules SET status = 'Cancelled' WHERE route_id = ?",
                [routeId]
            );
            await connection.commit();
            transactionStarted = false;
            return res.json({
                message: 'Route retained and its trips cancelled to preserve booking history. Students with confirmed bookings will see a service alert.',
                retained: true,
            });
        }

        await connection.query('DELETE FROM routes WHERE route_id = ?', [routeId]);
        await connection.commit();
        transactionStarted = false;
        res.json({ message: 'Route, stops, and schedules deleted successfully.', retained: false });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==================== 4. SCHEDULES & STUDENT AVAILABILITY API ====================
// Get all schedules with bus and route details
app.get('/api/schedules', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, b.bus_number, b.capacity, b.current_status AS bus_status,
                   r.route_name, r.start_location, r.destination
            FROM schedules s
            JOIN buses b ON s.bus_id = b.bus_id
            JOIN routes r ON s.route_id = r.route_id
            WHERE (? <> 'driver' OR b.driver_id = ?)
        `, [req.auth.user.role, req.auth.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign a bus to a route and create its seat-capacity schedule
app.post('/api/schedules', requireRole('admin'), async (req, res) => {
    const { bus_id, route_id, departure_time, arrival_time } = req.body;
    if (!bus_id || !route_id ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(departure_time || '') ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(arrival_time || '')) {
        return res.status(400).json({ error: 'Bus, route, departure time, and arrival time are required.' });
    }

    try {
        const [buses] = await db.query('SELECT capacity FROM buses WHERE bus_id = ?', [bus_id]);
        if (buses.length === 0) return res.status(404).json({ error: 'Bus not found.' });

        const [routes] = await db.query('SELECT route_id FROM routes WHERE route_id = ?', [route_id]);
        if (routes.length === 0) return res.status(404).json({ error: 'Route not found.' });

        const [result] = await db.query(
            'INSERT INTO schedules (bus_id, route_id, departure_time, arrival_time, available_seats, status) VALUES (?, ?, ?, ?, ?, ?)',
            [bus_id, route_id, departure_time, arrival_time, buses[0].capacity, 'Scheduled']
        );
        res.status(201).json({ message: 'Schedule added successfully', schedule_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/schedules/:scheduleId', requireRole('admin'), async (req, res) => {
    const { bus_id, route_id, departure_time, arrival_time, status } = req.body;
    const scheduleId = Number(req.params.scheduleId);
    if (!Number.isInteger(scheduleId) || scheduleId < 1 || !bus_id || !route_id ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(departure_time || '') ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(arrival_time || '') ||
        !['Scheduled', 'Departed', 'Completed', 'Cancelled', 'Delayed'].includes(status)) {
        return res.status(400).json({ error: 'Provide valid bus, route, departure/arrival times, and schedule status.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [currentSchedules] = await connection.query(`
            SELECT bus_id, route_id, departure_time, arrival_time
            FROM schedules
            WHERE schedule_id = ?
            FOR UPDATE
        `, [scheduleId]);
        if (currentSchedules.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        const [existingBookings] = await connection.query(
            'SELECT access_id FROM student_access WHERE schedule_id = ? LIMIT 1',
            [scheduleId]
        );
        if (existingBookings.length > 0) {
            const currentSchedule = currentSchedules[0];
            const tripDetailsChanged =
                Number(currentSchedule.bus_id) !== Number(bus_id) ||
                Number(currentSchedule.route_id) !== Number(route_id) ||
                String(currentSchedule.departure_time).slice(0, 5) !== departure_time ||
                String(currentSchedule.arrival_time).slice(0, 5) !== arrival_time;
            if (tripDetailsChanged) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(409).json({
                    error: 'This trip has booking history and cannot be changed without affecting saved student bookings.',
                });
            }
        }
        const [buses] = await connection.query('SELECT capacity FROM buses WHERE bus_id = ?', [bus_id]);
        if (buses.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Bus not found.' });
        }

        const [result] = await connection.query(
            `UPDATE schedules
             SET bus_id = ?, route_id = ?, departure_time = ?, arrival_time = ?, status = ?,
                 available_seats = GREATEST(0, ? - (
                     SELECT COUNT(*) FROM student_access
                     WHERE schedule_id = ? AND booking_status = 'Confirmed'
                 ))
             WHERE schedule_id = ?`,
            [bus_id, route_id, departure_time, arrival_time, status, buses[0].capacity, scheduleId, scheduleId]
        );
        if (result.affectedRows === 0) {
            const [existing] = await connection.query('SELECT schedule_id FROM schedules WHERE schedule_id = ?', [scheduleId]);
            if (existing.length === 0) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(404).json({ error: 'Schedule not found.' });
            }
        }
        await connection.commit();
        transactionStarted = false;
        res.json({ message: 'Schedule updated successfully.' });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/schedules/:scheduleId', requireRole('admin'), async (req, res) => {
    const scheduleId = Number(req.params.scheduleId);
    if (!Number.isInteger(scheduleId) || scheduleId < 1) {
        return res.status(400).json({ error: 'Provide a valid schedule ID.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [schedules] = await connection.query(
            'SELECT schedule_id FROM schedules WHERE schedule_id = ? FOR UPDATE',
            [scheduleId]
        );
        if (schedules.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        const [bookings] = await connection.query(
            'SELECT access_id FROM student_access WHERE schedule_id = ? LIMIT 1 FOR UPDATE',
            [scheduleId]
        );
        if (bookings.length > 0) {
            await connection.query(
                "UPDATE schedules SET status = 'Cancelled' WHERE schedule_id = ?",
                [scheduleId]
            );
            await connection.commit();
            transactionStarted = false;
            return res.json({
                message: 'Schedule cancelled to preserve booking history. Students with confirmed bookings will see a service alert.',
                retained: true,
            });
        }

        await connection.query('DELETE FROM schedules WHERE schedule_id = ?', [scheduleId]);
        await connection.commit();
        transactionStarted = false;
        res.json({ message: 'Schedule deleted successfully.', retained: false });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/admin/students', requireRole('admin'), async (req, res) => {
    try {
        const [students] = await db.query(
            `SELECT user_id, full_name, email, created_at
             FROM users
             WHERE role = 'student'
             ORDER BY created_at DESC`
        );
        const [bookings] = await db.query(`
            SELECT a.access_id, a.user_id, a.student_name, a.student_id_number,
                   a.booking_status, a.booked_at, s.departure_time, s.arrival_time,
                   b.bus_number, r.route_name
            FROM student_access a
            LEFT JOIN schedules s ON s.schedule_id = a.schedule_id
            LEFT JOIN buses b ON b.bus_id = s.bus_id
            LEFT JOIN routes r ON r.route_id = s.route_id
            ORDER BY a.booked_at DESC
        `);
        const bookingsByUser = new Map();
        for (const booking of bookings) {
            if (booking.user_id === null) continue;
            const userBookings = bookingsByUser.get(booking.user_id) || [];
            userBookings.push(booking);
            bookingsByUser.set(booking.user_id, userBookings);
        }
        res.json(students.map(student => ({
            ...student,
            bookings: bookingsByUser.get(student.user_id) || [],
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/student/me', requireRole('student'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT user_id, full_name, email, created_at FROM users WHERE user_id = ? AND role = ?',
            [req.auth.user.id, 'student']
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Student account not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/student/bookings', requireRole('student'), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.access_id, a.student_id_number, a.booking_status, a.booked_at,
                   s.schedule_id, s.departure_time, s.arrival_time, s.status AS schedule_status,
                   b.bus_number, r.route_name, r.start_location, r.destination
            FROM student_access a
            LEFT JOIN schedules s ON s.schedule_id = a.schedule_id
            LEFT JOIN buses b ON b.bus_id = s.bus_id
            LEFT JOIN routes r ON r.route_id = s.route_id
            WHERE a.user_id = ?
            ORDER BY a.booked_at DESC
        `, [req.auth.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/student/bookings/:accessId', requireRole('student'), async (req, res) => {
    const accessId = Number(req.params.accessId);
    if (!Number.isInteger(accessId) || accessId < 1) {
        return res.status(400).json({ error: 'Provide a valid booking ID.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [bookings] = await connection.query(`
            SELECT a.schedule_id, a.booking_status,
                   s.status AS schedule_status, s.available_seats, b.capacity
            FROM student_access a
            JOIN schedules s ON s.schedule_id = a.schedule_id
            JOIN buses b ON b.bus_id = s.bus_id
            WHERE a.access_id = ? AND a.user_id = ?
            FOR UPDATE
        `, [accessId, req.auth.user.id]);
        if (bookings.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Booking not found.' });
        }

        const booking = bookings[0];
        if (booking.booking_status !== 'Confirmed') {
            await connection.rollback();
            transactionStarted = false;
            return res.status(409).json({ error: 'This booking has already been cancelled.' });
        }
        if (!['Scheduled', 'Delayed', 'Cancelled'].includes(booking.schedule_status)) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(409).json({ error: 'A trip that has departed or completed can no longer be cancelled.' });
        }

        await connection.query(
            "UPDATE student_access SET booking_status = 'Cancelled' WHERE access_id = ? AND user_id = ?",
            [accessId, req.auth.user.id]
        );
        if (booking.schedule_status !== 'Cancelled') {
            await connection.query(
                'UPDATE schedules SET available_seats = LEAST(?, available_seats + 1) WHERE schedule_id = ?',
                [booking.capacity, booking.schedule_id]
            );
        }
        await connection.commit();
        transactionStarted = false;
        res.json({
            message: booking.schedule_status === 'Cancelled'
                ? 'Your booking was cancelled.'
                : 'Your booking was cancelled and the seat is available again.',
        });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/student/alerts', requireRole('student'), async (req, res) => {
    try {
        const [disruptions] = await db.query(`
            SELECT a.access_id, s.schedule_id, s.route_id, s.bus_id, s.departure_time,
                   b.bus_number, b.current_status AS bus_status,
                   s.status AS schedule_status, r.route_name, r.destination
            FROM student_access a
            JOIN schedules s ON s.schedule_id = a.schedule_id
            JOIN buses b ON b.bus_id = s.bus_id
            JOIN routes r ON r.route_id = s.route_id
            WHERE a.user_id = ?
              AND a.booking_status = 'Confirmed'
              AND (
                  s.status = 'Cancelled'
                  OR (s.status IN ('Scheduled', 'Delayed') AND b.current_status = 'Maintenance')
                  OR s.status = 'Delayed'
              )
            ORDER BY a.booked_at DESC
        `, [req.auth.user.id]);

        const alerts = await Promise.all(disruptions.map(async disruption => {
            const [alternatives] = await db.query(`
                SELECT s.schedule_id, s.departure_time, s.arrival_time, s.available_seats,
                       b.bus_number, b.current_status AS bus_status,
                       r.route_name, r.start_location, r.destination
                FROM schedules s
                JOIN buses b ON b.bus_id = s.bus_id
                JOIN routes r ON r.route_id = s.route_id
                WHERE (s.route_id = ? OR r.destination = ?)
                  AND s.bus_id <> ?
                  AND s.status = 'Scheduled'
                  AND s.available_seats > 0
                  AND b.current_status NOT IN ('Maintenance', 'Delayed')
                  AND (HOUR(s.departure_time) < 12) = ?
                ORDER BY (s.route_id = ?) DESC,
                         ABS(TIME_TO_SEC(TIMEDIFF(s.departure_time, ?))) ASC
                LIMIT 3
            `, [
                disruption.route_id,
                disruption.destination,
                disruption.bus_id,
                Number(String(disruption.departure_time).slice(0, 2)) < 12 ? 1 : 0,
                disruption.route_id,
                disruption.departure_time,
            ]);

            return {
                access_id: disruption.access_id,
                schedule_id: disruption.schedule_id,
                bus_number: disruption.bus_number,
                route_name: disruption.route_name,
                destination: disruption.destination,
                departure_time: disruption.departure_time,
                reason: disruption.schedule_status === 'Cancelled'
                    ? 'This trip was cancelled.'
                    : disruption.schedule_status === 'Delayed'
                        ? 'This trip is delayed.'
                        : 'This bus is under maintenance.',
                alternatives,
            };
        }));

        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student book/access a schedule seat
app.post('/api/student-access', requireRole('student'), async (req, res) => {
    const { student_id_number, schedule_id } = req.body;
    if (typeof student_id_number !== 'string' || !student_id_number.trim() || !schedule_id) {
        return res.status(400).json({ error: 'Student ID and schedule are required.' });
    }

    let connection;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [schedule] = await connection.query(
            `SELECT s.available_seats, s.status, b.current_status AS bus_status
             FROM schedules s
             JOIN buses b ON b.bus_id = s.bus_id
             WHERE s.schedule_id = ?
             FOR UPDATE`,
            [schedule_id]
        );
        if (schedule.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Schedule not found' });
        }

        if (schedule[0].status !== 'Scheduled') {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({ error: 'This trip is no longer open for booking.' });
        }

        if (schedule[0].bus_status === 'Maintenance') {
            await connection.rollback();
            transactionStarted = false;
            return res.status(409).json({ error: 'This bus is under maintenance. Please choose another available trip.' });
        }

        if (schedule[0].available_seats <= 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({ error: 'No seats available on this bus schedule' });
        }

        const [existingBooking] = await connection.query(
            `SELECT access_id FROM student_access
             WHERE user_id = ? AND schedule_id = ? AND booking_status = 'Confirmed'`,
            [req.auth.user.id, schedule_id]
        );
        if (existingBooking.length > 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(409).json({ error: 'You already have a confirmed booking for this trip.' });
        }

        await connection.query(
            'INSERT INTO student_access (user_id, student_name, student_id_number, schedule_id) VALUES (?, ?, ?, ?)',
            [req.auth.user.id, req.auth.user.full_name, student_id_number.trim(), schedule_id]
        );

        await connection.query(
            'UPDATE schedules SET available_seats = available_seats - 1 WHERE schedule_id = ? AND available_seats > 0',
            [schedule_id]
        );
        await connection.commit();
        transactionStarted = false;

        res.json({ message: 'Seat booked successfully!', available_seats: schedule[0].available_seats - 1 });
    } catch (err) {
        if (connection && transactionStarted) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});
// ==================== AUTHENTICATION API ====================

app.post('/api/auth/signup', async (req, res) => {
    const { full_name, email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (typeof full_name !== 'string' || !full_name.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 8 characters.' });
    }
    if (normalizedEmail === ADMIN_USER_ID.toLowerCase()) {
        return res.status(400).json({ error: 'That user ID is reserved for the administrator.' });
    }

    try {
        const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const passwordHash = await hashPassword(password);
        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
            [full_name.trim(), normalizedEmail, passwordHash, 'student']
        );

        const user = {
            id: result.insertId,
            full_name: full_name.trim(),
            email: normalizedEmail,
            role: 'student',
        };
        res.json({
            message: 'Account created successfully!',
            user,
            token: createSession(user),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ? AND role = ?', [normalizedEmail, 'student']);
        if (users.length === 0 || !(await verifyPassword(password, users[0].password))) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];
        if (!String(user.password).startsWith('scrypt$')) {
            await db.query('UPDATE users SET password = ? WHERE user_id = ?', [
                await hashPassword(password),
                user.user_id,
            ]);
        }
        const publicUser = {
            id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            role: 'student',
        };
        res.json({
            message: 'Login successful!',
            user: publicUser,
            token: createSession(publicUser),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/admin-login', async (req, res) => {
    const { user_id, password } = req.body;
    if (typeof user_id !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Administrator user ID and password are required.' });
    }

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND role = ? LIMIT 1',
            [ADMIN_USER_ID, 'admin']
        );
        if (users.length === 0 || user_id.trim() !== ADMIN_USER_ID ||
            !(await verifyPassword(password, users[0].password))) {
            return res.status(401).json({ error: 'Invalid administrator user ID or password.' });
        }

        const user = {
            id: users[0].user_id,
            full_name: users[0].full_name,
            email: users[0].email,
            role: 'admin',
        };
        res.json({
            message: 'Administrator login successful!',
            user,
            token: createSession(user),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/driver-login', async (req, res) => {
    const { driver_id, password } = req.body;
    if (!/^[1-9]\d*$/.test(String(driver_id ?? '')) || typeof password !== 'string') {
        return res.status(400).json({ error: 'Driver ID and password are required.' });
    }

    try {
        const [drivers] = await db.query(
            'SELECT driver_id, name, password_hash FROM drivers WHERE driver_id = ? LIMIT 1',
            [driver_id]
        );
        if (drivers.length === 0 || !drivers[0].password_hash ||
            !(await verifyPassword(password, drivers[0].password_hash))) {
            return res.status(401).json({ error: 'Invalid driver ID or password.' });
        }
        const user = {
            id: drivers[0].driver_id,
            full_name: drivers[0].name,
            role: 'driver',
        };
        res.json({
            message: 'Driver login successful!',
            user,
            token: createSession(user),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.auth.user });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
    sessions.delete(req.auth.token);
    res.json({ message: 'Logged out successfully.' });
});

async function ensureAdminAccount() {
    const [existing] = await db.query('SELECT user_id, role FROM users WHERE email = ? LIMIT 1', [ADMIN_USER_ID]);
    if (existing.length > 0 && existing[0].role !== 'admin') {
        throw new Error(`The configured administrator ID "${ADMIN_USER_ID}" is already assigned to a non-admin user.`);
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    if (existing.length > 0) {
        await db.query(
            'UPDATE users SET full_name = ?, password = ? WHERE user_id = ?',
            ['Administrator', passwordHash, existing[0].user_id]
        );
        return;
    }

    await db.query(
        'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Administrator', ADMIN_USER_ID, passwordHash, 'admin']
    );
}

async function ensureStudentBookingOwnership() {
    const [columns] = await db.query("SHOW COLUMNS FROM student_access LIKE 'user_id'");
    if (columns.length > 0) return;
    await db.query(`
        ALTER TABLE student_access
        ADD COLUMN user_id INT NULL AFTER student_id_number,
        ADD KEY idx_student_access_user_id (user_id),
        ADD CONSTRAINT fk_student_access_user
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
    `);
}

async function ensureDriverCredentials() {
    const [columns] = await db.query("SHOW COLUMNS FROM drivers LIKE 'password_hash'");
    if (columns.length > 0) return;
    await db.query('ALTER TABLE drivers ADD COLUMN password_hash VARCHAR(255) NULL');
}

async function ensureScheduleDelayedStatus() {
    const [columns] = await db.query("SHOW COLUMNS FROM schedules LIKE 'status'");
    if (columns[0]?.Type?.includes("'Delayed'")) return;
    await db.query(`
        ALTER TABLE schedules
        MODIFY COLUMN status ENUM('Scheduled', 'Departed', 'Completed', 'Cancelled', 'Delayed')
        NOT NULL DEFAULT 'Scheduled'
    `);
}

async function ensureBusReportsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS bus_reports (
            report_id INT NOT NULL AUTO_INCREMENT,
            driver_id INT NULL,
            driver_name VARCHAR(100) NOT NULL,
            bus_id INT NULL,
            bus_number VARCHAR(50) NOT NULL,
            category ENUM('Bus damage', 'Mechanical issue', 'Safety concern', 'Other') NOT NULL,
            severity ENUM('Low', 'Medium', 'High') NOT NULL,
            description TEXT NOT NULL,
            status ENUM('Still Due', 'Completed') NOT NULL DEFAULT 'Still Due',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (report_id),
            KEY idx_bus_reports_driver (driver_id),
            KEY idx_bus_reports_status (status),
            CONSTRAINT fk_bus_reports_driver FOREIGN KEY (driver_id)
                REFERENCES drivers (driver_id) ON DELETE SET NULL,
            CONSTRAINT fk_bus_reports_bus FOREIGN KEY (bus_id)
                REFERENCES buses (bus_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [columns] = await db.query("SHOW COLUMNS FROM bus_reports LIKE 'status'");
    if (columns[0]?.Type?.includes("'Open'") ||
        columns[0]?.Type?.includes("'In Review'") ||
        columns[0]?.Type?.includes("'Resolved'")) {
        await db.query(`
            ALTER TABLE bus_reports
            MODIFY COLUMN status ENUM('Open', 'In Review', 'Resolved', 'Still Due', 'Completed')
            NOT NULL DEFAULT 'Still Due'
        `);
        await db.query(`
            UPDATE bus_reports
            SET status = CASE
                WHEN status = 'Resolved' THEN 'Completed'
                ELSE 'Still Due'
            END
        `);
        await db.query(`
            ALTER TABLE bus_reports
            MODIFY COLUMN status ENUM('Still Due', 'Completed')
            NOT NULL DEFAULT 'Still Due'
        `);
    }
}

async function startServer() {
    try {
        await ensureStudentBookingOwnership();
        await ensureDriverCredentials();
        await ensureScheduleDelayedStatus();
        await ensureBusReportsTable();
        await ensureAdminAccount();
        if (!process.env.ADMIN_PASSWORD) {
            console.warn('Using the default administrator password. Set ADMIN_PASSWORD in backend/.env before deployment.');
        }
        app.listen(PORT, () => {
            console.log(`Backend server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Backend startup failed:', err.message);
        process.exitCode = 1;
    }
}

startServer();